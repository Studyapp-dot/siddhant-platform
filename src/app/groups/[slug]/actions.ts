'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { awardReputation } from '@/app/actions/reputation'
import { createNotification } from '@/app/actions/notifications'

/**
 * Post a message in a group forum.
 * Research: Non-members can post in Mentoring and General rooms (open rooms).
 * Coordination and Announcement rooms are member-only.
 */
export async function postGroupMessage(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const group_slug = formData.get('group_slug') as string;
  const content = formData.get('content') as string;
  const thread_type = formData.get('thread_type') as string || 'general';
  const parent_id = formData.get('parent_id') as string | null;

  // Resolve group ID
  const { data: group } = await supabase
    .from('subject_groups')
    .select('id')
    .eq('slug', group_slug)
    .single();

  if (!group) {
    throw new Error('Group not found.');
  }

  // Check membership for member-only rooms
  const memberOnlyRooms = ['coordination', 'announcement'];
  if (memberOnlyRooms.includes(thread_type)) {
    const { data: membership } = await supabase
      .from('subject_group_members')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('group_id', group.id)
      .maybeSingle();

    if (!membership) {
      throw new Error('You must be a group member to post in this space.');
    }
  }

  const { error, data: newPost } = await supabase.from('group_discussions').insert({
    group_id: group.id,
    author_id: user.id,
    content: content.trim(),
    thread_type,
    parent_id: parent_id || null,
  }).select('id').single();

  if (error) {
    throw new Error(error.message);
  }

  // ── Ecosystem Integration (Phase 1) ──

  // Award reputation for substantive top-level posts only.
  // No points for replies or short posts — prevents forum spam farming.
  if (!parent_id && content.trim().length >= 50) {
    try {
      await awardReputation(
        user.id,
        'group_post_created',
        newPost?.id,
        'group_discussion',
        `Forum post in ${group_slug}`,
      );
    } catch (err) {
      console.error('[groups/actions] Failed to award group post reputation:', err);
    }
  }

  // Notify the parent post author when someone replies
  if (parent_id) {
    try {
      const { data: parentPost } = await supabase
        .from('group_discussions')
        .select('author_id')
        .eq('id', parent_id)
        .single();

      // Don't notify yourself
      if (parentPost && parentPost.author_id !== user.id) {
        const { data: actorProfile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        const { data: groupData } = await supabase
          .from('subject_groups')
          .select('name')
          .eq('slug', group_slug)
          .single();

        await createNotification(
          parentPost.author_id,
          'group_reply',
          `@${actorProfile?.username || 'Someone'} replied to your post`,
          content.trim().substring(0, 120),
          `/groups/${group_slug}`,
          newPost?.id,
          'group_discussion',
        );
      }
    } catch (err) {
      console.error('[groups/actions] Failed to create reply notification:', err);
    }
  }

  revalidatePath(`/groups/${group_slug}`);
}

/**
 * Pin or unpin a thread — coordinators and admins only.
 */
export async function pinThread(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const thread_id = formData.get('thread_id') as string;
  const group_slug = formData.get('group_slug') as string;
  const pinned = formData.get('pinned') === 'true';

  const { error } = await supabase
    .from('group_discussions')
    .update({ pinned })
    .eq('id', thread_id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/groups/${group_slug}`);
}

export async function joinGroup(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const group_slug = formData.get('group_slug') as string;

  const { data: group } = await supabase
    .from('subject_groups')
    .select('id')
    .eq('slug', group_slug)
    .single();

  if (!group) {
    throw new Error('Group not found.');
  }

  const { error } = await supabase.from('subject_group_members').insert({
    user_id: user.id,
    group_id: group.id,
    role: 'member',
  });

  if (error && !error.message.includes('duplicate')) {
    throw new Error(error.message);
  }

  revalidatePath(`/groups/${group_slug}`);
  revalidatePath('/groups');
}

export async function leaveGroup(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const group_slug = formData.get('group_slug') as string;

  const { data: group } = await supabase
    .from('subject_groups')
    .select('id')
    .eq('slug', group_slug)
    .single();

  if (!group) {
    throw new Error('Group not found.');
  }

  const { error } = await supabase.from('subject_group_members')
    .delete()
    .eq('user_id', user.id)
    .eq('group_id', group.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/groups/${group_slug}`);
  revalidatePath('/groups');
}

export async function associateReport(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const group_slug = formData.get('group_slug') as string;
  const node_identifier = formData.get('node_identifier') as string; // can be slug or URL

  // Extract slug if it's a URL
  let node_slug = node_identifier.trim();
  try {
    const url = new URL(node_slug);
    const parts = url.pathname.split('/');
    if (parts.includes('topic')) {
      node_slug = parts[parts.indexOf('topic') + 1];
    }
  } catch (e) {
    // Not a valid URL, treat as slug
  }

  // Find the group
  const { data: group } = await supabase
    .from('subject_groups')
    .select('id')
    .eq('slug', group_slug)
    .single();

  if (!group) throw new Error('Group not found.');

  // Check if user is a member (policy requires membership)
  const { data: membership } = await supabase
    .from('subject_group_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('group_id', group.id)
    .maybeSingle();

  if (!membership) throw new Error('You must be a group member to associate a Report.');
  
  // Coordinator restriction removed here to allow mentors/members to add, 
  // but RLS restricts delete to coordinators.

  // Find the node
  const { data: node } = await supabase
    .from('nodes')
    .select('id')
    .eq('slug', node_slug)
    .single();

  if (!node) throw new Error('Report not found. Please check the URL or slug.');

  // Create association
  const { error } = await supabase.from('group_node_associations').insert({
    group_id: group.id,
    node_id: node.id,
    added_by: user.id
  });

  if (error && !error.message.includes('duplicate')) {
    throw new Error(error.message);
  }

  revalidatePath(`/groups/${group_slug}`);
}

export async function removeReportAssociation(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const group_slug = formData.get('group_slug') as string;
  const node_id = formData.get('node_id') as string;

  // Find the group
  const { data: group } = await supabase
    .from('subject_groups')
    .select('id')
    .eq('slug', group_slug)
    .single();

  if (!group) throw new Error('Group not found.');

  // RLS policy handles checking if the user is a coordinator/mentor
  const { error } = await supabase
    .from('group_node_associations')
    .delete()
    .eq('group_id', group.id)
    .eq('node_id', node_id);

  if (error) throw new Error(error.message);

  revalidatePath(`/groups/${group_slug}`);
}
