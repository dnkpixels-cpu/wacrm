import { decrypt } from '@/lib/whatsapp/encryption'

const BASE_URL = 'https://api-prod-new.tagmango.com'

type TagMangoConfig = {
  api_key_encrypted: string
  whitelabel_host: string
  timezone_offset_minutes?: number
}

export type TagMangoCall = {
  _id: string
  title?: string
  fromTime: string
  toTime?: string
  status?: string
  platform?: string
  meetingUrl?: string
  mango?: { _id: string; title?: string }
  creator?: { _id?: string; name?: string; email?: string }
}

async function request<T>(config: TagMangoConfig, path: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${decrypt(config.api_key_encrypted)}`,
      'x-whitelabel-host': config.whitelabel_host,
      'x-timezone-offset': String(config.timezone_offset_minutes ?? 330),
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const text = await response.text()
  let payload: unknown = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = text }

  if (!response.ok) {
    throw new Error(`TagMango API ${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`)
  }

  return payload as T
}

export async function listUpcomingVideoCalls(config: TagMangoConfig, startDate: Date, endDate: Date) {
  const payload = await request<{ total?: number; data?: Array<{ date: string; calls?: TagMangoCall[] }> }>(
    config,
    '/api/v1/external/workshops/video-calls',
    {
      limit: 100,
      page: 1,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  )

  return (payload?.data ?? []).flatMap((day) => day.calls ?? [])
}
