'use client'

import { useEffect, useState } from 'react'

export function TagMangoPanel() {
  const [host, setHost] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [reminders, setReminders] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/tagmango/config', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json() as { config?: { whitelabel_host?: string; enabled?: boolean; reminder_enabled?: boolean; dry_run?: boolean } }
        if (data.config) {
          setHost(data.config.whitelabel_host ?? '')
          setEnabled(data.config.enabled ?? true)
          setReminders(data.config.reminder_enabled ?? false)
          setDryRun(data.config.dry_run ?? true)
        }
      })
      .catch(() => undefined)
  }, [])

  const save = async () => {
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch('/api/tagmango/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whitelabel_host: host, api_key: apiKey, enabled, reminder_enabled: reminders, dry_run: dryRun, reminder_minutes_before: 60, timezone_offset_minutes: 330 }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error || 'Could not save TagMango settings.')
      setApiKey('')
      setStatus('TagMango settings saved.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save TagMango settings.')
    } finally {
      setBusy(false)
    }
  }

  const sync = async () => {
    setBusy(true)
    setStatus('Syncing upcoming TagMango sessions…')
    try {
      const response = await fetch('/api/tagmango/sync', { method: 'POST' })
      const data = await response.json() as { synced?: number; error?: string }
      if (!response.ok) throw new Error(data.error || 'Sync failed.')
      setStatus(`Sync complete. ${data.synced ?? 0} session(s) synced.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Sync failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">TagMango</h2>
        <p className="mt-1 text-sm text-muted-foreground">Connect a TagMango creator account to import upcoming live sessions.</p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-5">
        <label className="block text-sm font-medium text-foreground">Whitelabel host<input value={host} onChange={(e) => setHost(e.target.value)} placeholder="yourhost.tagmango.com" className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
        <label className="block text-sm font-medium text-foreground">API key<input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="Leave blank to keep the saved key" className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Connection enabled</label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} /> Send session reminders</label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> Dry-run reminders (recommended for testing)</label>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? 'Saving…' : 'Save settings'}</button>
          <button type="button" onClick={() => void sync()} disabled={busy || !enabled} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60">Sync upcoming sessions</button>
        </div>
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      </div>
    </div>
  )
}
