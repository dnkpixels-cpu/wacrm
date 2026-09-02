import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'

type CallItem = Record<string, unknown>

type Payload = {
  name?: string
  email?: string
  phone?: string | number
  timezone?: string | null
  mangoes?: string
  callList?: CallItem[]
}

function firstString(...values: unknown[]) {
  return values.find((value) => typeof value === 'string' && value.trim()) as string | undefined
}

export async function POST(request: Request) {
  const expectedSecret = process.env.TAGMANGO_WEBHOOK_SECRET
  if (expectedSecret) {
    const supplied = request.headers.get('x-tagmango-webhook-secret')
    if (supplied !== expectedSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host = request.headers.get('x-whitelabel-host') || request.headers.get('x-tagmango-host')
  const payload = (await request.json().catch(() => null)) as Payload | null
  if (!payload) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const admin = supabaseAdmin()
  let configQuery = admin.from('tagmango_configs').select('account_id, whitelabel_host').eq('enabled', true)
  if (host) configQuery = configQuery.eq('whitelabel_host', host)
  const { data: configs, error: configError } = await configQuery.limit(2)

  if (configError || !configs?.length) {
    return NextResponse.json({ error: 'No matching TagMango workspace.' }, { status: 404 })
  }

  const config = configs[0]
  const calls = payload.callList ?? []
  let stored = 0

  for (const call of calls) {
    const sessionId = firstString(call._id, call.id, call.webinarId, call.sessionId)
    if (!sessionId) continue

    const mangoTitle = firstString(call.mangoTitle, call.mango, payload.mangoes)
    const phone = payload.phone === undefined || payload.phone === null ? null : String(payload.phone)
    const tagmangoUserId = firstString(payload.email, phone, payload.name)

    const { error } = await admin.from('tagmango_session_registrations').upsert({
      account_id: config.account_id,
      tagmango_session_id: sessionId,
      mango_id: firstString(call.mangoId, call.mango?._id),
      tagmango_user_id: tagmangoUserId,
      name: payload.name ?? null,
      email: payload.email ?? null,
      phone,
      timezone: payload.timezone ?? null,
      raw: payload,
    }, { onConflict: 'account_id,tagmango_session_id,tagmango_user_id,phone' })

    if (!error) stored += 1
    else console.error('[tagmango/webhook] registration upsert failed:', error)

    if (mangoTitle) {
      // Keep the value available for diagnostics even when TagMango sends
      // only a display-name list rather than a mango id.
      await admin.from('tagmango_sessions')
        .update({ mango_title: mangoTitle })
        .eq('account_id', config.account_id)
        .eq('tagmango_session_id', sessionId)
    }
  }

  return NextResponse.json({ ok: true, stored })
}
