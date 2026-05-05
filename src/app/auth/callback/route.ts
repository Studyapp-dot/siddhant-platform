import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Determine if this is a first-time user
      // created_at and last_sign_in_at will be very close for brand-new accounts
      const createdAt = new Date(data.user.created_at).getTime()
      const lastSignIn = new Date(data.user.last_sign_in_at || data.user.created_at).getTime()
      const isNewUser = Math.abs(lastSignIn - createdAt) < 10000 // within 10 seconds

      if (isNewUser) {
        // New user → institutional onboarding
        return NextResponse.redirect(`${origin}/welcome`)
      }

      // Returning user → dashboard
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — return to login with error
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`)
}
