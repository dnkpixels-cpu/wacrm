import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'

export async function GET() {
  try {
    const { accountId } = await requireRole('agent')
    const admin = supabaseAdmin()
    const { data, error } = await admin
      .from('account_features')
      .select('feature_key')
      .eq('account_id', accountId)
      .eq('enabled', true)
    if (error) throw error
    return NextResponse.json({ features: (data ?? []).map((row) => row.feature_key) })
  } catch (error) {
    return toErrorResponse(error)
  }
}
