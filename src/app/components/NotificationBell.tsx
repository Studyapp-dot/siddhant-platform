'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getRecentNotifications,
  getNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/app/actions/notifications';

// ============================================================================
// SIDDHANT: Notification Bell — Phase 1E
//
// Lightweight polling-based notification system (60s interval).
// Displays unread count badge + dropdown panel with recent notifications.
// Designed to match Siddhant's premium scholarly aesthetic.
//
// Future: migrate to Supabase Realtime when scale justifies complexity.
// ============================================================================

const POLL_INTERVAL = 60_000; // 60 seconds

// Notification type metadata
const NOTIFICATION_META: Record<string, { icon: string; color: string }> = {
  group_reply:          { icon: '💬', color: '#8b5cf6' },
  mentor_request:       { icon: '🎓', color: '#f59e0b' },
  mentor_accepted:      { icon: '🤝', color: '#34d399' },
  coordinator_promoted: { icon: '👑', color: '#b8963e' },
  group_mention:        { icon: '@',  color: '#3b82f6' },
};

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Poll for unread count
  const pollCount = useCallback(async () => {
    try {
      const c = await getNotificationCount();
      setCount(c);
    } catch {
      // Silent fail — notifications are non-critical
    }
  }, []);

  useEffect(() => {
    pollCount();
    const interval = setInterval(pollCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollCount]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch full notifications when panel opens
  const handleToggle = async () => {
    const willOpen = !open;
    setOpen(willOpen);

    if (willOpen) {
      setLoading(true);
      try {
        const items = await getRecentNotifications();
        setNotifications(items as Notification[]);
      } catch {
        setNotifications([]);
      }
      setLoading(false);
    }
  };

  // Click a notification → mark read + navigate
  const handleClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
      setCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    setOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  // Mark all as read
  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  // Relative time formatter
  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="notif-bell-container" ref={panelRef}>
      <button
        className="notif-bell-trigger"
        onClick={handleToggle}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
        aria-expanded={open}
      >
        {/* Bell SVG */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread badge */}
        {count > 0 && (
          <span className="notif-bell-badge">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            {count > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAll}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-panel-list">
            {loading ? (
              <div className="notif-empty">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">No notifications yet</div>
            ) : (
              notifications.map((notif) => {
                const meta = NOTIFICATION_META[notif.type] || { icon: '📢', color: 'var(--text-muted)' };
                return (
                  <button
                    key={notif.id}
                    className={`notif-item ${!notif.is_read ? 'unread' : ''}`}
                    onClick={() => handleClick(notif)}
                  >
                    <span className="notif-item-icon" style={{ color: meta.color }}>
                      {meta.icon}
                    </span>
                    <div className="notif-item-content">
                      <div className="notif-item-title">{notif.title}</div>
                      {notif.body && (
                        <div className="notif-item-body">{notif.body}</div>
                      )}
                      <div className="notif-item-time">{relativeTime(notif.created_at)}</div>
                    </div>
                    {!notif.is_read && <span className="notif-item-dot" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
