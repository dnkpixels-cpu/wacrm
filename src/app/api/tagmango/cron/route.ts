import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { syncAccount } from '@/app/api/tagmango/sync/route'

export async function POST(request: Request) {
  const expected = process.env.TAGMANGO_CRON_SECRET
  const supplied = request.headers.get('x-tagmango-cron-secret')
  if (!expected || supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const { data: configs, error } = await admin
    .from('tagmango_configs')
    .select('account_id')
    .eq('enabled', true)

  if (error) return NextResponse.json({ error: 'Could not load TagMango accounts.' }, { status: 500 })

  const results = []
  for (const config of configs ?? []) {
    try {
      results.push(await syncAccount(config.account_id))
    } catch (accountError) {
      console.error('[tagmango/cron] account sync failed:', accountError)
      results.push({ accountId: config.account_id, error: 'sync_failed' })
    }
  }

  return NextResponse.json({ ok: true, results })
}
