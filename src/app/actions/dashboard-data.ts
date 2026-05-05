'use server';

import { createClient } from '@/utils/supabase/server';

// ============================================================================
// SIDDHANT: Dashboard Data — Server Actions
//
// Aggregation utilities for the Scholar Dashboard engagement layer.
// These provide the data foundation for:
//   - "Since your last visit" awareness
//   - Personal activity feed
//   - Watchlist delta detection
//   - Recognition summary
//   - Contribution prompts (framed as intellectual opportunities, not chores)
//
// Design philosophy (per manager directive):
//   - Scholarly, not operational
//   - High-signal, not noisy
//   - Opportunities, not task management
// ============================================================================


/**
 * Update the user's last_visit_at timestamp.
 * Called when the dashboard renders to track return frequency.
 * Uses a graceful fallback if the column doesn't exist yet.
 */
export async function updateLastVisit(userId: string): Promise<void> {
  const supabase = await createClient();
  try {
    await supabase
      .from('profiles')
      .update({ last_visit_at: new Date().toISOString() })
      .eq('id', userId);
  } catch (err) {
    // Column may not exist yet — migration not run. Non-blocking.
    console.error('[dashboard-data] Failed to update last_visit_at:', err);
  }
}


/**
 * Get the user's last visit timestamp.
 * Returns null if column doesn't exist or user has never visited.
 */
export async function getLastVisitAt(userId: string): Promise<string | null> {
  const supabase = await createClient();
  try {
    const { data } = await supabase
      .from('profiles')
      .select('last_visit_at')
      .eq('id', userId)
      .single();
    return data?.last_visit_at || null;
  } catch {
    return null;
  }
}


/**
 * Get the user's own recent activity (their contributions).
 * Returns the most recent revisions and discussions authored by the user.
 */
export async function getPersonalActivity(userId: string) {
  const supabase = await createClient();

  const [{ data: recentRevisions }, { data: recentDiscussions }] = await Promise.all([
    supabase
      .from('revisions')
      .select(`
        id, commit_message, created_at, is_revert, is_reverted,
        nodes!revisions_node_id_fkey ( title, slug )
      `)
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('discussions')
      .select(`
        id, content, created_at,
        nodes!discussions_node_id_fkey ( title, slug )
      `)
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  return {
    revisions: recentRevisions || [],
    discussions: recentDiscussions || [],
  };
}


/**
 * Get watched nodes with delta counts since last visit.
 * For each watched node, returns the number of new revisions since lastVisitAt.
 * This is the highest-leverage retention mechanism (per manager + Zhang 2025).
 */
export async function getWatchlistWithDeltas(userId: string, lastVisitAt: string | null) {
  const supabase = await createClient();

  // 1. Fetch watchlist with node details
  const { data: watchlist } = await supabase
    .from('watchlist')
    .select('nodes(id, title, slug)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!watchlist || watchlist.length === 0) {
    return [];
  }

  // 2. Extract node IDs
  const items = watchlist.map((entry: any) => {
    const nodeData = Array.isArray(entry.nodes) ? entry.nodes[0] : entry.nodes;
    return nodeData;
  }).filter(Boolean);

  const nodeIds = items.map((n: any) => n.id);

  // 3. If we have a lastVisitAt, count new revisions per node since then
  const deltas: Record<string, number> = {};
  if (lastVisitAt && nodeIds.length > 0) {
    const { data: recentRevisions } = await supabase
      .from('revisions')
      .select('node_id')
      .in('node_id', nodeIds)
      .gt('created_at', lastVisitAt);

    for (const rev of (recentRevisions || [])) {
      deltas[rev.node_id] = (deltas[rev.node_id] || 0) + 1;
    }
  }

  return items.map((node: any) => ({
    id: node.id,
    title: node.title,
    slug: node.slug,
    newEdits: deltas[node.id] || 0,
  }));
}


/**
 * Get recognition received since a given date.
 * Returns counts of endorsements and scholar stars received.
 * Framed as scholarly acknowledgment, not gamification metrics.
 */
export async function getRecognitionSummary(userId: string, since: string | null) {
  const supabase = await createClient();
  const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: endorsements }, { count: stars }, { count: upvotes }] = await Promise.all([
    supabase
      .from('reputation_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'endorsement_received')
      .gt('created_at', sinceDate),
    supabase
      .from('reputation_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'scholar_star_received')
      .gt('created_at', sinceDate),
    supabase
      .from('reputation_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', 'upvote_received')
      .gt('created_at', sinceDate),
  ]);

  return {
    endorsements: endorsements || 0,
    stars: stars || 0,
    upvotes: upvotes || 0,
    total: (endorsements || 0) + (stars || 0) + (upvotes || 0),
  };
}


/**
 * Get pending intellectual opportunities (NOT moderation chores).
 * 
 * Manager directive: These must feel like "intellectual opportunities"
 * not "operational task management." Framing matters.
 * 
 * Returns:
 *   - discussions on user's contributions that have unanswered replies
 *   - messages on their discussion page they haven't seen
 */
export async function getPendingOpportunities(userId: string, lastVisitAt: string | null) {
  const supabase = await createClient();
  const since = lastVisitAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. New messages on user's discussion page since last visit
  const { count: newMessages } = await supabase
    .from('user_discussions')
    .select('id', { count: 'exact', head: true })
    .eq('target_user_id', userId)
    .neq('author_id', userId) // Exclude own posts
    .gt('created_at', since);

  // 2. New discussions on nodes the user has contributed to
  // (Someone is talking about a topic you care about)
  const { data: userNodeIds } = await supabase
    .from('revisions')
    .select('node_id')
    .eq('author_id', userId);

  let newDiscussionsOnYourWork = 0;
  if (userNodeIds && userNodeIds.length > 0) {
    const nodeIds = [...new Set(userNodeIds.map((r: any) => r.node_id))];
    const { count } = await supabase
      .from('discussions')
      .select('id', { count: 'exact', head: true })
      .in('node_id', nodeIds)
      .neq('author_id', userId) // Not your own posts
      .gt('created_at', since);
    newDiscussionsOnYourWork = count || 0;
  }

  return {
    newMessages: newMessages || 0,
    newDiscussionsOnYourWork,
  };
}
