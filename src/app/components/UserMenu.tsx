'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { signout } from '../login/actions';

interface UserMenuProps {
  user: {
    username: string;
    profileUrl: string;
  } | null;
}

export default function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) {
    return (
      <Link href="/login" className="lp-nav-cta">
        Sign In
      </Link>
    );
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="user-menu-avatar">
          {user.username.charAt(0).toUpperCase()}
        </span>
        <span className="user-menu-name">{user.username}</span>
        <span className={`user-menu-chevron ${open ? 'open' : ''}`}>v</span>
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <Link
            href={user.profileUrl}
            className="user-menu-item"
            onClick={() => setOpen(false)}
          >
            <span className="user-menu-item-icon">P</span>
            My Profile
          </Link>
          <Link
            href="/dashboard"
            className="user-menu-item"
            onClick={() => setOpen(false)}
          >
            <span className="user-menu-item-icon">D</span>
            Scholar&apos;s Desk
          </Link>
          <div className="user-menu-divider" />
          <form action={signout}>
            <button type="submit" className="user-menu-item user-menu-signout">
              <span className="user-menu-item-icon">O</span>
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
