import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { isFeatureEnabled, requireFeature } from '@/lib/features'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { listUpcomingVideoCalls } from '@/lib/integrations/tagmango'

async function syncAccount(accountId: string) {
  const admin = supabaseAdmin()
  const { data: config, error: configError } = await admin.from('tagmango_configs').select('*').eq('account_id', accountId).eq('enabled', true).maybeSingle()
  if (configError) throw configError
  if (!config) return { accountId, synced: 0, skipped: true }

  const start = new Date()
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000)
  const calls = await listUpcomingVideoCalls(config, start, end)
  let synced = 0

  for (const call of calls) {
    if (!call?._id || !call.fromTime) continue
    const startsAt = new Date(call.fromTime)
    if (Number.isNaN(startsAt.getTime())) continue

    const row = {
      account_id: accountId,
      tagmango_session_id: call._id,
      mango_id: call.mango?._id ?? null,
      mango_title: call.mango?.title ?? null,
      title: call.title || call.mango?.title || 'TagMango session',
      starts_at: startsAt.toISOString(),
      ends_at: call.toTime ? new Date(call.toTime).toISOString() : null,
      meeting_url: call.meetingUrl ?? null,
      status: call.status ?? null,
      raw: call,
    }
    const { error } = await admin.from('tagmango_sessions').upsert(row, { onConflict: 'account_id,tagmango_session_id' })
    if (!error) synced += 1
    else console.error('[tagmango/sync] canonical session upsert failed:', error)

    try {
      const sessionFields = {
        account_id: accountId,
        session_date: startsAt.toISOString().slice(0, 10),
        start_time: startsAt.toISOString().slice(11, 19),
        session_type: call.title || call.mango?.title || 'TagMango session',
        join_url: call.meetingUrl ?? null,
        status: call.status || 'scheduled',
        source: 'tagmango',
        tagmango_session_id: call._id,
        tagmango_mango_id: call.mango?._id ?? null,
      }
      const { data: existing } = await admin.from('sessions').select('id').eq('account_id', accountId).eq('tagmango_session_id', call._id).maybeSingle()
      if (existing?.id) await admin.from('sessions').update(sessionFields).eq('id', existing.id).eq('account_id', accountId)
      else await admin.from('sessions').insert(sessionFields)
    } catch (error) {
      console.warn('[tagmango/sync] legacy session bridge unavailable:', error)
    }
  }

  await admin.from('tagmango_configs').update({ last_sync_at: new Date().toISOString() }).eq('account_id', accountId)
  return { accountId, synced, skipped: false }
}

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('agent')
    await requireFeature(accountId, 'tagmango')
    return NextResponse.json(await syncAccount(accountId))
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function GET() {
  try {
    const { accountId } = await requireRole('agent')
    if (!(await isFeatureEnabled(accountId, 'tagmango'))) return NextResponse.json({ error: 'TagMango is not enabled for this workspace.' }, { status: 403 })
    return NextResponse.json({ ok: true, message: 'Use POST to sync upcoming sessions.' })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export { syncAccount }
