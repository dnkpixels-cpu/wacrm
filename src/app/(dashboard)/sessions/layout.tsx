import { redirect } from 'next/navigation'
import { getCurrentAccount } from '@/lib/auth/account'
import { isFeatureEnabled } from '@/lib/features'

export default async function SessionsLayout({ children }: { children: React.ReactNode }) {
  const { accountId } = await getCurrentAccount()
  if (!(await isFeatureEnabled(accountId, 'sessions'))) redirect('/dashboard')
  return children
}
