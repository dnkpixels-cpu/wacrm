'use client'

import { useEffect, useState } from 'react'
import { Check, LockKeyhole } from 'lucide-react'

const FEATURE_COPY: Record<string, { title: string; description: string }> = {
  sessions: {
    title: 'Sessions',
    description: 'Live sessions, participant links and attendance tracking.',
  },
  tagmango: {
    title: 'TagMango integration',
    description: 'Import upcoming TagMango sessions and their service mapping.',
  },
  session_reminders: {
    title: 'Session reminders',
    description: 'Send the approved WhatsApp session reminder automatically.',
  },
}

export function FeaturesPanel() {
  const [features, setFeatures] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/features/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load features')
        const data = (await response.json()) as { features?: string[] }
        setFeatures(data.features ?? [])
      })
      .catch(() => setFeatures([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Features</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Modules available to this SutraAPI workspace. Restricted modules are enabled by the SutraAPI team.
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(FEATURE_COPY).map(([key, copy]) => {
          const enabled = features.includes(key)
          return (
            <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{copy.title}</p>
                  {enabled ? <Check className="h-4 w-4 text-primary" /> : <LockKeyhole className="h-4 w-4 text-muted-foreground" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{copy.description}</p>
              </div>
              <span className={enabled ? 'rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary' : 'rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'}>
                {loading ? 'Checking…' : enabled ? 'Enabled' : 'Not enabled'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
