import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils'
import type { MessageTemplate } from '@/types'

const TEMPLATE_NAME = 'sutra_session_invitation'
const TEMPLATE_LANGUAGE = 'en_US'

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent')
    const body = await request.json().catch(() => ({}))
    const participantPhone = String(body.participant_phone ?? '9966623190').trim()
    const sessionId = body.session_id ? String(body.session_id) : null

    const admin = supabaseAdmin()

    const phoneDigits = sanitizePhoneForMeta(participantPhone)
    const phoneCandidates = new Set<string>([
      participantPhone,
      phoneDigits,
      phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits,
      phoneDigits.length === 10 ? `+91${phoneDigits}` : `+${phoneDigits}`,
    ])

    const { data: participants, error: participantError } = await admin
      .from('participants')
      .select('id, name, phone')
      .in('phone', [...phoneCandidates])
      .limit(5)

    if (participantError) {
      return NextResponse.json(
        { error: `Could not find participant: ${participantError.message}` },
        { status: 500 },
      )
    }

    const participant = participants?.[0]
    if (!participant) {
      return NextResponse.json(
        { error: `No participant found for ${participantPhone}` },
        { status: 404 },
      )
    }

    let linkQuery = admin
      .from('participant_session_links')
      .select('id, participant_id, session_id, token, expires_at, status')
      .eq('participant_id', participant.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (sessionId) linkQuery = linkQuery.eq('session_id', sessionId)

    const { data: links, error: linkError } = await linkQuery
    if (linkError) {
      return NextResponse.json(
        { error: `Could not find personalized link: ${linkError.message}` },
        { status: 500 },
      )
    }

    const link = links?.[0]
    if (!link) {
      return NextResponse.json(
        { error: 'No active, unexpired personalized session link exists for this participant.' },
        { status: 404 },
      )
    }

    const { data: session, error: sessionError } = await admin
      .from('sessions')
      .select('id, session_type, session_date, start_time')
      .eq('id', link.session_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'The personalized link points to a session that could not be found.' },
        { status: 404 },
      )
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp is not configured for this SutraAPI account.' },
        { status: 400 },
      )
    }

    const { data: templateRow } = await supabase
      .from('message_templates')
      .select('*')
      .eq('account_id', accountId)
      .eq('name', TEMPLATE_NAME)
      .eq('language', TEMPLATE_LANGUAGE)
      .maybeSingle()

    if (!templateRow) {
      return NextResponse.json(
        { error: `The approved template ${TEMPLATE_NAME} is not synced into WACRM yet. Run template sync first.` },
        { status: 400 },
      )
    }

    if (templateRow.status && templateRow.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `WACRM has ${TEMPLATE_NAME} marked as ${templateRow.status}, not APPROVED.` },
        { status: 400 },
      )
    }

    const to = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits
    if (!isValidE164(to)) {
      return NextResponse.json(
        { error: `Participant phone is not a valid international number: ${participant.phone}` },
        { status: 400 },
      )
    }

    const accessToken = decrypt(config.access_token)
    const template = templateRow as MessageTemplate
    const result = await sendTemplateMessage({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to,
      templateName: TEMPLATE_NAME,
      language: template.language || TEMPLATE_LANGUAGE,
      template,
      messageParams: {
        body: [
          participant.name || 'there',
          session.session_type,
          `${session.session_date} at ${session.start_time}`,
        ],
        buttonParams: { 0: link.token },
      },
    })

    return NextResponse.json({
      success: true,
      participant: participant.name,
      phone: to,
      session_id: session.id,
      template: TEMPLATE_NAME,
      whatsapp_message_id: result.messageId,
      personalized_url: `https://app.sutraapi.com/j/${link.token}`,
    })
  } catch (error) {
    console.error('Error sending session invitation:', error)
    return toErrorResponse(error)
  }
}
