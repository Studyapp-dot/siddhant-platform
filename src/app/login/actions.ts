'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const payload = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(payload)

  if (error) {
    redirect('/login?error=Invalid email or password.')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const username = formData.get('username') as string || email.split('@')[0]

  const payload = {
    email: email,
    password: formData.get('password') as string,
    options: {
      data: {
        username: username, 
      }
    }
  }

  const { data, error } = await supabase.auth.signUp(payload)

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (data.user && data.user.identities && data.user.identities.length === 0) {
    redirect(`/login?error=${encodeURIComponent('Email already in use. Please log in.')}`)
  }

  // Supabase "Confirm Email" default setting check
  if (!data.session) {
    redirect(`/login?error=${encodeURIComponent('Sign up successful! But Supabase "Confirm Email" is ON. Check your email or turn it off in Supabase Email Auth Settings.')}`)
  }

  revalidatePath('/', 'layout')
  // New users go to onboarding, not dashboard
  redirect('/welcome')
}

export async function signout() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await supabase.auth.signOut()
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
