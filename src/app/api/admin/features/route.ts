import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'

const allowedFeatures = new Set(['sessions', 'tagmango', 'session_reminders'])

type AdminUser = { id: string; email: string; full_name: string; created_at: string }

async function authorizeAdmin(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = supabaseAdmin()
  const { data: existing, error } = await admin
    .from('sutraapi_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[admin/features] admin lookup failed:', error)
    return null
  }

  if (existing) return user

  // One-time bootstrap: the configured email may claim the very first
  // SutraAPI admin seat using their normal Supabase login. Once an admin
  // exists, this environment variable no longer grants access.
  const bootstrapEmail = process.env.SUTRAAPI_INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  if (!bootstrapEmail || user.email?.toLowerCase() !== bootstrapEmail) return null

  const { count, error: countError } = await admin
    .from('sutraapi_admins')
    .select('user_id', { count: 'exact', head: true })

  if (countError || count !== 0) return null

  const { error: insertError } = await admin
    .from('sutraapi_admins')
    .insert({ user_id: user.id })

  if (insertError && insertError.code !== '23505') {
    console.error('[admin/features] bootstrap failed:', insertError)
    return null
  }

  return user
}

async function getAdminUserList(admin: ReturnType<typeof supabaseAdmin>): Promise<AdminUser[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('user_id, email, full_name, created_at')
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.user_id,
    email: row.email,
    full_name: row.full_name,
    created_at: row.created_at,
  }))
}

export async function GET(request: Request) {
  const user = await authorizeAdmin(request)
  if (!user) {
    return NextResponse.json({ error: 'SutraAPI admin access required.' }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const [accountsResult, featuresResult, usersResult, adminsResult, membershipsResult] = await Promise.all([
    admin.from('accounts').select('id, name, created_at').order('created_at', { ascending: true }),
    admin.from('account_features').select('account_id, feature_key, enabled, updated_at'),
    getAdminUserList(admin),
    admin.from('sutraapi_admins').select('user_id, created_at').order('created_at', { ascending: true }),
    admin.from('profiles').select('user_id, account_id, email, full_name, account_role').order('created_at', { ascending: true }),
  ])

  if (accountsResult.error || featuresResult.error || adminsResult.error || membershipsResult.error) {
    console.error('[admin/features] load failed:', accountsResult.error ?? featuresResult.error ?? adminsResult.error ?? membershipsResult.error)
    return NextResponse.json({ error: 'Could not load feature settings.' }, { status: 500 })
  }

  return NextResponse.json({
    accounts: accountsResult.data ?? [],
    features: featuresResult.data ?? [],
    users: usersResult,
    memberships: membershipsResult.data ?? [],
    admins: adminsResult.data ?? [],
  })
}

export async function POST(request: Request) {
  const user = await authorizeAdmin(request)
  if (!user) {
    return NextResponse.json({ error: 'SutraAPI admin access required.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action ?? 'feature')
  const admin = supabaseAdmin()

  if (action === 'feature') {
    const accountId = String(body.account_id ?? '')
    const featureKey = String(body.feature_key ?? '')
    const enabled = body.enabled === true

    if (!accountId || !allowedFeatures.has(featureKey)) {
      return NextResponse.json({ error: 'Invalid account or feature.' }, { status: 400 })
    }

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

  if (action === 'grant_admin' || action === 'revoke_admin') {
    const targetUserId = String(body.user_id ?? '')
    if (!targetUserId) {
      return NextResponse.json({ error: 'User is required.' }, { status: 400 })
    }
    if (targetUserId === user.id && action === 'revoke_admin') {
      return NextResponse.json({ error: 'You cannot remove your own SutraAPI admin access.' }, { status: 400 })
    }

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('user_id')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (targetError || !target) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    if (action === 'grant_admin') {
      const { error } = await admin
        .from('sutraapi_admins')
        .upsert({ user_id: targetUserId }, { onConflict: 'user_id' })
      if (error) {
        console.error('[admin/features] grant admin failed:', error)
        return NextResponse.json({ error: 'Could not grant SutraAPI admin access.' }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    const { count, error: countError } = await admin
      .from('sutraapi_admins')
      .select('user_id', { count: 'exact', head: true })

    if (countError) {
      console.error('[admin/features] admin count failed:', countError)
      return NextResponse.json({ error: 'Could not verify admin count.' }, { status: 500 })
    }
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'At least one SutraAPI admin must remain.' }, { status: 400 })
    }

    const { error } = await admin.from('sutraapi_admins').delete().eq('user_id', targetUserId)
    if (error) {
      console.error('[admin/features] revoke admin failed:', error)
      return NextResponse.json({ error: 'Could not revoke SutraAPI admin access.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown admin action.' }, { status: 400 })
}
