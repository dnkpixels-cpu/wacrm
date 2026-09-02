import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'

type CallItem = Record<string, unknown>
type Payload = { name?: string; email?: string; phone?: string | number; timezone?: string | null; mangoes?: string; callList?: CallItem[] }
function firstString(...values: unknown[]) { return values.find((value) => typeof value === 'string' && value.trim()) as string | undefined }

export async function POST(request: Request) {
  const expectedSecret = process.env.TAGMANGO_WEBHOOK_SECRET
  if (expectedSecret && request.headers.get('x-tagmango-webhook-secret') !== expectedSecret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const host = request.headers.get('x-whitelabel-host') || request.headers.get('x-tagmango-host')
  const accountId = url.searchParams.get('account_id')
  const payload = (await request.json().catch(() => null)) as Payload | null
  if (!payload) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const admin = supabaseAdmin()
  let configQuery = admin.from('tagmango_configs').select('account_id, whitelabel_host').eq('enabled', true)
  if (accountId) configQuery = configQuery.eq('account_id', accountId)
  else if (host) configQuery = configQuery.eq('whitelabel_host', host)
  const { data: configs, error: configError } = await configQuery.limit(2)
  if (configError || configs?.length !== 1) return NextResponse.json({ error: 'No unique TagMango workspace match.' }, { status: 404 })

  const config = configs[0]
  let stored = 0
  for (const call of payload.callList ?? []) {
    const sessionId = firstString(call._id, call.id, call.webinarId, call.sessionId)
    if (!sessionId) continue
    const mango = typeof call.mango === 'object' && call.mango !== null ? call.mango as Record<string, unknown> : null
    const phone = payload.phone === undefined || payload.phone === null ? null : String(payload.phone)
    const { error } = await admin.from('tagmango_session_registrations').upsert({
      account_id: config.account_id,
      tagmango_session_id: sessionId,
      mango_id: firstString(call.mangoId, mango?._id),
      tagmango_user_id: firstString(call.userId, payload.email, phone, payload.name),
      name: payload.name ?? null,
      email: payload.email ?? null,
      phone,
      timezone: payload.timezone ?? null,
      raw: payload,
    }, { onConflict: 'account_id,tagmango_session_id,tagmango_user_id,phone' })
    if (!error) stored += 1
    else console.error('[tagmango/webhook] registration upsert failed:', error)
  }
  return NextResponse.json({ ok: true, stored })
}
