import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'
  return value
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNextPath(url.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(new URL('/forgot-password?error=invalid-reset-link', url.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] code exchange failed:', error)
    return NextResponse.redirect(new URL('/forgot-password?error=invalid-reset-link', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
