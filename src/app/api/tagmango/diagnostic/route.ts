import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { requireFeature } from '@/lib/features'
import { listUpcomingVideoCalls } from '@/lib/integrations/tagmango'

export async function GET() {
  try {
    const { accountId } = await requireRole('agent')
    await requireFeature(accountId, 'tagmango')

    const admin = supabaseAdmin()
    const { data: config, error: configError } = await admin
      .from('tagmango_configs')
      .select('account_id, whitelabel_host, enabled, timezone_offset_minutes, last_sync_at')
      .eq('account_id', accountId)
      .maybeSingle()

    if (configError) throw configError
    if (!config) {
      return NextResponse.json({ ok: false, stage: 'config', error: 'No TagMango configuration found.' }, { status: 404 })
    }

    if (!config.enabled) {
      return NextResponse.json({ ok: false, stage: 'config', error: 'TagMango configuration is disabled.' }, { status: 400 })
    }

    const start = new Date()
    const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000)

    try {
      const calls = await listUpcomingVideoCalls(config, start, end)
      return NextResponse.json({
        ok: true,
        stage: 'tagmango_api',
        accountId,
        whitelabelHost: config.whitelabel_host,
        timezoneOffsetMinutes: config.timezone_offset_minutes ?? 330,
        window: { start: start.toISOString(), end: end.toISOString() },
        callsReturned: calls.length,
        firstCalls: calls.slice(0, 5).map((call) => ({
          id: call._id,
          title: call.title ?? call.mango?.title ?? null,
          fromTime: call.fromTime,
          toTime: call.toTime ?? null,
          status: call.status ?? null,
          hasMeetingUrl: Boolean(call.meetingUrl),
        })),
        lastSyncAt: config.last_sync_at,
      })
    } catch (error) {
      return NextResponse.json({
        ok: false,
        stage: 'tagmango_api',
        accountId,
        whitelabelHost: config.whitelabel_host,
        window: { start: start.toISOString(), end: end.toISOString() },
        error: error instanceof Error ? error.message : String(error),
      }, { status: 502 })
    }
  } catch (error) {
    return toErrorResponse(error)
  }
}
