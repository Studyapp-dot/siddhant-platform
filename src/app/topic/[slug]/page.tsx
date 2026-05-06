import React from 'react';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import ReportContent from '@/app/components/ReportContent';
import CrossReferences from '@/app/components/CrossReferences';
import FollowButton from '@/app/components/FollowButton';
import FlagIssuePanel from '@/app/components/FlagIssuePanel';
import QualityAssessment from '@/app/components/QualityAssessment';
import QualityVoting from '@/app/components/QualityVoting';
import PeerReviewPanel from '@/app/components/PeerReviewPanel';
import ContributorSpotlight from '@/app/components/ContributorSpotlight';
import ArticleEndorsementBar from '@/app/components/ArticleEndorsementBar';
import SystemTooltip from '@/app/components/SystemTooltip';
import TrustBadge from '@/app/components/TrustBadge';
import ReviewPipeline from '@/app/components/ReviewPipeline';
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
  good_article: 'Independently reviewed, meets editorial standards',
  featured: 'Definitive scholarly resource',
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

export default async function TopicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ revision?: string }> }) {
  const { slug } = await params;
  const { revision: viewRevisionId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fire-and-forget: process any pending edit acceptances (72h lazy evaluation)
  processEditAcceptance().catch(() => {});

  const { data: node } = await supabase
    .from('nodes')
    .select('id, title, node_type, metadata, parent_node_id, quality_tier, quality_reviewed_revision_id')
    .eq('slug', slug)
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
      .select(`id, report_content, tier1_content, created_at, content_size, author_id, is_revert, is_reverted, profiles!revisions_author_id_fkey ( username, role )`)
      .eq('id', viewRevisionId)
      .eq('node_id', node.id);
    revisionRows = result.data;
    revisionError = result.error;
    isViewingOldRevision = true;
  } else {
    // Default: latest revision
    const result = await supabase
      .from('revisions')
      .select(`id, report_content, tier1_content, created_at, content_size, author_id, is_revert, is_reverted, profiles!revisions_author_id_fkey ( username, role )`)
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
  const authorName = profileData?.username || 'Unknown';
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

        {/* Compact wiki stats */}
        <div className="sidebar-stats-bar">
          <div className="sidebar-stat">
            <span className="sidebar-stat-value">{revisionCount ?? 0}</span>
            <span className="sidebar-stat-label">{(revisionCount ?? 0) === 1 ? 'Revision' : 'Revisions'}</span>
          </div>
          <div className="sidebar-stat-divider" />
          <div className="sidebar-stat">
            <span className="sidebar-stat-value">{uniqueContributors}</span>
            <span className="sidebar-stat-label">{uniqueContributors === 1 ? 'Contributor' : 'Contributors'}</span>
          </div>
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

        {/* Unified Quality History Ledger */}
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
              <Link href={`/profile/${authorName}`} className="meta-author-link">@{authorName}</Link>
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
          </div>

          {/* Actions — Edit and Follow at equal weight, Cite secondary */}
          <div className="topic-actions">
            {user ? (
              <>
                <Link href={`/topic/${slug}/edit`} className="btn-wiki-edit" style={{ textDecoration: 'none' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  Improve this page
                </Link>
                <FollowButton nodeId={node.id} slug={slug} isFollowing={isFollowing} />
              </>
            ) : (
              <Link href="/login" className="btn-utility">Login to contribute</Link>
            )}
            <button className="btn-cite">Cite Node</button>
          </div>

          {/* Wiki collaboration signals */}
          <div className="wiki-signals">
            <span className="wiki-signal-item">📝 {revisionCount ?? 0} {(revisionCount ?? 0) === 1 ? 'revision' : 'revisions'}</span>
            <span className="wiki-signal-sep">·</span>
            <span className="wiki-signal-item">👥 {uniqueContributors} {uniqueContributors === 1 ? 'contributor' : 'contributors'}</span>
            <span className="wiki-signal-sep">·</span>
            <span className="wiki-signal-item">Open for improvement</span>
            {/* Quality Voting — subtle inline, moved from badge row */}
            {!isViewingOldRevision && currentUserRole && !['good_article', 'featured'].includes((node as any).quality_tier || 'stub') && (
              <>
                <span className="wiki-signal-sep">·</span>
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
        </header>

        {/* Spotlight & Review Infrastructure */}
        {!isViewingOldRevision && (
          <ContributorSpotlight
            revision={revision}
            previousRevision={previousRevision}
            slug={slug}
            revisionCount={revisionCount ?? 0}
            user={user}
            allRevisionIds={allRevisionIds}
            currentUserRole={currentUserRole}
          />
        )}

        {!isViewingOldRevision && (
          <ArticleEndorsementBar nodeId={node.id} slug={slug} />
        )}

        {/* Fallback legacy banner for old revisions */}
        {isViewingOldRevision && (
          <div className="last-updated-banner" style={{ opacity: 0.7, background: 'rgba(0,0,0,0.1)' }}>
            <div className="last-updated-left">
              <svg className="last-updated-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span className="last-updated-text">
                This is a historical revision from <strong>{editedDate}</strong> by{' '}
                <Link href={`/profile/${authorName}`} className="last-updated-author">@{authorName}</Link>
              </span>
            </div>
            <div className="last-updated-right">
              <Link href={`/topic/${slug}/history`} className="last-updated-history-link">
                View History →
              </Link>
            </div>
          </div>
        )}

        {/* Child Nodes (sub-hierarchy) */}
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

        {/* Report Content */}
        <div className="legal-content">
          <ReportContent content={reportContent} />
        </div>

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

        {/* Review Pipeline — Visual trust evolution (hidden on old revisions) */}
        {!isViewingOldRevision && (
          <ReviewPipeline
            qualityTier={(node as any).quality_tier || 'stub'}
            hasActiveReviewCycle={hasActiveReviewCycle}
            totalQualityVotes={totalQualityVoteCount ?? 0}
            lastTierChangeDate={lastAssessment?.created_at || null}
            completedReviewCycles={completedReviewCycleCount ?? 0}
          />
        )}

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
      </main>

      {/* Context Panel */}
      <aside className="context-panel">
        
        {/* Quick Reference — Moved to Sidebar to keep analysis above-the-fold */}
        {nodeType !== 'topic' && (
          <div className="sidebar-quick-ref">
            <div className="sidebar-section-header">
              <span className="ref-header">Quick Reference</span>
              {metadata._extracted_at && <span className="ref-source-pill">AI-Derived</span>}
            </div>

            {/* Analyzing placeholder */}
            {!metadata._extracted_at && Object.keys(metadata).length === 0 && (
              <div className="analyzing-placeholder-sidebar">
                <span className="analyzing-shimmer">◎</span>
                <span>Extracting reference data...</span>
              </div>
            )}

            {/* Restored High-Detail Judgment Card */}
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

            {/* Restored High-Detail Statute Card */}
            {nodeType === 'statute' && metadata.short_title && (
              <div className="statute-card-sidebar">
                <div className="statute-header-sidebar">📜 Act Information</div>
                <div className="statute-grid-sidebar">
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
                </div>
              </div>
            )}

            {/* Section / Bare Act Text */}
            {(nodeType === 'section' || nodeType === 'constitutional_provision') && metadata.bare_act_text && (
              <div className="bare-act-card-sidebar">
                <div className="bare-act-header-sidebar">
                  <span>{nodeType === 'section' ? '§ Provision' : '🏛 Article'}</span>
                  {metadata.section_number && <span>{nodeType === 'section' ? 'Section' : 'Art.'} {metadata.section_number}</span>}
                </div>
                <div className="bare-act-text-sidebar">{metadata.bare_act_text}</div>
                {metadata.punishment && (
                  <div className="sidebar-meta-line">
                    <strong>Punishment:</strong> {metadata.punishment}
                  </div>
                )}
              </div>
            )}

            {/* Doctrine Card */}
            {nodeType === 'doctrine' && (
              <div className="doctrine-card-sidebar">
                <div className="doctrine-header-sidebar">💡 Doctrine Details</div>
                {metadata.origin_case && (
                  <div className="sidebar-meta-list">
                    <span className="field-label">Origin Case</span>
                    <span className="field-value">{metadata.origin_case}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <h3>Discussion</h3>
        <p className="context-instructions">
          Propose changes, cite primary sources, and discuss with the community before updating the article.
        </p>
        <Link
          href={`/topic/${slug}/discussion`}
          className="context-discussion-btn"
        >
          Open Discussion
        </Link>
        <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Every edit is permanently recorded in the edit history. Transparency is our guarantee of quality.
          </p>
        </div>
      </aside>
    </div>
  );
}
