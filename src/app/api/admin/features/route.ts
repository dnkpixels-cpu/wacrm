import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'

const allowedFeatures = new Set(['sessions', 'tagmango', 'session_reminders'])

async function authorizeAdmin(request: Request) {
  const expected = process.env.SUTRAAPI_FEATURE_ADMIN_PASSWORD
  const supplied = request.headers.get('x-sutraapi-admin-password')
  if (!expected || !supplied || supplied !== expected) {
    return false
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return Boolean(user)
}

export async function GET(request: Request) {
  if (!(await authorizeAdmin(request))) {
    return NextResponse.json({ error: 'SutraAPI admin authorization required.' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const [{ data: accounts, error: accountsError }, { data: features, error: featuresError }] = await Promise.all([
    admin.from('accounts').select('id, name, created_at').order('created_at', { ascending: true }),
    admin.from('account_features').select('account_id, feature_key, enabled, updated_at'),
  ])

  if (accountsError || featuresError) {
    console.error('[admin/features] load failed:', accountsError ?? featuresError)
    return NextResponse.json({ error: 'Could not load feature settings.' }, { status: 500 })
  }

  return NextResponse.json({ accounts: accounts ?? [], features: features ?? [] })
}

export async function POST(request: Request) {
  if (!(await authorizeAdmin(request))) {
    return NextResponse.json({ error: 'SutraAPI admin authorization required.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const accountId = String(body.account_id ?? '')
  const featureKey = String(body.feature_key ?? '')
  const enabled = body.enabled === true

  if (!accountId || !allowedFeatures.has(featureKey)) {
    return NextResponse.json({ error: 'Invalid account or feature.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('account_features')
    .upsert({ account_id: accountId, feature_key: featureKey, enabled }, { onConflict: 'account_id,feature_key' })
    .select('account_id, feature_key, enabled, updated_at')
    .single()

  if (error) {
    console.error('[admin/features] update failed:', error)
    return NextResponse.json({ error: 'Could not update feature.' }, { status: 500 })
  }

  return NextResponse.json({ feature: data })
}
