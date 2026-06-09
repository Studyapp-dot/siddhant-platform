import React from 'react';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import ReportContent from '@/app/components/ReportContent';
import ParagraphList from '@/app/components/ParagraphList';
import { getParagraphs, resolveStableId } from '@/app/actions/paragraphs';
import CrossReferences from '@/app/components/CrossReferences';
import FollowButton from '@/app/components/FollowButton';
import FlagIssuePanel from '@/app/components/FlagIssuePanel';
import QualityAssessment from '@/app/components/QualityAssessment';
import QualityVoting from '@/app/components/QualityVoting';
import PeerReviewPanel from '@/app/components/PeerReviewPanel';
import SidebarReviewTrigger from '@/app/components/SidebarReviewTrigger';
import ArticleEndorsementBar from '@/app/components/ArticleEndorsementBar';
import SystemTooltip from '@/app/components/SystemTooltip';
import TrustBadge from '@/app/components/TrustBadge';
import ReviewPipeline from '@/app/components/ReviewPipeline';
import AuthorityDrawer from '@/app/components/AuthorityDrawer';
import NodeDeleteZone from '@/app/components/NodeDeleteZone';
import { getAuthorityAnchors } from '@/app/actions/authority-anchors';
import { QUALITY_TIER_TOOLTIPS, ROLE_TOOLTIPS, getTopicTrustBadges } from '@/app/actions/trust-vocabulary';
import { processEditAcceptance } from '@/app/actions/edit-acceptance';
import { QUALITY_TIERS } from '@/app/actions/quality-constants';
import './page.css';
import '@/app/recognition/recognition.css';
import '@/app/system-visibility.css';

// Human-readable relative time for "Last Updated" banner
function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Node type display config
const NODE_TYPE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  statute:   { label: 'Statute',  icon: '📜', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  chapter:   { label: 'Chapter',  icon: '📖', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  section:   { label: 'Section',  icon: '§',  color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  constitutional_provision: { label: 'Constitutional Provision', icon: '🏛', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)' },
  judgment:  { label: 'Judgment', icon: '⚖️', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  doctrine:  { label: 'Doctrine', icon: '💡', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  concept:   { label: 'Concept',  icon: '🧠', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  topic:     { label: 'Topic',    icon: '📝', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' },
};

const CASE_STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  good_law:            { label: '✅ Good Law',            color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)' },
  overruled:           { label: '🔴 Overruled',           color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' },
  partially_overruled: { label: '🟡 Partially Overruled', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
  doubted:             { label: '⚠️ Doubted',              color: '#fb923c', bg: 'rgba(251, 146, 60, 0.1)' },
};

// Quality tier display — reads from database, NOT computed from edit count.
// Content-based assessment: accuracy, completeness, neutrality, sourcing.
function getQualityTierDisplay(tierValue: string) {
  const tier = QUALITY_TIERS[tierValue];
  if (!tier) return QUALITY_TIERS.stub;  // Fallback
  return tier;
}

// Neutral inline descriptions for quality tiers (transparency without negativity)
const QUALITY_INLINE_DESCRIPTIONS: Record<string, string> = {
  stub: 'Community-reviewed, open for improvement',
  start: 'Community-reviewed, open for improvement',
  c_class: 'Community-reviewed, useful foundation',
  b_class: 'Community-reviewed, mostly complete',
  good_article: 'Independently reviewed, meets institutional standards',
  featured: 'Definitive archival resource',
};

// Suggested section templates per node type (flexible guidance, not mandatory)
const SECTION_TEMPLATES: Record<string, string[]> = {
  judgment: ['Facts', 'Issues', 'Arguments', 'Judgment', 'Reasoning', 'Ratio Decidendi', 'Obiter Dicta'],
  statute: ['Overview', 'Object and Scope', 'Key Provisions', 'Amendments', 'Judicial Interpretation'],
  section: ['Bare Text', 'Explanation', 'Essentials', 'Key Cases', 'Exceptions'],
  constitutional_provision: ['Text', 'Historical Context', 'Scope and Application', 'Key Judgments'],
  doctrine: ['Origin', 'Principle', 'Elements', 'Application', 'Key Cases', 'Criticism'],
  concept: ['Definition', 'Elements', 'Application', 'Related Concepts', 'Key Cases'],
  chapter: ['Overview', 'Key Sections', 'Judicial Interpretation'],
  topic: ['Overview', 'Key Concepts', 'Analysis', 'References'],
};

export default async function TopicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ revision?: string; pid?: string }> }) {
  const { slug } = await params;
  const { revision: viewRevisionId, pid } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fire-and-forget: process any pending edit acceptances (72h lazy evaluation)
  processEditAcceptance().catch(() => {});

  const { data: node } = await supabase
    .from('nodes')
    .select('id, title, node_type, metadata, parent_node_id, quality_tier, quality_reviewed_revision_id, created_by')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single();

  if (!node) {
    return (
      <div className="topic-layout">
        <div className="glass-panel" style={{ padding: '40px', width: '100%', textAlign: 'center' }}>
          <h2>Topic Not Found</h2>
          <p style={{ color: 'var(--text-muted)' }}>The article &apos;{slug}&apos; does not exist yet.</p>
          {user ? (
            <p style={{ color: 'var(--primary)', marginTop: '12px' }}><i>(Sign in and visit this page to seed it!)</i></p>
          ) : (
            <p style={{ color: 'var(--primary)', marginTop: '12px' }}><i>Sign in to help build this node!</i></p>
          )}
          <Link href="/" className="btn-primary" style={{ marginTop: '20px', display: 'inline-block' }}>Back to Explore</Link>
        </div>
      </div>
    );
  }

  const nodeType = (node as any).node_type || 'topic';

  // ── Paragraph-native rendering ──
  // Fetch paragraphs for this node. If any exist, render ParagraphList.
  // If none exist, fall through to legacy report_content rendering.
  const paragraphs = await getParagraphs(node.id);
  const hasParagraphs = paragraphs.length > 0;

  // Resolve ?pid= stable_id to current display_number for scroll targeting
  let pidScrollTarget: number | null = null;
  if (pid && hasParagraphs) {
    pidScrollTarget = await resolveStableId(node.id, pid);
  }
  const metadata = (node as any).metadata || {};
  const typeMeta = NODE_TYPE_META[nodeType] || NODE_TYPE_META.topic;

  // Build breadcrumb from parent hierarchy
  const breadcrumbs: { title: string; slug: string }[] = [];
  let currentParentId = (node as any).parent_node_id;
  let depth = 0;
  while (currentParentId && depth < 5) {
    const { data: parent } = await supabase
      .from('nodes')
      .select('id, title, slug, parent_node_id')
      .eq('id', currentParentId)
      .single();
    if (!parent) break;
    breadcrumbs.unshift({ title: parent.title, slug: parent.slug });
    currentParentId = parent.parent_node_id;
    depth++;
  }

  // Fetch the revision to display:
  //   - If ?revision=<id> is present, fetch that specific revision ("View State")
  //   - Otherwise, fetch the latest revision
  let revisionRows: any[] | null = null;
  let revisionError: any = null;
  let isViewingOldRevision = false;

  if (viewRevisionId) {
    // Viewing a specific revision ("View State" from history page)
    const result = await supabase
      .from('revisions')
      .select(`id, report_content, tier1_content, created_at, content_size, author_id, is_revert, is_reverted, profiles!revisions_author_id_fkey ( username, full_display_name, role )`)
      .eq('id', viewRevisionId)
      .eq('node_id', node.id);
    revisionRows = result.data;
    revisionError = result.error;
    isViewingOldRevision = true;
  } else {
    // Default: latest revision
    const result = await supabase
      .from('revisions')
      .select(`id, report_content, tier1_content, created_at, content_size, author_id, is_revert, is_reverted, profiles!revisions_author_id_fkey ( username, full_display_name, role )`)
      .eq('node_id', node.id)
      .order('created_at', { ascending: false })
      .limit(2); // Fetch 2 to get the previous one for diffing
    revisionRows = result.data;
    revisionError = result.error;
  }

  if (revisionError) {
    console.error('[topic-page] Revision query error:', revisionError);
  }
  const revision = revisionRows?.[0] ?? null;
  const previousRevision = revisionRows?.[1] ?? null;

  const { data: allRevIdsData } = await supabase
    .from('revisions')
    .select('id')
    .eq('node_id', node.id)
    .order('created_at', { ascending: false });
  const allRevisionIds = allRevIdsData?.map(r => r.id) || [];

  const { count: revisionCount } = await supabase
    .from('revisions')
    .select('id', { count: 'exact', head: true })
    .eq('node_id', node.id);

  // Unique contributor count for wiki signals
  const { data: contributorData } = await supabase
    .from('revisions')
    .select('author_id')
    .eq('node_id', node.id);
  const uniqueContributors = new Set(contributorData?.map(r => r.author_id) || []).size;

  const revData = revision as any;
  const latestRevisionId = revData?.id || null;
  // Handle both object and array return formats from Supabase joins
  const profileData = Array.isArray(revData?.profiles) ? revData.profiles[0] : revData?.profiles;
  const authorDisplayName = profileData?.full_display_name || profileData?.username || 'Unknown';
  const authorHandle = profileData?.username || 'unknown';
  const authorRole = profileData?.role || 'contributor';
  const reportContent = revData?.report_content || revData?.tier1_content || 'No content written yet.';
  
  // Compact Metadata Bar
  const typeMetaDisplay = NODE_TYPE_META[node.node_type] || NODE_TYPE_META.topic;
  const qualityTierDisplay = getQualityTierDisplay((node as any).quality_tier || 'stub');

  const editedDate = revData?.created_at
    ? new Date(revData.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Unknown';
  const editedTimeAgo = revData?.created_at ? getTimeAgo(new Date(revData.created_at)) : null;

  const qualityTier = getQualityTierDisplay((node as any).quality_tier || 'stub');

  // Check quality staleness: was the tier earned on an older revision?
  // Only relevant for Good Article and Featured tiers.
  let reviewedRevisionId = (node as any).quality_reviewed_revision_id || null;
  let isQualityStale = false;

  if (['good_article', 'featured'].includes((node as any).quality_tier) && latestRevisionId) {
    if (reviewedRevisionId) {
      // Normal case: quality_reviewed_revision_id is set by close_review_cycle
      isQualityStale = reviewedRevisionId !== latestRevisionId;
    } else {
      // Fallback for legacy nodes that were promoted before the peer review system.
      // Look up when the node was last assessed to this tier and find the revision
      // that was current at that time.
      const { data: lastPromotion } = await supabase
        .from('quality_assessments')
        .select('created_at')
        .eq('node_id', node.id)
        .eq('new_tier', (node as any).quality_tier)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastPromotion) {
        // Find the revision that was latest at the time of the assessment
        const { data: revisionAtAssessment } = await supabase
          .from('revisions')
          .select('id')
          .eq('node_id', node.id)
          .lte('created_at', lastPromotion.created_at)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (revisionAtAssessment && revisionAtAssessment.id !== latestRevisionId) {
          isQualityStale = true;
          reviewedRevisionId = revisionAtAssessment.id; // For tooltip text
        }
      }
    }
  }

  // Check vote staleness for community-voted tiers (stub through b_class)
  // If any quality votes were cast on older revisions, show a softer staleness warning
  let hasStaleVotes = false;
  if (['stub', 'start', 'c_class', 'b_class'].includes((node as any).quality_tier) && latestRevisionId) {
    const { count: staleVoteCount } = await supabase
      .from('quality_votes')
      .select('id', { count: 'exact', head: true })
      .eq('node_id', node.id)
      .neq('revision_id', latestRevisionId);

    const { count: totalVoteCount } = await supabase
      .from('quality_votes')
      .select('id', { count: 'exact', head: true })
      .eq('node_id', node.id);

    // Only show stale badge if there ARE votes and the majority of them are stale
    hasStaleVotes = (totalVoteCount ?? 0) > 0 && (staleVoteCount ?? 0) > (totalVoteCount ?? 0) / 2;
  }

  // ── System Visibility: Trust badge & pipeline data ──
  // Total quality votes (for community-verified badge)
  const { count: totalQualityVoteCount } = await supabase
    .from('quality_votes')
    .select('id', { count: 'exact', head: true })
    .eq('node_id', node.id);

  // Active review cycle (for under-review badge + pipeline)
  const { data: activeReviewCycle } = await supabase
    .from('review_cycles')
    .select('id, status')
    .eq('node_id', node.id)
    .in('status', ['open', 'awaiting_conclusion'])
    .maybeSingle();
  const hasActiveReviewCycle = !!activeReviewCycle;

  // Completed review cycles count (for pipeline)
  const { count: completedReviewCycleCount } = await supabase
    .from('review_cycles')
    .select('id', { count: 'exact', head: true })
    .eq('node_id', node.id)
    .eq('status', 'closed');

  // Last tier change date (for pipeline detail)
  const { data: lastAssessment } = await supabase
    .from('quality_assessments')
    .select('created_at')
    .eq('node_id', node.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Compute which trust badges to show (max 2–3)
  const topicTrustBadges = getTopicTrustBadges({
    qualityTier: (node as any).quality_tier || 'stub',
    hasActiveReviewCycle,
    totalQualityVotes: totalQualityVoteCount ?? 0,
  });

  // User state
  let isFollowing = false;
  let currentUserRole: string | null = null;
  if (user) {
    const [{ data: watchEntry }, { data: userProfile }] = await Promise.all([
      supabase.from('watchlist').select('user_id').eq('user_id', user.id).eq('node_id', node.id).maybeSingle(),
      supabase.from('profiles').select('role').eq('id', user.id).single(),
    ]);
    isFollowing = !!watchEntry;
    currentUserRole = userProfile?.role ?? null;
  }

  // Inline tags
  const { data: openTags } = await supabase
    .from('inline_tags')
    .select('id, tier, tag_type, context_quote, created_at, profiles!inline_tags_author_id_fkey ( username )')
    .eq('node_id', node.id)
    .eq('resolved', false)
    .order('created_at', { ascending: true });

  // Fetch child nodes (for statute → chapters, chapter → sections)
  const { data: childNodes } = await supabase
    .from('nodes')
    .select('id, title, slug, node_type')
    .eq('parent_node_id', node.id)
    .order('title', { ascending: true });

  // Fetch authority anchors for contextual attribution
  const authorityAnchors = await getAuthorityAnchors(node.id);

  // 1. Fetch formal tier promotion history
  const { data: assessmentHistory } = await supabase
    .from('quality_assessments')
    .select('id, previous_tier, new_tier, justification, confidence, created_at, profiles!quality_assessments_assessor_id_fkey ( username )')
    .eq('node_id', node.id)
    .order('created_at', { ascending: false })
    .limit(5);

  // 2. Fetch community quality votes WITH justifications
  const { data: voteHistory } = await supabase
    .from('quality_votes')
    .select('id, voted_tier, justification, created_at, profiles!quality_votes_voter_id_fkey ( username )')
    .eq('node_id', node.id)
    .not('justification', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  // 3. Fetch Scholar Stars for revisions of this node
  const { data: starHistory } = await supabase
    .from('scholar_stars')
    .select('id, reason, created_at, giver:profiles!scholar_stars_giver_id_fkey(username), recipient:profiles!scholar_stars_recipient_id_fkey(username)')
    .eq('source_type', 'revision')
    .in('source_id', allRevisionIds)
    .order('created_at', { ascending: false })
    .limit(5);

  // 4. Unified & Sorted Feed
  const unifiedHistory = [
    ...(assessmentHistory || []).map(a => ({ ...a, type: 'assessment' })),
    ...(voteHistory || []).map(v => ({ ...v, type: 'vote' })),
    ...(starHistory || []).map(s => ({ ...s, type: 'star' }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
   .slice(0, 10);

  return (
    <div className="topic-layout">
      {/* Sidebar Navigation */}
      <aside className="topic-sidebar glass-panel">
        <div className="sidebar-section">
          <h3>Navigation</h3>
          <ul>
            <li><Link href="/">Archive Home</Link></li>
            {breadcrumbs.map(bc => (
              <li key={bc.slug} className="indent-1">
                <Link href={`/topic/${bc.slug}`}>{bc.title}</Link>
              </li>
            ))}
            <li><Link href="#" className="indent-2 active">#{slug}</Link></li>
          </ul>
        </div>

        {/* Compact archival metadata — inline format */}
        <div className="sidebar-stats-bar">
          <span className="sidebar-stat">
            <span className="sidebar-stat-value">{revisionCount ?? 0}</span>{' '}
            <span className="sidebar-stat-label">{(revisionCount ?? 0) === 1 ? 'revision' : 'revisions'}</span>
          </span>
          {' · '}
          <span className="sidebar-stat">
            <span className="sidebar-stat-value">{uniqueContributors}</span>{' '}
            <span className="sidebar-stat-label">{uniqueContributors === 1 ? 'contributor' : 'contributors'}</span>
          </span>
        </div>
        <div className="sidebar-section">
          <h3>Tools</h3>
          <Link href={`/topic/${slug}/discussion`} className="btn-utility" style={{ display: 'block', textDecoration: 'none', marginTop: '8px' }}>
            💬 Discussion
          </Link>
          <Link href="/groups" className="btn-utility" style={{ display: 'block', textDecoration: 'none', marginTop: '8px' }}>
            🏛 Scholarly Communities
          </Link>
          {user && (
            <Link href={`/topic/${slug}/edges`} className="btn-utility" style={{ display: 'block', textDecoration: 'none', marginTop: '8px' }}>
              📖 Doctrinal Relationships
            </Link>
          )}
        </div>

        {/* Last Revised — compact scholarly metadata + Review & Endorse */}
        {!isViewingOldRevision && (
          <div className="sidebar-section sidebar-last-revised">
            <h3>Last Revised</h3>
            <div className="sidebar-revision-meta">
              <div className="sidebar-revision-author">
                <Link href={`/profile/${authorHandle}`} className="sidebar-revision-link">
                  {authorDisplayName}
                </Link>
                <span className="sidebar-revision-role">
                  {authorRole === 'recognized' ? 'Recognized'
                    : authorRole === 'senior_scholar' ? 'Senior Scholar'
                    : authorRole === 'steward' ? 'Steward'
                    : authorRole === 'governance_council' ? 'Council'
                    : 'Contributor'}
                </span>
              </div>
              <span className="sidebar-revision-date">{editedTimeAgo || editedDate}</span>
            </div>
            <SidebarReviewTrigger
              revision={revision}
              previousRevision={previousRevision}
              authorName={authorDisplayName}
              slug={slug}
              userId={user?.id}
              allRevisionIds={allRevisionIds}
              currentUserRole={currentUserRole}
              sizeDelta={(revision?.content_size ?? 0) - (previousRevision?.content_size ?? 0)}
            />
            <Link href={`/topic/${slug}/history`} className="sidebar-history-link">
              View full history →
            </Link>
          </div>
        )}


        {unifiedHistory && unifiedHistory.length > 0 && (
          <div className="sidebar-section">
            <h3>Quality History</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {unifiedHistory.map((item: any) => {
                if (item.type === 'assessment') {
                  const assessorData = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
                  const prevTier = QUALITY_TIERS[item.previous_tier];
                  const newTier = QUALITY_TIERS[item.new_tier];
                  return (
                    <div key={item.id} className="ledger-card assessment-card">
                      <div className="ledger-header">
                        <span style={{ color: prevTier?.color }}>{prevTier?.icon}</span>
                        <span className="ledger-arrow">→</span>
                        <span style={{ color: newTier?.color, fontWeight: 700 }}>{newTier?.icon} {newTier?.label}</span>
                      </div>
                      <p className="ledger-comment">&ldquo;{item.justification}&rdquo;</p>
                      <div className="ledger-footer">
                        Promoted by <Link href={`/profile/${assessorData?.username}`} className="ledger-link">@{assessorData?.username}</Link>
                        {' · '}{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  );
                }

                if (item.type === 'vote') {
                  const voterData = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
                  const votedTier = QUALITY_TIERS[item.voted_tier];
                  return (
                    <div key={item.id} className="ledger-card vote-card">
                      <div className="ledger-header">
                        <span className="ledger-icon-mini">⚖️</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Vouched for {votedTier?.label}</span>
                      </div>
                      <p className="ledger-comment">&ldquo;{item.justification}&rdquo;</p>
                      <div className="ledger-footer">
                        by <Link href={`/profile/${voterData?.username}`} className="ledger-link">@{voterData?.username}</Link>
                        {' · '}{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  );
                }

                if (item.type === 'star') {
                  const giver = Array.isArray(item.giver) ? item.giver[0] : item.giver;
                  const recipient = Array.isArray(item.recipient) ? item.recipient[0] : item.recipient;
                  return (
                    <div key={item.id} className="ledger-card star-card">
                      <div className="ledger-header" style={{ color: 'var(--color-gold)' }}>
                        <span className="ledger-icon-mini">⭐</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700 }}>Scholar Star</span>
                      </div>
                      <p className="ledger-comment">&ldquo;{item.reason}&rdquo;</p>
                      <div className="ledger-footer">
                        From <Link href={`/profile/${giver?.username}`} className="ledger-link">@{giver?.username}</Link> to <Link href={`/profile/${recipient?.username}`} className="ledger-link">@{recipient?.username}</Link>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="topic-content">
        {/* Viewing old revision banner */}
        {isViewingOldRevision && (
          <div style={{
            padding: '14px 20px', borderRadius: '10px', marginBottom: '20px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '16px', flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>⏳</span>
              <div>
                <strong style={{ color: '#f59e0b', fontSize: '0.85rem' }}>
                  Viewing historical revision
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  #{viewRevisionId?.substring(0, 8)} · {editedDate}
                  {(revision as any)?.is_reverted && ' · This revision was later reverted'}
                  {(revision as any)?.is_revert && ' · This is a revert revision'}
                </p>
              </div>
            </div>
            <Link
              href={`/topic/${slug}`}
              style={{
                padding: '8px 16px', borderRadius: '8px',
                background: 'var(--color-gold)', color: '#000',
                fontSize: '0.78rem', fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              ← View Current Version
            </Link>
          </div>
        )}
        <header className="topic-header">
          {/* Breadcrumb Trail */}
          {breadcrumbs.length > 0 && (
            <nav className="topic-breadcrumbs">
              {breadcrumbs.map((bc, i) => (
                <span key={bc.slug}>
                  <Link href={`/topic/${bc.slug}`} className="breadcrumb-link">{bc.title}</Link>
                  {i < breadcrumbs.length && <span className="breadcrumb-sep"> › </span>}
                </span>
              ))}
              <span className="breadcrumb-current">{node.title}</span>
            </nav>
          )}

          {/* Subtle badge row — compact, does NOT compete with title */}
          <div className="topic-badge-row">
            {/* Node Type Badge — small and muted */}
            <span
              className="node-type-badge"
              style={{ color: typeMeta.color, background: typeMeta.bg, border: `1px solid ${typeMeta.color}20` }}
            >
              {typeMeta.icon} {typeMeta.label}
            </span>

            {/* Quality Tier Badge — contextual tooltip replaces bare title attr */}
            <SystemTooltip
              title={qualityTier.label}
              text={QUALITY_TIER_TOOLTIPS[(node as any).quality_tier || 'stub']?.tooltip || qualityTier.description}
            >
              <span
                className="quality-badge"
                style={{ color: qualityTier.color, background: qualityTier.bg, border: `1px solid ${qualityTier.border}` }}
              >
                {qualityTier.icon} {qualityTier.label}
              </span>
            </SystemTooltip>

            {/* Trust Badges — max 2-3, contextual signals */}
            {topicTrustBadges.length > 0 && (
              <span className="trust-badge-row">
                {topicTrustBadges.map(badgeType => (
                  <TrustBadge key={badgeType} type={badgeType} />
                ))}
              </span>
            )}

            {/* Staleness indicator: if the tier was earned on an earlier revision */}
            {isQualityStale && (
              <Link
                href={`/topic/${slug}/history`}
                className="staleness-indicator"
                title={`This ${qualityTier.label} rating was based on revision ${reviewedRevisionId?.substring(0, 8)}. Content has been updated since. View history to compare.`}
              >
                ⚠ Reviewed at earlier version
              </Link>
            )}

            {/* Vote staleness indicator */}
            {hasStaleVotes && !isQualityStale && (
              <span
                className="staleness-indicator vote-stale"
                title="Some community quality votes were cast on an earlier version of this content."
              >
                ℹ Some votes from earlier version
              </span>
            )}
          </div>

          {/* DOMINANT: Title */}
          <h1 className="topic-title">{node.title}</h1>

          {/* Meta line — author, date, quality context */}
          <div className="topic-meta-line">
            <span className="meta-text">
              Published {editedDate} · Written by{' '}
              <Link href={`/profile/${authorHandle}`} className="meta-author-link">{authorDisplayName}</Link>
              <SystemTooltip
                title={ROLE_TOOLTIPS[authorRole]?.label || 'Contributor'}
                text={ROLE_TOOLTIPS[authorRole]?.tooltip || 'Can edit content and participate in discussions.'}
              >
                <span className="meta-role-badge">
                  {authorRole === 'recognized' ? 'Recognized Contributor'
                    : authorRole === 'senior_scholar' ? 'Senior Scholar'
                    : authorRole === 'steward' ? 'Steward'
                    : authorRole === 'governance_council' ? 'Governance Council'
                    : 'Contributor'}
                </span>
              </SystemTooltip>
            </span>
            <span className="meta-quality-context">
              {QUALITY_INLINE_DESCRIPTIONS[(node as any).quality_tier || 'stub'] || 'Community-reviewed, open for improvement'}
            </span>
            {!isViewingOldRevision && currentUserRole && !['good_article', 'featured'].includes((node as any).quality_tier || 'stub') && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <QualityVoting
                  nodeId={node.id}
                  slug={slug}
                  currentTier={(node as any).quality_tier || 'stub'}
                  userRole={currentUserRole}
                  userId={user?.id || null}
                  latestRevisionId={latestRevisionId}
                />
              </>
            )}
          </div>

          {/* Actions — Compact inline toolbar */}
          <div className="topic-actions-compact">
            {user ? (
              <>
                <Link href={`/topic/${slug}/edit`} className="btn-wiki-edit">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  Improve
                </Link>
                <FollowButton nodeId={node.id} slug={slug} isFollowing={isFollowing} />
              </>
            ) : (
              <Link href="/login" className="btn-utility" style={{ textDecoration: 'none' }}>Login to contribute</Link>
            )}
            <button className="btn-cite">Cite Node</button>
          </div>
        </header>

        {/* Viewing old revision banner */}
        {isViewingOldRevision && (
          <div className="last-updated-banner" style={{ opacity: 0.7, background: 'rgba(0,0,0,0.1)' }}>
            <div className="last-updated-left">
              <svg className="last-updated-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span className="last-updated-text">
                This is a historical revision from <strong>{editedDate}</strong> by{' '}
                <Link href={`/profile/${authorHandle}`} className="last-updated-author">{authorDisplayName}</Link>
              </span>
            </div>
            <div className="last-updated-right">
              <Link href={`/topic/${slug}/history`} className="last-updated-history-link">
                View History →
              </Link>
            </div>
          </div>
        )}

        {/* Child Nodes (sub-hierarchy) — before content for navigation */}
        {childNodes && childNodes.length > 0 && (
          <div className="children-section">
            <h3 className="children-heading">
              {nodeType === 'statute' ? '📖 Chapters' : nodeType === 'chapter' ? '§ Sections & Articles' : '📁 Sub-nodes'}
            </h3>
            <div className="children-list">
              {childNodes.map((child: any) => {
                const childMeta = NODE_TYPE_META[child.node_type] || NODE_TYPE_META.topic;
                return (
                  <Link key={child.id} href={`/topic/${child.slug}`} className="child-node-card">
                    <span className="child-type-icon">{childMeta.icon}</span>
                    <span className="child-title">{child.title}</span>
                    <span className="child-type-label" style={{ color: childMeta.color }}>{childMeta.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            CONTENT FIRST — Article appears immediately after title.
            Institutional panels (spotlight, endorsements, pipeline)
            are moved below content as compact, visible summaries.
            ══════════════════════════════════════════════════ */}
        <div className="legal-content">
          {isViewingOldRevision && hasParagraphs ? (
            <div className="historical-paragraph-warning">
              <strong>Historical paragraph view unavailable</strong>
              <p>
                This article now uses paragraph-native storage. The current system cannot reconstruct the exact paragraph state for this node-level historical revision, so current paragraphs are not shown as if they were historical.
              </p>
              <Link href={`/topic/${slug}`}>Return to current version</Link>
            </div>
          ) : hasParagraphs ? (
            <ParagraphList
              paragraphs={paragraphs.map(p => ({
                id: p.id,
                stable_id: p.stable_id,
                display_number: p.display_number,
                marginal_note: p.marginal_note,
                content: p.content,
                group_label: p.group_label,
                order_index: p.order_index,
                node_id: p.node_id,
              }))}
              slug={slug}
              scrollToNumber={pidScrollTarget}
              authorityAnchors={authorityAnchors}
            />
          ) : (
            <ReportContent content={reportContent} authorities={authorityAnchors} slug={slug} />
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            INSTITUTIONAL SIGNALS — Below content, compact visible summaries.
            Manager directive: "show label + 1-line summary, expand for details."
            NOT fully hidden — institutional visibility matters.
            ══════════════════════════════════════════════════ */}

        {/* Endorsement Bar — compact inline signal */}
        {!isViewingOldRevision && (
          <ArticleEndorsementBar nodeId={node.id} slug={slug} />
        )}


        {/* Scholarly Standing — compact summary, expand for full pipeline */}
        {!isViewingOldRevision && (
          <details className="institutional-panel-compact">
            <summary className="institutional-summary">
              <span className="institutional-summary-icon">📊</span>
              <span className="institutional-summary-label">Scholarly Standing</span>
              <span className="institutional-summary-brief">
                {qualityTierDisplay.icon} {qualityTierDisplay.label}
                {' · '}{totalQualityVoteCount ?? 0} quality votes
                {hasActiveReviewCycle && ' · Under review'}
              </span>
            </summary>
            <div className="institutional-panel-body">
              <ReviewPipeline
                qualityTier={(node as any).quality_tier || 'stub'}
                hasActiveReviewCycle={hasActiveReviewCycle}
                totalQualityVotes={totalQualityVoteCount ?? 0}
                lastTierChangeDate={lastAssessment?.created_at || null}
                completedReviewCycles={completedReviewCycleCount ?? 0}
              />
            </div>
          </details>
        )}


        {/* Doctrinal cross-references */}
        <CrossReferences nodeId={node.id} />

        {/* Inline tag panel */}
        <FlagIssuePanel
          nodeId={node.id}
          slug={slug}
          existingTags={(openTags ?? []) as any}
          isLoggedIn={!!user}
          userRole={currentUserRole}
        />

        {/* (Scholarly Standing was moved above, before content) */}

        {/* Peer Review Panel — For tiers eligible for advancement or challenge (hidden on old revisions) */}
        {!isViewingOldRevision && ((node as any).quality_tier === 'b_class' || (node as any).quality_tier === 'good_article' || (node as any).quality_tier === 'featured') && (
          <PeerReviewPanel
            nodeId={node.id}
            slug={slug}
            currentTier={(node as any).quality_tier || 'stub'}
            userRole={currentUserRole}
            userId={user?.id || null}
            latestRevisionId={latestRevisionId}
          />
        )}

        {/* Info banner when viewing a historical revision */}
        {isViewingOldRevision && (
          <div style={{
            padding: '12px 16px', borderRadius: '10px', margin: '1.5rem 0',
            background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.20)',
            fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '1rem' }}>📋</span>
            <span>You are viewing a <strong>historical revision</strong>. Quality assessment and peer review are only available on the <Link href={`/topic/${slug}`} style={{ color: 'var(--color-gold)', fontWeight: 600 }}>current version</Link>.</span>
          </div>
        )}

        {/* Owner-only node deletion — hidden danger zone */}
        {user && (node as any).created_by === user.id && (
          <NodeDeleteZone nodeId={node.id} nodeTitle={node.title} />
        )}
      </main>

      {/* Context Panel */}
      <aside className="context-panel">

        {/* ========================================================
            ZONE 1: SCHOLARLY GROUNDING
            Meaning: "What grounds this knowledge?"
            Tone: scholarly, archival, source-oriented
            ======================================================== */}
        <div className="sidebar-zone scholarly-grounding-zone">
          <h3 className="zone-header">Scholarly Grounding</h3>
          <AuthorityDrawer anchors={authorityAnchors} />
        </div>
        
        {/* ========================================================
            ZONE 2: KNOWLEDGE INTELLIGENCE
            Meaning: "How should this knowledge be interpreted?"
            Tone: analytical, synthesized, semantic
            ======================================================== */}
        <div className="sidebar-zone knowledge-intelligence-zone">
          <h3 className="zone-header">Knowledge Intelligence</h3>
          
          {/* Quick Reference — Sidebar reference cards for all node types */}
          {(
            <div className="sidebar-quick-ref">
              <div className="sidebar-section-header">
                <span className="ref-header">{nodeType === 'topic' ? 'Semantic Signals' : 'Quick Reference'}</span>
                {metadata._extracted_at && <span className="ref-source-pill" style={{ fontSize: '0.52rem', fontWeight: 600, opacity: 0.7, letterSpacing: '0.04em' }}>AI Analysis</span>}
              </div>

              {/* Analyzing placeholder */}
              {!metadata._extracted_at && Object.keys(metadata).length === 0 && (
                <div className="analyzing-placeholder-sidebar">
                  <span className="analyzing-shimmer">◎</span>
                  <span>Extracting reference data...</span>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* TOPIC CARD — Knowledge signals: themes, level, edges      */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {nodeType === 'topic' && metadata._extracted_at && (
                <div className="topic-knowledge-card-sidebar">
                  {/* Learning Level */}
                  {metadata.learning_level && (
                    <div className="sidebar-meta-line">
                      <span className="field-label">Difficulty</span>
                      <span className="field-value" style={{ textTransform: 'capitalize' }}>{metadata.learning_level}</span>
                    </div>
                  )}
                  {/* Key Themes */}
                  {metadata.key_themes && Array.isArray(metadata.key_themes) && metadata.key_themes.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <span className="field-label" style={{ display: 'block', marginBottom: '6px' }}>Key Themes</span>
                      <div className="card-chips-row">
                        {metadata.key_themes.slice(0, 6).map((theme: string, i: number) => (
                          <span key={i} className="theme-chip">{theme}</span>
                        ))}
                        {metadata.key_themes.length > 6 && (
                          <span className="chip-overflow">+{metadata.key_themes.length - 6} more</span>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Legal Essence */}
                  {metadata.legal_essence && (
                    <div className="legal-essence-text" style={{ marginTop: '10px' }}>{metadata.legal_essence}</div>
                  )}
                  {/* Related Statutes / Cases */}
                  {metadata.related_statutes && Array.isArray(metadata.related_statutes) && metadata.related_statutes.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <span className="field-label" style={{ display: 'block', marginBottom: '4px' }}>Related Statutes</span>
                      <div className="card-chips-row">
                        {metadata.related_statutes.slice(0, 4).map((s: string, i: number) => (
                          <span key={i} className="theme-chip" style={{ background: 'rgba(139, 92, 246, 0.08)', borderColor: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {metadata.related_cases && Array.isArray(metadata.related_cases) && metadata.related_cases.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <span className="field-label" style={{ display: 'block', marginBottom: '4px' }}>Related Cases</span>
                      <div className="card-chips-row">
                        {metadata.related_cases.slice(0, 4).map((c: string, i: number) => (
                          <span key={i} className="theme-chip" style={{ background: 'rgba(245, 158, 11, 0.06)', borderColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* JUDGMENT CARD — Most detailed, institutional authority     */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {nodeType === 'judgment' && metadata._extracted_at && (
                <div className="judgment-card-sidebar">
                  <div className="judgment-header-sidebar">⚖️ Case Summary</div>
                  <div className="judgment-grid-sidebar">
                    {metadata.case_name && (
                      <div className="judgment-field-sidebar">
                        <span className="field-label">Case</span>
                        <span className="field-value">{metadata.case_name}</span>
                      </div>
                    )}
                    {metadata.legal_essence && (
                      <div className="judgment-field-sidebar">
                        <span className="legal-essence-text">{metadata.legal_essence}</span>
                      </div>
                    )}
                    {(metadata.citations || metadata.citation) && (
                      <div className="judgment-field-sidebar">
                        <span className="field-label">Citation</span>
                        <span className="field-value">
                          {Array.isArray(metadata.citations) ? metadata.citations.join(', ') : metadata.citation}
                        </span>
                      </div>
                    )}
                    {metadata.court && (
                      <div className="judgment-field-sidebar">
                        <span className="field-label">Court</span>
                        <span className="field-value">{metadata.court}</span>
                      </div>
                    )}
                    {(metadata.bench_type || metadata.bench) && (
                      <div className="judgment-field-sidebar">
                        <span className="field-label">Bench</span>
                        <span className="field-value">
                          {metadata.bench_type || metadata.bench}
                          {metadata.bench_strength ? ` (${metadata.bench_strength} Judges)` : ''}
                        </span>
                      </div>
                    )}
                    {metadata.date_of_judgment && (
                      <div className="judgment-field-sidebar">
                        <span className="field-label">Date</span>
                        <span className="field-value">{new Date(metadata.date_of_judgment).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    )}
                    {metadata.case_status && CASE_STATUS_BADGES[metadata.case_status] && (
                      <div className="judgment-field-sidebar">
                        <span className="field-label">Status</span>
                        <span 
                          className="case-status-pill"
                          style={{ color: CASE_STATUS_BADGES[metadata.case_status].color, background: CASE_STATUS_BADGES[metadata.case_status].bg }}
                        >
                          {CASE_STATUS_BADGES[metadata.case_status].label}
                        </span>
                      </div>
                    )}
                  </div>
                  {metadata.ratio_decidendi && (
                    <div className="ratio-box-sidebar">
                      <div className="ratio-label-sidebar">Ratio Decidendi</div>
                      <div className="ratio-text-sidebar">{metadata.ratio_decidendi}</div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* STATUTE CARD — Identity + Status + Themes                 */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {nodeType === 'statute' && metadata.short_title && (
                <div className="statute-card-sidebar">
                  <div className="statute-header-sidebar">📜 Act Information</div>
                  <div className="statute-grid-sidebar">
                    {/* L1: Identity */}
                    <div className="statute-field-sidebar">
                      <span className="field-label">Short Title</span>
                      <span className="field-value">{metadata.short_title}</span>
                    </div>
                    {metadata.act_number && (
                      <div className="statute-field-sidebar">
                        <span className="field-label">Act No.</span>
                        <span className="field-value">{metadata.act_number}</span>
                      </div>
                    )}
                    {/* L2: Status */}
                    {metadata.status && (
                      <div className="statute-field-sidebar">
                        <span className="field-label">Status</span>
                        <span className={`status-pill-sidebar ${metadata.status === 'in_force' ? 'status-active' : metadata.status === 'repealed' ? 'status-repealed' : 'status-partial'}`}>
                          {metadata.status === 'in_force' ? '● In Force' : metadata.status === 'repealed' ? '○ Repealed' : '◐ Partially Repealed'}
                        </span>
                      </div>
                    )}
                    {/* L3: Details */}
                    {metadata.legislative_list && (
                      <div className="statute-field-sidebar">
                        <span className="field-label">List</span>
                        <span className="field-value" style={{textTransform:'capitalize'}}>{metadata.legislative_list}</span>
                      </div>
                    )}
                    {metadata.date_of_enactment && (
                      <div className="statute-field-sidebar">
                        <span className="field-label">Enacted</span>
                        <span className="field-value">{metadata.date_of_enactment}</span>
                      </div>
                    )}
                    {metadata.replaces && (
                      <div className="statute-field-sidebar">
                        <span className="field-label">Replaces</span>
                        <span className="field-value" style={{ fontSize: '0.72rem' }}>{metadata.replaces}</span>
                      </div>
                    )}
                  </div>
                  {/* L4: Key Themes */}
                  {metadata.key_themes && Array.isArray(metadata.key_themes) && metadata.key_themes.length > 0 && (
                    <div className="card-chips-row">
                      {metadata.key_themes.slice(0, 5).map((theme: string, i: number) => (
                        <span key={i} className="theme-chip">{theme}</span>
                      ))}
                      {metadata.key_themes.length > 5 && (
                        <span className="chip-overflow">+{metadata.key_themes.length - 5} more</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* SECTION CARD — Redesigned: No bare act text wall           */}
              {/* Hierarchy: Identity → Essence → Classification → Essentials*/}
              {/* ═══════════════════════════════════════════════════════════ */}
              {nodeType === 'section' && metadata._extracted_at && (
                <div className="section-card-sidebar">
                  <div className="section-header-sidebar">§ Provision</div>
                  {/* L1: Identity */}
                  <div className="section-identity">
                    {metadata.section_number && (
                      <span className="section-number-display">Section {metadata.section_number}</span>
                    )}
                    {metadata.parent_statute && (
                      <span className="section-parent-statute">{metadata.parent_statute}</span>
                    )}
                  </div>
                  {/* L2: Core Meaning */}
                  {metadata.legal_essence && (
                    <div className="legal-essence-text">{metadata.legal_essence}</div>
                  )}
                  {/* L3: Classification — subtle, secondary */}
                  {(metadata.cognizable !== undefined || metadata.bailable !== undefined || metadata.compoundable !== undefined) && (
                    <div className="classification-chips">
                      {metadata.cognizable !== undefined && (
                        <span className={`classification-chip ${metadata.cognizable ? 'chip-yes' : 'chip-no'}`}>
                          {metadata.cognizable ? 'Cognizable' : 'Non-cognizable'}
                        </span>
                      )}
                      {metadata.bailable !== undefined && (
                        <span className={`classification-chip ${metadata.bailable ? 'chip-yes' : 'chip-no'}`}>
                          {metadata.bailable ? 'Bailable' : 'Non-bailable'}
                        </span>
                      )}
                      {metadata.compoundable !== undefined && (
                        <span className={`classification-chip ${metadata.compoundable ? 'chip-yes' : 'chip-no'}`}>
                          {metadata.compoundable ? 'Compoundable' : 'Non-compoundable'}
                        </span>
                      )}
                    </div>
                  )}
                  {/* L4: Essentials — compressed, max 5 */}
                  {metadata.essentials && Array.isArray(metadata.essentials) && metadata.essentials.length > 0 && (
                    <div className="essentials-section">
                      <span className="essentials-label">Essentials</span>
                      <ul className="essentials-list-sidebar">
                        {metadata.essentials.slice(0, 5).map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                        {metadata.essentials.length > 5 && (
                          <li className="chip-overflow-inline">+{metadata.essentials.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {/* Punishment */}
                  {metadata.punishment && (
                    <div className="section-punishment">
                      <span className="field-label">Punishment</span>
                      <span className="field-value">{metadata.punishment}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* CONSTITUTIONAL PROVISION CARD — Fixed schema               */}
              {/* Reads article_number/bare_text (not section_number)        */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {nodeType === 'constitutional_provision' && metadata._extracted_at && (
                <div className="constitutional-card-sidebar">
                  <div className="constitutional-header-sidebar">🏛 Constitutional Provision</div>
                  {/* L1: Identity */}
                  <div className="section-identity">
                    {(metadata.article_number || metadata.section_number) && (
                      <span className="section-number-display">Article {metadata.article_number || metadata.section_number}</span>
                    )}
                    {metadata.part && (
                      <span className="section-parent-statute">{metadata.part}</span>
                    )}
                  </div>
                  {/* L2: Core Meaning */}
                  {metadata.legal_essence && (
                    <div className="legal-essence-text">{metadata.legal_essence}</div>
                  )}
                  {/* L3: Constitutional Principles */}
                  {metadata.constitutional_principles && Array.isArray(metadata.constitutional_principles) && metadata.constitutional_principles.length > 0 && (
                    <div className="card-chips-row">
                      {metadata.constitutional_principles.slice(0, 3).map((principle: string, i: number) => (
                        <span key={i} className="theme-chip constitutional-chip">{principle}</span>
                      ))}
                    </div>
                  )}
                  {/* Amendment info */}
                  {metadata.amendment_details && (
                    <div className="sidebar-meta-line" style={{ marginTop: '8px' }}>
                      <span className="field-label">Amendment</span>
                      <span className="field-value" style={{ fontSize: '0.72rem' }}>{metadata.amendment_details}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* CHAPTER CARD — New, minimal                                */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {nodeType === 'chapter' && metadata._extracted_at && (
                <div className="chapter-card-sidebar">
                  <div className="chapter-header-sidebar">📖 Chapter</div>
                  {/* L1: Identity */}
                  <div className="section-identity">
                    {metadata.chapter_number && (
                      <span className="section-number-display">Chapter {metadata.chapter_number}</span>
                    )}
                    {metadata.parent_statute && (
                      <span className="section-parent-statute">{metadata.parent_statute}</span>
                    )}
                  </div>
                  {/* L4: Key Themes */}
                  {metadata.key_themes && Array.isArray(metadata.key_themes) && metadata.key_themes.length > 0 && (
                    <div className="card-chips-row">
                      {metadata.key_themes.slice(0, 3).map((theme: string, i: number) => (
                        <span key={i} className="theme-chip">{theme}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* DOCTRINE CARD — Expanded: name, essence, origin, status   */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {nodeType === 'doctrine' && metadata._extracted_at && (
                <div className="doctrine-card-sidebar">
                  <div className="doctrine-header-sidebar">💡 Doctrine</div>
                  {/* L1: Identity */}
                  {metadata.doctrine_name && (
                    <div className="doctrine-name-display">{metadata.doctrine_name}</div>
                  )}
                  {/* L2: Core Meaning */}
                  {metadata.legal_essence && (
                    <div className="legal-essence-text">{metadata.legal_essence}</div>
                  )}
                  {/* L3: Details */}
                  <div className="doctrine-grid-sidebar">
                    {metadata.origin_case && (
                      <div className="sidebar-meta-list">
                        <span className="field-label">Origin Case</span>
                        <span className="field-value">{metadata.origin_case}</span>
                      </div>
                    )}
                    {metadata.current_status && (
                      <div className="sidebar-meta-list">
                        <span className="field-label">Status</span>
                        <span className={`status-pill-sidebar ${metadata.current_status === 'Well-established' ? 'status-active' : 'status-partial'}`}>
                          {metadata.current_status}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* L4: Key Elements */}
                  {metadata.key_elements && Array.isArray(metadata.key_elements) && metadata.key_elements.length > 0 && (
                    <div className="essentials-section">
                      <span className="essentials-label">Key Elements</span>
                      <ul className="essentials-list-sidebar">
                        {metadata.key_elements.slice(0, 4).map((el: string, i: number) => (
                          <li key={i}>{el}</li>
                        ))}
                        {metadata.key_elements.length > 4 && (
                          <li className="chip-overflow-inline">+{metadata.key_elements.length - 4} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* CONCEPT CARD — New: concept + translation + maxims        */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {nodeType === 'concept' && metadata._extracted_at && (
                <div className="concept-card-sidebar">
                  <div className="concept-header-sidebar">🧠 Concept</div>
                  {/* L1: Identity + Translation */}
                  {metadata.concept_name && (
                    <div className="concept-name-display">{metadata.concept_name}</div>
                  )}
                  {metadata.translation && (
                    <div className="concept-translation">"{metadata.translation}"</div>
                  )}
                  {/* L2: Core Meaning */}
                  {metadata.legal_essence && (
                    <div className="legal-essence-text">{metadata.legal_essence}</div>
                  )}
                  {/* L3: Explanation */}
                  {metadata.explanation_summary && (
                    <div className="concept-explanation">{metadata.explanation_summary}</div>
                  )}
                  {/* L4: Related Maxims */}
                  {metadata.related_maxims && Array.isArray(metadata.related_maxims) && metadata.related_maxims.length > 0 && (
                    <div className="concept-maxims">
                      <span className="essentials-label">Related Maxims</span>
                      <div className="card-chips-row">
                        {metadata.related_maxims.slice(0, 3).map((maxim: string, i: number) => (
                          <span key={i} className="theme-chip maxim-chip">{maxim}</span>
                        ))}
                        {metadata.related_maxims.length > 3 && (
                          <span className="chip-overflow">+{metadata.related_maxims.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================
            ZONE 3: COMMUNITY LAYER
            Meaning: "How is this knowledge evolving socially?"
            Tone: collaborative, living archive
            ======================================================== */}
        <div className="sidebar-zone community-layer-zone">
          <h3 className="zone-header">Community Layer</h3>
          
          <div className="community-layer-card">
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Scholarly Discussion</h4>
            <p className="context-instructions" style={{ marginBottom: '16px' }}>
              Propose changes, cite primary sources, and discuss with the community before updating the article.
            </p>
            <Link
              href={`/topic/${slug}/discussion`}
              className="context-discussion-btn"
            >
              Open Discussion
            </Link>
          </div>
          
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'transparent', borderRadius: '8px', border: '1px dashed var(--border-subtle)' }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5, textAlign: 'center' }}>
              Every edit is permanently recorded in the edit history.<br/>Transparency is our guarantee of quality.
            </p>
          </div>
        </div>

      </aside>
    </div>
  );
}
