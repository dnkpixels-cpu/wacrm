'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const FEATURES = [
  ['sessions', 'Sessions'],
  ['tagmango', 'TagMango'],
  ['session_reminders', 'Session reminders'],
] as const

type Account = { id: string; name: string; created_at: string }
type Feature = { account_id: string; feature_key: string; enabled: boolean }
type User = { id: string; email: string; full_name: string; created_at: string }
type Membership = { user_id: string; account_id: string; email: string; full_name: string; account_role: 'owner' | 'admin' | 'agent' | 'viewer' }
type SutraAdmin = { user_id: string; created_at: string }

type AdminResponse = {
  accounts?: Account[]
  features?: Feature[]
  users?: User[]
  memberships?: Membership[]
  admins?: SutraAdmin[]
  error?: string
}

export default function FeatureAdminPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [admins, setAdmins] = useState<SutraAdmin[]>([])
  const [message, setMessage] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)

  const adminIds = useMemo(() => new Set(admins.map((admin) => admin.user_id)), [admins])
  const accountUsers = useMemo(() => {
    const grouped = new Map<string, Membership[]>()
    for (const membership of memberships) {
      const current = grouped.get(membership.account_id) ?? []
      current.push(membership)
      grouped.set(membership.account_id, current)
    }
    return grouped
  }, [memberships])

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/features', { cache: 'no-store' })
      const data = await response.json() as AdminResponse
      if (!response.ok) {
        setMessage(data.error || 'SutraAPI admin access required.')
        setLoaded(false)
        return
      }
      setAccounts(data.accounts ?? [])
      setFeatures(data.features ?? [])
      setUsers(data.users ?? [])
      setMemberships(data.memberships ?? [])
      setAdmins(data.admins ?? [])
      setLoaded(true)
    } catch {
      setMessage('Could not connect to the SutraAPI admin service.')
      setLoaded(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const enabled = (accountId: string, featureKey: string) =>
    features.some((feature) => feature.account_id === accountId && feature.feature_key === featureKey && feature.enabled)

  const toggleFeature = async (accountId: string, featureKey: string) => {
    const key = `feature:${accountId}:${featureKey}`
    setWorking(key)
    setMessage('')
    try {
      const response = await fetch('/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'feature', account_id: accountId, feature_key: featureKey, enabled: !enabled(accountId, featureKey) }),
      })
      const data = await response.json() as { feature?: Feature; error?: string }
      if (!response.ok) {
        setMessage(data.error || 'Update failed.')
        return
      }
      if (data.feature) {
        setFeatures((current) => [
          ...current.filter((feature) => !(feature.account_id === accountId && feature.feature_key === featureKey)),
          data.feature,
        ])
      }
    } catch {
      setMessage('Could not update feature access.')
    } finally {
      setWorking(null)
    }
  }

  const toggleAdmin = async (userId: string) => {
    const isAdmin = adminIds.has(userId)
    const key = `admin:${userId}`
    setWorking(key)
    setMessage('')
    try {
      const response = await fetch('/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isAdmin ? 'revoke_admin' : 'grant_admin', user_id: userId }),
      })
      const data = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok) {
        setMessage(data.error || 'Could not update SutraAPI admin access.')
        return
      }
      await load()
    } catch {
      setMessage('Could not update SutraAPI admin access.')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <p className="text-sm font-medium text-primary">SutraAPI Platform</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Feature access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage which client accounts can use optional SutraAPI modules. Access is controlled by SutraAPI admin users, not a shared password.
        </p>
      </div>

      {message ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{message}</div> : null}

      {loading ? <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading SutraAPI controls…</div> : null}

      {!loading && !loaded && !message ? <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">No admin controls available.</div> : null}

      {loaded ? <>
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Client feature access</h2>
              <p className="mt-1 text-sm text-muted-foreground">Features are granted at the client-account level. Every user in that account receives the enabled module.</p>
            </div>
            <button type="button" onClick={() => void load()} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">Refresh</button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[minmax(240px,1fr)_190px_repeat(3,150px)] border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Client</span><span>Users</span>{FEATURES.map(([, label]) => <span key={label} className="text-center">{label}</span>)}
              </div>
              {accounts.map((account) => {
                const accountMembers = accountUsers.get(account.id) ?? []
                return <div key={account.id} className="grid grid-cols-[minmax(240px,1fr)_190px_repeat(3,150px)] items-center border-b border-border px-4 py-4 last:border-b-0">
                  <div className="min-w-0"><div className="truncate text-sm font-medium text-foreground">{account.name}</div><div className="mt-1 text-xs text-muted-foreground">{accountMembers.length} user{accountMembers.length === 1 ? '' : 's'}</div></div>
                  <div className="min-w-0 space-y-1">{accountMembers.slice(0, 3).map((member) => <div key={member.user_id} className="truncate text-xs text-muted-foreground">{member.full_name || member.email} <span className="text-muted-foreground/70">· {member.account_role}</span></div>)}{accountMembers.length > 3 ? <div className="text-xs text-muted-foreground">+{accountMembers.length - 3} more</div> : null}</div>
                  {FEATURES.map(([key]) => {
                    const active = enabled(account.id, key)
                    const busy = working === `feature:${account.id}:${key}`
                    return <button key={key} type="button" disabled={busy} onClick={() => void toggleFeature(account.id, key)} className={active ? 'mx-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary disabled:opacity-50' : 'mx-auto rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground disabled:opacity-50'}>{busy ? 'Saving…' : active ? 'Enabled' : 'Off'}</button>
                  })}
                </div>
              })}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">SutraAPI admin users</h2>
            <p className="mt-1 text-sm text-muted-foreground">These are normal SutraAPI/SutraCRM users. Granting platform-admin access lets them manage client feature access.</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            {users.map((user) => {
              const isAdmin = adminIds.has(user.id)
              const busy = working === `admin:${user.id}`
              return <div key={user.id} className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
                <div className="min-w-0"><div className="truncate text-sm font-medium text-foreground">{user.full_name || 'Unnamed user'}</div><div className="truncate text-xs text-muted-foreground">{user.email}</div></div>
                <button type="button" disabled={busy} onClick={() => void toggleAdmin(user.id)} className={isAdmin ? 'shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary disabled:opacity-50' : 'shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50'}>{busy ? 'Saving…' : isAdmin ? 'SutraAPI Admin' : 'Make Admin'}</button>
              </div>
            })}
          </div>
        </section>
      </> : null}
    </div>
  )
}
