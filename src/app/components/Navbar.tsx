'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import './Navbar.css';

interface NavbarProps {
  user: {
    username: string;
    displayName?: string;
    profilePhoto?: string | null;
    profileUrl: string;
  } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();

  const links = [
    { label: 'Knowledge Archive', href: '/nodes' },
    { label: 'Communities', href: '/groups', pulse: true },
    { label: 'Chronicle', href: '/recent-changes' },
    { label: 'Recognition', href: '/recognition' },
  ];

  const mobileLinks = [
    { label: 'Archive', href: '/nodes', icon: 'A' },
    { label: 'Chronicle', href: '/recent-changes', icon: 'C' },
    { label: 'Communities', href: '/groups', icon: 'M' },
    { label: 'Recognition', href: '/recognition', icon: 'R' },
    { label: 'Desk', href: '/dashboard', icon: 'D' },
  ];

  const isActive = (href: string) => (
    pathname === href || (href !== '/' && pathname?.startsWith(`${href}/`))
  );

  const isOnboarding = pathname === '/welcome';

  return (
    <>
    <nav className={`navbar-container${isOnboarding ? ' navbar-onboarding' : ''}`}>
      <div className="navbar-inner">
        {/* LOGO */}
        <Link href="/" className="navbar-logo">
          <div className="navbar-logo-icon">S</div>
          <span className="navbar-logo-text">Siddhant</span>
        </Link>

        {/* NAVIGATION LINKS */}
        <div className="navbar-links">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              className={`navbar-link ${isActive(link.href) ? 'active' : ''}`}
            >
              {link.label}
              {link.pulse && <span className="navbar-pulse-dot" />}
            </Link>
          ))}
        </div>

        {/* USER ACTIONS */}
        <div className="navbar-actions">
          {user && <NotificationBell />}
          <UserMenu user={user} />
        </div>
      </div>
    </nav>

    <nav className={`mobile-bottom-nav${isOnboarding ? ' mobile-nav-hidden' : ''}`} aria-label="Primary mobile navigation">
      {mobileLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`mobile-bottom-link ${isActive(link.href) ? 'active' : ''}`}
        >
          <span className="mobile-bottom-icon" aria-hidden="true">{link.icon}</span>
          <span className="mobile-bottom-label">{link.label}</span>
        </Link>
      ))}
    </nav>
    </>
  );
}
