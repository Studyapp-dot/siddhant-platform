'use server';

import { createClient } from '@/utils/supabase/server';

// ============================================================================
// SIDDHANT: Notification System — Server Actions
//
// Lightweight in-app notifications using 60-second polling.
// Uses RPC (SECURITY DEFINER) to bypass RLS for cross-user notification
// creation (e.g., notifying a parent author when someone replies).
//
// Notification types:
//   group_reply          — someone replied to your forum post
//   mentor_request       — someone requested a mentor (sent to coordinators)
//   mentor_accepted      — your mentor request was accepted
//   coordinator_promoted — you were promoted to coordinator
//   group_mention        — someone mentioned you in a group post (Phase 5)
// ============================================================================


/**
 * Create a notification for a user.
 * Uses the create_notification RPC to bypass RLS.
 * Internal use only — called by other server actions, not by clients directly.
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string,
  sourceId?: string,
  sourceType?: string,
) {
  const supabase = await createClient();

  try {
    const { error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_body: body || null,
      p_link: link || null,
      p_source_id: sourceId || null,
      p_source_type: sourceType || null,
    });

    if (error) {
      console.error('[notifications] Failed to create notification:', error);
    }
  } catch (err) {
    console.error('[notifications] Exception creating notification:', err);
  }
}


/**
 * Get unread notifications for the current user.
 * Returns the most recent 20 unread notifications.
 */
export async function getUnreadNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { notifications: [], count: 0 };

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[notifications] Failed to fetch unread:', error);
    return { notifications: [], count: 0 };
  }

  return {
    notifications: data || [],
    count: data?.length || 0,
  };
}


/**
 * Get the count of unread notifications for the current user.
 * Lightweight query for the notification bell badge.
 */
export async function getNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('[notifications] Failed to count:', error);
    return 0;
  }

  return count || 0;
}


/**
 * Get recent notifications (read + unread) for the dropdown panel.
 * Returns the most recent 30 notifications.
 */
export async function getRecentNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('[notifications] Failed to fetch recent:', error);
    return [];
  }

  return data || [];
}


/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id);
}


/**
 * Mark all notifications as read for the current user.
 */
export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);
}
