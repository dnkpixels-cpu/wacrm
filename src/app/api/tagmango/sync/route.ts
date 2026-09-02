import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { isFeatureEnabled, requireFeature } from '@/lib/features'
import { syncTagMangoAccount } from '@/lib/integrations/tagmango-sync'

export async function POST(request: Request) {
  try {
    const { accountId } = await requireRole('agent')
    await requireFeature(accountId, 'tagmango')
    return NextResponse.json(await syncTagMangoAccount(accountId))
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function GET() {
  try {
    const { accountId } = await requireRole('agent')
    if (!(await isFeatureEnabled(accountId, 'tagmango'))) return NextResponse.json({ error: 'TagMango is not enabled for this workspace.' }, { status: 403 })
    return NextResponse.json({ ok: true, message: 'Use POST to sync upcoming sessions.' })
  } catch (error) {
    return toErrorResponse(error)
  }
}
