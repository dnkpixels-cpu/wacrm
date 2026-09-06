import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { requireFeature } from '@/lib/features'
import { syncTagMangoSessionRegistrations } from '@/lib/integrations/tagmango-sync'

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('admin')
    await requireFeature(accountId, 'tagmango')

    const body = await request.json().catch(() => null)
    const videoCallId = typeof body?.videoCallId === 'string' ? body.videoCallId.trim() : ''

    if (!videoCallId) {
      return NextResponse.json({ ok: false, error: 'videoCallId is required.' }, { status: 400 })
    }

    const result = await syncTagMangoSessionRegistrations(accountId, videoCallId)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return toErrorResponse(error)
  }
}
