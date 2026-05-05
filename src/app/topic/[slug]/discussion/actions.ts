'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/** Thread types that support answer/reply distinction */
const ANSWER_THREAD_TYPES = ['question', 'interpretation'];

export async function submitComment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const slug = formData.get('slug') as string;
  const node_id = formData.get('node_id') as string;
  const content = formData.get('content') as string;
  const parent_id = formData.get('parent_id') as string | null;
  const thread_type = formData.get('thread_type') as string | null;
  const reference_text = formData.get('reference_text') as string | null;
  const reference_type = formData.get('reference_type') as string | null;
  const response_type_override = formData.get('response_type') as string | null;

  const insertData: Record<string, unknown> = {
    node_id: node_id,
    author_id: user.id,
    content: content,
    parent_id: parent_id || null,
  };

  // Only set thread_type for root-level posts (replies inherit from parent)
  if (!parent_id && thread_type && ['question', 'interpretation', 'improvement', 'issue'].includes(thread_type)) {
    insertData.thread_type = thread_type;
  }

  // Determine response_type: for Question/Interpretation threads,
  // first-level replies are 'answer', deeper replies are 'reply'
  if (parent_id && response_type_override) {
    insertData.response_type = response_type_override;
  } else if (parent_id) {
    // Fetch the parent to determine depth and thread type
    const { data: parent } = await supabase
      .from('discussions')
      .select('parent_id, thread_type')
      .eq('id', parent_id)
      .single();

    if (parent) {
      const parentThreadType = parent.thread_type || 'general';
      const isDirectReplyToRoot = !parent.parent_id; // parent has no parent → this is a first-level reply
      if (isDirectReplyToRoot && ANSWER_THREAD_TYPES.includes(parentThreadType)) {
        insertData.response_type = 'answer';
      } else {
        insertData.response_type = 'reply';
      }
    }
  }

  // Reference support (root threads + answers only)
  // Minimum 10 characters to prevent low-quality fake references
  if (reference_text && reference_text.trim().length >= 10) {
    insertData.reference_text = reference_text.trim();
    if (reference_type && ['case', 'section', 'article', 'statute', 'commentary'].includes(reference_type)) {
      insertData.reference_type = reference_type;
    }
  }

  const { error } = await supabase.from('discussions').insert(insertData);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/topic/${slug}/discussion`);
  revalidatePath(`/topic/${slug}`);
}

/**
 * Close a discussion thread — Level 4+ (Senior Scholar, Steward, Governance Council) only.
 * The closer must NOT have participated in the discussion.
 * A specific closing summary is required (not just "consensus reached").
 * 
 * Research.md: "the person who closes a discussion must not have participated
 * in it — this is an absolute rule with no exceptions."
 */
export async function closeDiscussion(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const slug = formData.get('slug') as string;
  const discussion_id = formData.get('discussion_id') as string;
  const closing_summary = formData.get('closing_summary') as string;

  if (!closing_summary || closing_summary.trim().length < 50) {
    throw new Error('Closing summary must be specific and at least 50 characters. Not just "consensus reached" — explain what arguments were found persuasive and why.');
  }

  // Verify user is Level 4+ (Senior Scholar, Steward, or Governance Council)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['senior_scholar', 'steward', 'governance_council'].includes(profile.role)) {
    throw new Error('Only Senior Scholars (Level 4+) can close discussions.');
  }

  // Get the root discussion — if discussion_id refers to a reply, find the top-level parent
  const { data: discussion } = await supabase
    .from('discussions')
    .select('id, node_id, parent_id')
    .eq('id', discussion_id)
    .single();

  if (!discussion) {
    throw new Error('Discussion not found.');
  }

  // Find the top-level thread if this is a reply
  let rootId = discussion.id;
  if (discussion.parent_id) {
    rootId = discussion.parent_id;
  }

  // Check non-participation: the closer must not have authored any comment in this thread.
  // Uses recursive CTE to traverse ALL descendants (not just first-level replies).
  const { data: allThreadComments } = await supabase.rpc('get_thread_participants', {
    p_root_id: rootId,
  });

  const participants = new Set((allThreadComments ?? []).map((c: { author_id: string }) => c.author_id));
  if (participants.has(user.id)) {
    throw new Error('You cannot close a discussion you participated in. This is an absolute rule with no exceptions — the closer must be someone who stayed out of the discussion.');
  }

  // Impact summary (optional — "What changed due to this discussion?")
  const impact_summary = formData.get('impact_summary') as string | null;

  // Award reputation to discussion participants whose comments were cited in the consensus.
  //
  // Selective citation: if `cited_users` is provided (JSON array of user IDs),
  // only award +5 rep to those specific participants. This replaces the
  // "carpet-bomb" approach that rewarded every participant equally — including
  // low-effort "+1" and "I agree" posts.
  //
  // Backward compatibility: if `cited_users` is not provided (old frontend),
  // falls back to awarding all participants.
  const uniqueParticipants = [...new Set((allThreadComments ?? []).map((c: { author_id: string }) => c.author_id))] as string[];
  const citedUsersRaw = formData.get('cited_users') as string | null;
  let awardees: string[];

  if (citedUsersRaw) {
    try {
      const citedUsers = JSON.parse(citedUsersRaw) as string[];
      // Validate: cited users must be actual participants in this thread
      const validCitations = citedUsers.filter(
        (id: string) => uniqueParticipants.includes(id) && id !== user.id
      );
      if (validCitations.length === 0) {
        throw new Error('You must cite at least one participant whose arguments contributed to the consensus.');
      }
      awardees = validCitations;
    } catch (e: any) {
      if (e.message.includes('cite at least one')) throw e;
      throw new Error('Invalid cited_users format. Expected a JSON array of user IDs.');
    }
  } else {
    // Backward compatibility: award all participants (will be removed once frontend is updated)
    awardees = uniqueParticipants.filter((id: string) => id !== user.id);
  }

  // Close the top-level discussion via RPC (bypasses missing UPDATE policy)
  const { error } = await supabase.rpc('close_discussion', {
    p_discussion_id: rootId,
    p_closer_id: user.id,
    p_closing_summary: closing_summary.trim(),
    p_cited_participants: awardees,
    p_impact_summary: impact_summary?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  for (const participantId of awardees) {
    try {
      await supabase.rpc('award_reputation_points', {
        p_user_id: participantId,
        p_event_type: 'discussion_cited',
        p_points: 5,
        p_source_id: rootId,
        p_source_type: 'discussion',
        p_description: 'Discussion contribution cited in closing consensus summary',
      });
    } catch (e) {
      // Don't fail the close if rep award fails — log and continue
      console.error('[close-discussion] Failed to award rep to:', participantId, e);
    }
  }

  revalidatePath(`/topic/${slug}/discussion`);
  revalidatePath(`/topic/${slug}/community`);
  revalidatePath(`/topic/${slug}`);
}
