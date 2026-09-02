'use client'

import { useMemo, useState } from 'react'

const FEATURES = [
  ['sessions', 'Sessions'],
  ['tagmango', 'TagMango'],
  ['session_reminders', 'Session reminders'],
] as const

type Account = { id: string; name: string }
type Feature = { account_id: string; feature_key: string; enabled: boolean }

export default function FeatureAdminPage() {
  const [password, setPassword] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [message, setMessage] = useState('')
  const [loaded, setLoaded] = useState(false)
  const headers = useMemo(() => ({ 'x-sutraapi-admin-password': password }), [password])

  const load = async () => {
    setMessage('')
    const response = await fetch('/api/admin/features', { headers, cache: 'no-store' })
    const data = await response.json() as { accounts?: Account[]; features?: Feature[]; error?: string }
    if (!response.ok) { setMessage(data.error || 'Authorization failed.'); return }
    setAccounts(data.accounts ?? [])
    setFeatures(data.features ?? [])
    setLoaded(true)
  }

  const enabled = (accountId: string, featureKey: string) => features.some((f) => f.account_id === accountId && f.feature_key === featureKey && f.enabled)

  const toggle = async (accountId: string, featureKey: string) => {
    const next = !enabled(accountId, featureKey)
    const response = await fetch('/api/admin/features', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ account_id: accountId, feature_key: featureKey, enabled: next }) })
    const data = await response.json() as { feature?: Feature; error?: string }
    if (!response.ok) { setMessage(data.error || 'Update failed.'); return }
    if (data.feature) setFeatures((current) => [...current.filter((f) => !(f.account_id === accountId && f.feature_key === featureKey)), data.feature!])
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div><p className="text-sm font-medium text-primary">SutraAPI Admin</p><h1 className="mt-1 text-2xl font-semibold text-foreground">Feature access</h1><p className="mt-1 text-sm text-muted-foreground">Grant optional modules to specific client accounts.</p></div>
      <div className="rounded-xl border border-border bg-card p-5">
        <label className="block text-sm font-medium text-foreground">Admin password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="SutraAPI team password" /></label>
        <button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Unlock feature controls</button>
      </div>
      {message ? <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{message}</div> : null}
      {loaded ? <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,130px)] border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Client</span>{FEATURES.map(([, label]) => <span key={label} className="text-center">{label}</span>)}</div>
        {accounts.map((account) => <div key={account.id} className="grid grid-cols-[minmax(0,1fr)_repeat(3,130px)] items-center border-b border-border px-5 py-4 last:border-b-0"><span className="truncate text-sm font-medium text-foreground">{account.name}</span>{FEATURES.map(([key]) => <button key={key} type="button" onClick={() => void toggle(account.id, key)} className={enabled(account.id, key) ? 'mx-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary' : 'mx-auto rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground'}>{enabled(account.id, key) ? 'Enabled' : 'Off'}</button>)}</div>)}
      </div> : null}
    </div>
  )
}
