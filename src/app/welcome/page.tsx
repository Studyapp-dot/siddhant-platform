import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import WelcomeFlow from './WelcomeFlow'
import './welcome.css'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Scholar'

  return <WelcomeFlow username={username} />
}
