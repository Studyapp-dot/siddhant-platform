'use server';

import { createClient } from '@/utils/supabase/server';

// ============================================================================
// SIDDHANT: Recognition Feed — Server Actions (Data Fetching)
//
// Provides data fetching for the unified Activity & Recognition feed page.
// Reads from the recognition_feed_view (SQL view) and enriches with
// comment counts and endorsement state for the current user.
//
// This file is BACKEND ONLY — no UI components, just data.
// ============================================================================


export interface RecognitionFeedItem {
  activity_id: string;
  activity_type: 'revision' | 'scholar_star' | 'endorsement' | 'acknowledge' | 'quality_vote' | 'quality_assessment' | 'group_post' | 'mentorship_started';
  actor_id: string;
  actor_username: string;
  actor_full_display_name?: string | null;
  actor_institution_name?: string | null;
  actor_scholarly_role?: string | null;
  actor_areas_of_interest?: string[] | null;
  actor_profile_photo?: string | null;
  actor_role: string;
  actor_reputation: number;
  recipient_id: string | null;
  recipient_username: string | null;
  recipient_full_display_name?: string | null;
  recipient_institution_name?: string | null;
  recipient_scholarly_role?: string | null;
  recipient_areas_of_interest?: string[] | null;
  recipient_profile_photo?: string | null;
  node_id: string | null;
  node_title: string | null;
  node_slug: string | null;
  detail_text: string | null;
  detail_category: string | null;
  detail_size: number;
  is_revert: boolean;
  is_reverted: boolean;
  is_flagged: boolean;
  // ── Evidence columns (from evidence_feed_migration.sql) ──
  source_revision_id: string | null;   // The exact revision being recognized
  source_commit_message: string | null; // What the revision actually changed
  // AI-described revision semantics from revision_semantics.
  // These fields are descriptive only; reputation remains human/community driven.
  contribution_thesis?: string | null;
  contribution_type?: string | null;
  contribution_scope?: string | null;
  scholarly_significance?: string | null;
  claims_added?: string[] | null;
  concepts_introduced?: string[] | null;
  evidence_quality?: string | null;
  semantic_reasoning?: string | null;
  semantic_extraction_model?: string | null;
  semantic_extracted_at?: string | null;
  // ── Group ecosystem columns (from group_ecosystem_migration.sql) ──
  group_id?: string | null;
  group_name?: string | null;
  group_slug?: string | null;
  created_at: string;
}

export interface RecognitionFeedResult {
  items: RecognitionFeedItem[];
  error?: string;
}

interface RevisionIdRow {
  revision_id: string;
}

interface ProfileRelation {
  username?: string | null;
  full_display_name?: string | null;
}

interface NodeRelation {
  slug?: string | null;
}

interface RevisionDiffRow {
  id: string;
  node_id: string;
  report_content?: string | null;
  tier1_content?: string | null;
  commit_message?: string | null;
  created_at: string;
  profiles?: ProfileRelation | ProfileRelation[] | null;
  nodes?: NodeRelation | NodeRelation[] | null;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

/**
 * Activity type filters supported by the feed.
 */
export type FeedFilter =
  | 'all'
  | 'revision'        // Edits only
  | 'endorsement'     // Insightful + Acknowledge
  | 'scholar_star'    // Stars only
  | 'quality'         // Quality votes + assessments
  | 'recognition'     // All recognition (endorsement + acknowledge + star)
  | 'community';      // Group posts + mentorships (Phase 1)


/**
 * Fetch the unified recognition feed.
 * Reads from recognition_feed_view and applies optional filters.
 *
 * @param filter - Activity type filter
 * @param limit - Max items to return (default 50)
 * @param offset - Pagination offset (default 0)
 * @param nodeSlug - Optional: filter to a specific node
 */
export async function getRecognitionFeed(
  filter: FeedFilter = 'all',
  limit: number = 50,
  offset: number = 0,
  nodeSlug?: string,
): Promise<RecognitionFeedResult> {
  const supabase = await createClient();

  let query = supabase
    .from('recognition_feed_view')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  switch (filter) {
    case 'revision':
      query = query.eq('activity_type', 'revision');
      break;
    case 'endorsement':
      query = query.in('activity_type', ['endorsement', 'acknowledge']);
      break;
    case 'scholar_star':
      query = query.eq('activity_type', 'scholar_star');
      break;
    case 'quality':
      query = query.in('activity_type', ['quality_vote', 'quality_assessment']);
      break;
    case 'recognition':
      query = query.in('activity_type', ['endorsement', 'acknowledge', 'scholar_star']);
      break;
    case 'community':
      query = query.in('activity_type', ['group_post', 'mentorship_started']);
      break;
    // 'all' — no filter
  }

  // Optional node filter
  if (nodeSlug) {
    query = query.eq('node_slug', nodeSlug);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[recognition-feed] Query error:', error);
    return { items: [], error: error.message };
  }

  return { items: (data || []) as RecognitionFeedItem[] };
}


/**
 * Fetch the current user's endorsement state for a set of revision IDs.
 * Returns which revisions the user has acknowledged and/or endorsed.
 *
 * Used by the feed to show active/inactive state on endorsement buttons.
 *
 * @param revisionIds - Array of revision UUIDs to check
 * @returns Object with acknowledgedIds and endorsedIds sets
 */
export async function getUserEndorsementState(
  revisionIds: string[],
): Promise<{
  acknowledgedIds: string[];
  endorsedIds: string[];
}> {
  if (revisionIds.length === 0) {
    return { acknowledgedIds: [], endorsedIds: [] };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { acknowledgedIds: [], endorsedIds: [] };
  }

  const [{ data: acks }, { data: endorsements }] = await Promise.all([
    supabase
      .from('contribution_votes')
      .select('revision_id')
      .eq('user_id', user.id)
      .in('revision_id', revisionIds),
    supabase
      .from('endorsements')
      .select('revision_id')
      .eq('endorser_id', user.id)
      .in('revision_id', revisionIds),
  ]);

  return {
    acknowledgedIds: ((acks || []) as RevisionIdRow[]).map(a => a.revision_id),
    endorsedIds: ((endorsements || []) as RevisionIdRow[]).map(e => e.revision_id),
  };
}


/**
 * Fetch aggregate endorsement stats for a node (across all its revisions).
 * Calls the get_article_endorsement_stats SQL function.
 *
 * Used by the ArticleEndorsementBar on the topic page.
 */
export async function getArticleEndorsementStats(nodeId: string): Promise<{
  acknowledges: number;
  insightful: number;
  scholar_stars: number;
  unique_endorsers: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_article_endorsement_stats', {
    p_node_id: nodeId,
  });

  if (error) {
    console.error('[recognition-feed] Stats RPC error:', error);
    return { acknowledges: 0, insightful: 0, scholar_stars: 0, unique_endorsers: 0 };
  }

  return {
    acknowledges: data?.acknowledges ?? 0,
    insightful: data?.insightful ?? 0,
    scholar_stars: data?.scholar_stars ?? 0,
    unique_endorsers: data?.unique_endorsers ?? 0,
  };
}


/**
 * Fetch the content diff context for a revision.
 * Returns the current and previous revision content for inline diff rendering.
 *
 * Used by feed cards to show "what changed" inline.
 */
export async function getRevisionDiffContext(revisionId: string): Promise<{
  current: { content: string; authorName: string; date: string } | null;
  previous: { content: string; authorName: string; date: string } | null;
  nodeSlug: string | null;
  commitMessage: string | null;
}> {
  const supabase = await createClient();

  // Fetch the target revision
  const { data: revision } = await supabase
    .from('revisions')
    .select(`
      id, node_id, report_content, tier1_content, content_size,
      commit_message, created_at, author_id,
      profiles!revisions_author_id_fkey (username, full_display_name),
      nodes!revisions_node_id_fkey (slug)
    `)
    .eq('id', revisionId)
    .single();

  if (!revision) {
    return { current: null, previous: null, nodeSlug: null, commitMessage: null };
  }

  const revisionRow = revision as unknown as RevisionDiffRow;
  const currentContent = revisionRow.report_content || revisionRow.tier1_content || '';
  const profileData = firstRelation(revisionRow.profiles);
  const nodeData = firstRelation(revisionRow.nodes);

  // Fetch the previous revision for this node
  const { data: prevRevision } = await supabase
    .from('revisions')
    .select(`
      id, report_content, tier1_content, created_at, author_id,
      profiles!revisions_author_id_fkey (username, full_display_name)
    `)
    .eq('node_id', revisionRow.node_id)
    .lt('created_at', revisionRow.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevContent = prevRevision
    ? ((prevRevision as unknown as RevisionDiffRow).report_content || (prevRevision as unknown as RevisionDiffRow).tier1_content || '')
    : '';
  const prevProfileData = prevRevision
    ? firstRelation((prevRevision as unknown as RevisionDiffRow).profiles)
    : null;

  return {
    current: {
      content: currentContent,
      authorName: profileData?.full_display_name || profileData?.username || 'Unknown',
      date: revisionRow.created_at,
    },
    previous: prevRevision
      ? {
          content: prevContent,
          authorName: prevProfileData?.full_display_name || prevProfileData?.username || 'Unknown',
          date: (prevRevision as unknown as RevisionDiffRow).created_at,
        }
      : null,
    nodeSlug: nodeData?.slug || null,
    commitMessage: revisionRow.commit_message || null,
  };
}


/**
 * Fetch feed items for a specific node (article-level feed).
 * Returns the last N activities for this article, useful for
 * the article page sidebar or an expanded activity section.
 */
export async function getNodeActivityFeed(
  nodeSlug: string,
  limit: number = 20,
): Promise<RecognitionFeedResult> {
  return getRecognitionFeed('all', limit, 0, nodeSlug);
}
