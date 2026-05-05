import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import AuthForm from './AuthForm'
import Link from 'next/link'
import { use } from 'react'
import './login.css'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = use(searchParams);
  const error = params.error;

  return (
    <div className="login-page">
      <div className="auth-background-glow"></div>
      
      <div className="auth-container">
        <header className="auth-header-minimal">
          <Link href="/" className="auth-logo">
            <div className="auth-logo-icon">§</div>
            <span>Siddhant</span>
          </Link>
          <p className="auth-institutional-line">The Living Memory of Indian Law</p>
        </header>

        <AuthForm error={error} />
        
        <footer className="auth-footer-minimal">
          <Link href="/" className="back-link">
            <span className="back-icon">←</span> Back to the Archive
          </Link>
        </footer>
      </div>
    </div>
  )
}
