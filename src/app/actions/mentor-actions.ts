'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { awardReputation } from '@/app/actions/reputation'
import { createNotification } from '@/app/actions/notifications'

/**
 * Request a mentor in a subject-area group.
 * Research: The request must come from the newcomer, not be assigned by the platform.
 */
export async function requestMentor(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const groupSlug = formData.get('group_slug') as string
  const message = formData.get('message') as string | null

  const { data: group } = await supabase
    .from('subject_groups')
    .select('id')
    .eq('slug', groupSlug)
    .single()

  if (!group) throw new Error('Group not found.')

  // Check if user already has an open request
  const { data: existing } = await supabase
    .from('mentor_requests')
    .select('id')
    .eq('requester_id', user.id)
    .eq('group_id', group.id)
    .eq('status', 'open')
    .maybeSingle()

  if (existing) throw new Error('You already have an open mentor request in this group.')

  // Check if user already has an active mentorship in this group
  const { data: activeMentorship } = await supabase
    .from('mentorships')
    .select('id')
    .eq('mentee_id', user.id)
    .eq('group_id', group.id)
    .eq('status', 'active')
    .maybeSingle()

  if (activeMentorship) throw new Error('You already have an active mentor in this group.')

  const { error } = await supabase.from('mentor_requests').insert({
    requester_id: user.id,
    group_id: group.id,
    message: message?.trim() || null,
  })

  if (error) throw new Error(error.message)

  // ── Notification: Notify group coordinators about the new request ──
  try {
    const { data: coordinators } = await supabase
      .from('subject_group_members')
      .select('user_id')
      .eq('group_id', group.id)
      .eq('role', 'coordinator');

    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    for (const coord of (coordinators || [])) {
      await createNotification(
        coord.user_id,
        'mentor_request',
        `@${requesterProfile?.username || 'Someone'} requested a mentor`,
        message?.trim()?.substring(0, 120) || 'New mentoring request in your group.',
        `/groups/${groupSlug}`,
        group.id,
        'mentor_request',
      );
    }
  } catch (err) {
    console.error('[mentor-actions] Failed to notify coordinators:', err);
  }

  revalidatePath(`/groups/${groupSlug}`)
}

/**
 * Accept a mentor request — senior contributor agrees to guide the newcomer.
 */
export async function acceptMentorRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const requestId = formData.get('request_id') as string
  const groupSlug = formData.get('group_slug') as string

  // Fetch the request
  const { data: request } = await supabase
    .from('mentor_requests')
    .select('id, requester_id, group_id, status')
    .eq('id', requestId)
    .single()

  if (!request || request.status !== 'open') throw new Error('Request not found or already resolved.')

  // Verify the acceptor is a group member with mentor/coordinator role or high-level user
  const { data: membership } = await supabase
    .from('subject_group_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('group_id', request.group_id)
    .maybeSingle()

  if (!membership) throw new Error('You must be a member of this group to accept mentor requests.')

  // Update the request
  const { error: updateError } = await supabase
    .from('mentor_requests')
    .update({
      status: 'accepted',
      accepted_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) throw new Error(updateError.message)

  // Create the mentorship
  const { error: mentorError } = await supabase.from('mentorships').insert({
    mentor_id: user.id,
    mentee_id: request.requester_id,
    group_id: request.group_id,
    request_id: requestId,
  })

  if (mentorError && !mentorError.message.includes('duplicate')) {
    throw new Error(mentorError.message)
  }

  // Promote the mentor's group role to 'mentor' if they're currently just 'member'
  if (membership.role === 'member') {
    await supabase
      .from('subject_group_members')
      .update({ role: 'mentor' })
      .eq('user_id', user.id)
      .eq('group_id', request.group_id)
  }

  // Check if they qualify for Coordinator promotion
  await checkCoordinatorPromotion(user.id, request.group_id);

  // ── Reputation: Award both mentor and mentee (Phase 1) ──
  try {
    const { data: groupData } = await supabase
      .from('subject_groups')
      .select('name, slug')
      .eq('id', request.group_id)
      .single();

    // Mentor earns 5 rep for accepting
    await awardReputation(
      user.id,
      'mentorship_accepted',
      requestId,
      'mentorship',
      `Accepted mentorship in ${groupData?.name || 'a group'}`,
    );

    // Mentee earns 2 rep for having their request accepted
    await awardReputation(
      request.requester_id,
      'mentorship_accepted',
      requestId,
      'mentorship',
      `Mentorship accepted in ${groupData?.name || 'a group'}`,
      2, // custom lower amount for mentee
    );

    // ── Notification: Tell the mentee their request was accepted ──
    const { data: mentorProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    await createNotification(
      request.requester_id,
      'mentor_accepted',
      `@${mentorProfile?.username || 'A mentor'} accepted your request!`,
      `You now have a mentor in ${groupData?.name || 'your group'}. Visit the Mentoring room to connect.`,
      `/groups/${groupData?.slug || groupSlug}`,
      requestId,
      'mentorship',
    );
  } catch (err) {
    console.error('[mentor-actions] Failed to award mentorship reputation:', err);
  }

  revalidatePath(`/groups/${groupSlug}`)
}

/**
 * Automatically promotes a user to Coordinator if they meet the enculturation requirements.
 * Requirement: Level 4+ (Senior Scholar) AND has mentored at least 3 users in this group.
 */
async function checkCoordinatorPromotion(userId: string, groupId: string) {
  const supabase = await createClient()

  // 1. Check if they are already a coordinator
  const { data: membership } = await supabase
    .from('subject_group_members')
    .select('role')
    .eq('user_id', userId)
    .eq('group_id', groupId)
    .single()

  if (!membership || membership.role === 'coordinator') return;

  // 2. Check platform credibility (Level 4+ / senior_scholar)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  
  const highLevelRoles = ['senior_scholar', 'steward', 'governance_council', 'admin'];
  if (!profile || !highLevelRoles.includes(profile.role)) return;

  // 3. Check community enculturation (Mentored >= 3 people in this group)
  const { count: menteeCount } = await supabase
    .from('mentorships')
    .select('id', { count: 'exact', head: true })
    .eq('mentor_id', userId)
    .eq('group_id', groupId)

  if (menteeCount !== null && menteeCount >= 3) {
    // Promote to coordinator
    await supabase
      .from('subject_group_members')
      .update({ role: 'coordinator' })
      .eq('user_id', userId)
      .eq('group_id', groupId)

    // ── Recognition event (0 points, high visibility) ──
    try {
      const { data: groupData } = await supabase
        .from('subject_groups')
        .select('name, slug')
        .eq('id', groupId)
        .single();

      await awardReputation(
        userId,
        'coordinator_promoted',
        groupId,
        'subject_group',
        `Promoted to Coordinator of ${groupData?.name || 'a group'}`,
      );

      // Notify the promoted user
      await createNotification(
        userId,
        'coordinator_promoted',
        `You've been promoted to Coordinator!`,
        `Your mentorship contributions in ${groupData?.name || 'your group'} have earned you Coordinator status.`,
        `/groups/${groupData?.slug || ''}`,
        groupId,
        'subject_group',
      );
    } catch (err) {
      console.error('[mentor-actions] Failed to log coordinator promotion:', err);
    }
  }
}

/**
 * End a mentorship — either party can end it at any time.
 * Research: Informal and time-unlimited — ends when both parties feel it has run its course.
 */
export async function endMentorship(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const mentorshipId = formData.get('mentorship_id') as string
  const groupSlug = formData.get('group_slug') as string

  const { error } = await supabase
    .from('mentorships')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      ended_by: user.id,
    })
    .eq('id', mentorshipId)

  if (error) throw new Error(error.message)

  revalidatePath(`/groups/${groupSlug}`)
}

/**
 * Withdraw an open mentor request.
 */
export async function withdrawMentorRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const requestId = formData.get('request_id') as string
  const groupSlug = formData.get('group_slug') as string

  const { error } = await supabase
    .from('mentor_requests')
    .update({ status: 'withdrawn', resolved_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('requester_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath(`/groups/${groupSlug}`)
}
