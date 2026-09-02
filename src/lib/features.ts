import { supabaseAdmin } from '@/lib/flows/admin-client'

export const FEATURE_KEYS = ['sessions', 'tagmango', 'session_reminders'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export async function isFeatureEnabled(accountId: string, featureKey: FeatureKey) {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('account_features')
    .select('enabled')
    .eq('account_id', accountId)
    .eq('feature_key', featureKey)
    .maybeSingle()

  if (error) {
    console.error('[feature-gate] lookup failed:', error)
    return false
  }

  return data?.enabled === true
}

export async function getEnabledFeatures(accountId: string) {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('account_features')
    .select('feature_key, enabled')
    .eq('account_id', accountId)
    .eq('enabled', true)

  if (error) {
    console.error('[feature-gate] list failed:', error)
    return [] as FeatureKey[]
  }

  return (data ?? [])
    .map((row) => row.feature_key)
    .filter((key): key is FeatureKey => FEATURE_KEYS.includes(key as FeatureKey))
}
