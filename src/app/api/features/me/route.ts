import { NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { getEnabledFeatures } from '@/lib/features'

export async function GET() {
  try {
    const { accountId } = await getCurrentAccount()
    return NextResponse.json({ features: await getEnabledFeatures(accountId) })
  } catch (error) {
    return toErrorResponse(error)
  }
}
