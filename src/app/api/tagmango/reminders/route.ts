import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils'
import type { MessageTemplate } from '@/types'

const TEMPLATE_NAME = 'sutra_session_invitation'
const TEMPLATE_LANGUAGE = 'en_US'

function normalizedPhone(value: string | null) {
  if (!value) return null
  const digits = sanitizePhoneForMeta(value)
  if (!digits) return null
  const international = digits.length === 10 ? `91${digits}` : digits
  return isValidE164(international) ? international : null
}

export async function POST(request: Request) {
  const expected = process.env.TAGMANGO_CRON_SECRET
  const supplied = request.headers.get('x-tagmango-cron-secret')
  if (!expected || supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const forceDryRun = url.searchParams.get('dry_run') === 'true'
  const admin = supabaseAdmin()
  const now = new Date()
  const windowStart = new Date(now.getTime() + 55 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 65 * 60 * 1000)

  const { data: sessions, error: sessionError } = await admin
    .from('tagmango_sessions')
    .select('*')
    .eq('status', 'available')
    .gte('starts_at', windowStart.toISOString())
    .lte('starts_at', windowEnd.toISOString())

  if (sessionError) return NextResponse.json({ error: 'Could not load upcoming sessions.' }, { status: 500 })

  const results: Array<Record<string, unknown>> = []

  for (const externalSession of sessions ?? []) {
    const { data: config } = await admin
      .from('tagmango_configs')
      .select('*')
      .eq('account_id', externalSession.account_id)
      .eq('enabled', true)
      .eq('reminder_enabled', true)
      .maybeSingle()

    if (!config) continue

    const dryRun = forceDryRun || config.dry_run
    const { data: registrations } = await admin
      .from('tagmango_session_registrations')
      .select('name, email, phone, tagmango_user_id')
      .eq('account_id', externalSession.account_id)
      .eq('tagmango_session_id', externalSession.tagmango_session_id)

    let eligible = 0
    let sent = 0
    let skipped = 0

    for (const registration of registrations ?? []) {
      const phone = normalizedPhone(registration.phone)
      if (!phone) { skipped += 1; continue }

      // Eligibility is deliberately CRM-first: only a participant already
      // present in this SutraAPI account can receive an automated reminder.
      const { data: participants } = await admin
        .from('participants')
        .select('id, name, phone')
        .or(`phone.eq.${phone},phone.eq.${registration.phone}`)
        .limit(5)

      const participant = participants?.[0]
      if (!participant) { skipped += 1; continue }
      eligible += 1

      const { data: session } = await admin
        .from('sessions')
        .select('id, session_type, session_date, start_time')
        .eq('account_id', externalSession.account_id)
        .eq('tagmango_session_id', externalSession.tagmango_session_id)
        .maybeSingle()

      if (!session) { skipped += 1; continue }

      let { data: link } = await admin
        .from('participant_session_links')
        .select('id, token, expires_at, status')
        .eq('participant_id', participant.id)
        .eq('session_id', session.id)
        .eq('status', 'active')
        .gt('expires_at', now.toISOString())
        .maybeSingle()

      if (!link) {
        const token = crypto.randomUUID().replaceAll('-', '')
        const expiresAt = new Date(new Date(externalSession.ends_at ?? externalSession.starts_at).getTime() + 2 * 60 * 60 * 1000)
        const { data: createdLink, error: linkError } = await admin
          .from('participant_session_links')
          .insert({
            participant_id: participant.id,
            session_id: session.id,
            token,
            expires_at: expiresAt.toISOString(),
            status: 'active',
          })
          .select('id, token, expires_at, status')
          .single()
        if (linkError) { skipped += 1; continue }
        link = createdLink
      }

      const { data: existingLog } = await admin
        .from('session_reminder_logs')
        .select('id, status')
        .eq('account_id', externalSession.account_id)
        .eq('tagmango_session_id', externalSession.tagmango_session_id)
        .eq('participant_id', participant.id)
        .eq('template_name', TEMPLATE_NAME)
        .maybeSingle()

      if (existingLog?.status === 'sent' || existingLog?.status === 'dry_run') continue

      const logBase = {
        account_id: externalSession.account_id,
        tagmango_session_id: externalSession.tagmango_session_id,
        participant_id: participant.id,
        phone,
        template_name: TEMPLATE_NAME,
        scheduled_for: new Date(new Date(externalSession.starts_at).getTime() - 60 * 60 * 1000).toISOString(),
        dry_run: dryRun,
      }

      if (dryRun) {
        await admin.from('session_reminder_logs').upsert({ ...logBase, status: 'dry_run' }, { onConflict: 'account_id,tagmango_session_id,participant_id,template_name' })
        continue
      }

      const { data: configWa } = await admin
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', externalSession.account_id)
        .maybeSingle()
      const { data: templateRow } = await admin
        .from('message_templates')
        .select('*')
        .eq('account_id', externalSession.account_id)
        .eq('name', TEMPLATE_NAME)
        .eq('language', TEMPLATE_LANGUAGE)
        .maybeSingle()

      if (!configWa || !templateRow) {
        await admin.from('session_reminder_logs').upsert({ ...logBase, status: 'failed', error: 'WhatsApp config or approved template missing', dry_run: false }, { onConflict: 'account_id,tagmango_session_id,participant_id,template_name' })
        skipped += 1
        continue
      }

      try {
        const result = await sendTemplateMessage({
          phoneNumberId: configWa.phone_number_id,
          accessToken: decrypt(configWa.access_token),
          to: phone,
          templateName: TEMPLATE_NAME,
          language: (templateRow as MessageTemplate).language || TEMPLATE_LANGUAGE,
          template: templateRow as MessageTemplate,
          messageParams: {
            body: [participant.name || registration.name || 'there', session.session_type, `${session.session_date} at ${session.start_time}`],
            buttonParams: { 0: link.token },
          },
        })

        await admin.from('session_reminder_logs').upsert({ ...logBase, status: 'sent', sent_at: new Date().toISOString(), whatsapp_message_id: result.messageId, dry_run: false }, { onConflict: 'account_id,tagmango_session_id,participant_id,template_name' })
        sent += 1
      } catch (error) {
        await admin.from('session_reminder_logs').upsert({ ...logBase, status: 'failed', error: error instanceof Error ? error.message : 'send_failed', dry_run: false }, { onConflict: 'account_id,tagmango_session_id,participant_id,template_name' })
        skipped += 1
      }
    }

    results.push({ session: externalSession.title, tagmango_session_id: externalSession.tagmango_session_id, eligible, sent, skipped, dry_run: dryRun })
  }

  return NextResponse.json({ ok: true, window: { from: windowStart.toISOString(), to: windowEnd.toISOString() }, results })
}
