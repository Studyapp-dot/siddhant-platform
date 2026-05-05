'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createNotification } from '@/app/actions/notifications'

export async function postUserMessage(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const target_username = formData.get('target_username') as string;
  const content = formData.get('content') as string;
  const parent_id = formData.get('parent_id') as string | null;

  // ── Content Validation ──
  const trimmed = content?.trim();
  if (!trimmed || trimmed.length < 3) {
    throw new Error('Message must be at least 3 characters.');
  }
  if (trimmed.length > 2000) {
    throw new Error('Message must be under 2000 characters.');
  }

  // Resolve target user ID from username
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', target_username)
    .single();

  if (!targetProfile) {
    throw new Error('Target user not found.');
  }

  // ── Rate Limiting: 20 messages per hour per user ──
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from('user_discussions')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .gte('created_at', oneHourAgo);

  if (recentCount !== null && recentCount >= 20) {
    throw new Error('You have reached the message limit (20 per hour). Please try again later.');
  }

  // ── Insert Message ──
  const { error } = await supabase.from('user_discussions').insert({
    target_user_id: targetProfile.id,
    author_id: user.id,
    content: trimmed,
    parent_id: parent_id || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  // ── Notification: Alert the target user (unless posting to own page) ──
  if (targetProfile.id !== user.id) {
    try {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      const senderName = senderProfile?.username || 'Someone';
      const preview = trimmed.length > 100 ? trimmed.substring(0, 100) + '…' : trimmed;

      await createNotification(
        targetProfile.id,
        'discussion_message',
        `@${senderName} left a message on your discussion page`,
        preview,
        `/profile/${target_username}/discussions`,
        user.id,
        'user_discussion',
      );
    } catch (err) {
      // Non-blocking: notification failure should not break the message post
      console.error('[user-discussions] Failed to send notification:', err);
    }
  }

  revalidatePath(`/profile/${target_username}/discussions`);
}
