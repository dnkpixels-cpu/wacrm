import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { syncTagMangoAccount } from '@/lib/integrations/tagmango-sync'

export async function POST(request: Request) {
  const expected = process.env.TAGMANGO_CRON_SECRET
  const supplied = request.headers.get('x-tagmango-cron-secret')
  if (!expected || supplied !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = supabaseAdmin()
  const { data: configs, error } = await admin.from('tagmango_configs').select('account_id').eq('enabled', true)
  if (error) return NextResponse.json({ error: 'Could not load TagMango accounts.' }, { status: 500 })

  const results = []
  for (const config of configs ?? []) {
    try {
      const { data: entitlement } = await admin.from('account_features').select('enabled').eq('account_id', config.account_id).eq('feature_key', 'tagmango').maybeSingle()
      if (entitlement?.enabled !== true) continue
      results.push(await syncTagMangoAccount(config.account_id))
    } catch (accountError) {
      console.error('[tagmango/cron] account sync failed:', accountError)
      results.push({ accountId: config.account_id, error: 'sync_failed' })
    }
  }

  let reminderResult: unknown = null
  try {
    const reminderResponse = await fetch(new URL('/api/tagmango/reminders', request.url), { method: 'POST', headers: { 'x-tagmango-cron-secret': expected }, cache: 'no-store' })
    reminderResult = await reminderResponse.json()
  } catch (error) {
    console.error('[tagmango/cron] reminder worker failed:', error)
  }

  return NextResponse.json({ ok: true, sync: results, reminders: reminderResult })
}
