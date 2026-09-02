import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { requireFeature } from '@/lib/features'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { encrypt } from '@/lib/whatsapp/encryption'

export async function GET() {
  try {
    const { accountId } = await requireRole('admin')
    await requireFeature(accountId, 'tagmango')
    const admin = supabaseAdmin()
    const { data, error } = await admin
      .from('tagmango_configs')
      .select('account_id, whitelabel_host, timezone_offset_minutes, enabled, reminder_enabled, reminder_minutes_before, dry_run, last_sync_at')
      .eq('account_id', accountId)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ config: data })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('admin')
    await requireFeature(accountId, 'tagmango')
    const body = await request.json()
    const host = String(body.whitelabel_host ?? '').trim()
    const apiKey = String(body.api_key ?? '').trim()
    if (!host) return NextResponse.json({ error: 'TagMango whitelabel host is required.' }, { status: 400 })

    const admin = supabaseAdmin()
    const payload: Record<string, unknown> = {
      account_id: accountId,
      whitelabel_host: host,
      timezone_offset_minutes: Number(body.timezone_offset_minutes ?? 330),
      enabled: body.enabled !== false,
      reminder_enabled: body.reminder_enabled === true,
      reminder_minutes_before: Number(body.reminder_minutes_before ?? 60),
      dry_run: body.dry_run !== false,
      updated_at: new Date().toISOString(),
    }
    if (apiKey) payload.api_key_encrypted = encrypt(apiKey)

    const { data: current } = await admin.from('tagmango_configs').select('api_key_encrypted').eq('account_id', accountId).maybeSingle()
    if (!payload.api_key_encrypted && !current?.api_key_encrypted) {
      return NextResponse.json({ error: 'TagMango API key is required the first time you connect.' }, { status: 400 })
    }
    if (!payload.api_key_encrypted) payload.api_key_encrypted = current.api_key_encrypted

    const { data, error } = await admin
      .from('tagmango_configs')
      .upsert(payload, { onConflict: 'account_id' })
      .select('account_id, whitelabel_host, timezone_offset_minutes, enabled, reminder_enabled, reminder_minutes_before, dry_run, last_sync_at')
      .single()
    if (error) throw error
    return NextResponse.json({ config: data })
  } catch (error) {
    return toErrorResponse(error)
  }
}
