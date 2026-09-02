import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { getEnabledFeatures } from '@/lib/features'

export async function GET() {
  try {
    const { accountId } = await requireRole('agent')
    const features = await getEnabledFeatures(accountId)
    return NextResponse.json({ features })
  } catch (error) {
    return toErrorResponse(error)
  }
}
