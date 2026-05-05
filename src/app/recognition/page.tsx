import React from 'react';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { getRecognitionFeed, getUserEndorsementState, FeedFilter } from '@/app/actions/recognition-feed';
import { getReputationBreakdown } from '@/app/actions/reputation';
import FeedCard from './FeedCard';
import {
  aggregateEndorsements,
  AggregatedEndorsement,
  getContributionThesisFromSummary,
  getImportanceScore,
  getRoleMeta,
} from './feedUtils';
import './recognition.css';

interface RecognitionPageProps {
  searchParams: Promise<{ filter?: string; node?: string }>;
}

type ReputationBreakdown = NonNullable<Awaited<ReturnType<typeof getReputationBreakdown>>>;

/**
 * SIDDHANT: Community Recognition & Activity Feed
 * 
 * A public ledger of intellectual credibility.
 * 3-section layout: Featured → High Value → Recent
 * Importance-based sorting, endorsement aggregation, personal credibility sidebar.
 */
export default async function RecognitionPage({ searchParams }: RecognitionPageProps) {
  const { filter = 'all', node: nodeSlug } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch feed items
  const { items, error } = await getRecognitionFeed(filter as FeedFilter, 80, 0, nodeSlug);

  // Fetch current user's endorsement state
  let userEndorseState = { acknowledgedIds: [] as string[], endorsedIds: [] as string[] };
  if (user && items.length > 0) {
    const revisionIds = items
      .filter(i => i.activity_type === 'revision')
      .map(i => i.activity_id);
    if (revisionIds.length > 0) {
      userEndorseState = await getUserEndorsementState(revisionIds);
    }
  }

  // Fetch user's own reputation breakdown (for sidebar)
  let userRep: ReputationBreakdown | null = null;
  if (user) {
    userRep = await getReputationBreakdown(user.id);
  }

  // ── Aggregate endorsements ──────────────────────────────────────────────
  const { aggregated, remaining } = aggregateEndorsements(items);

  // ── Sort remaining by importance then recency ──────────────────────────
  const sorted = [...remaining].sort((a, b) => {
    const impDiff = getImportanceScore(b) - getImportanceScore(a);
    if (impDiff !== 0) return impDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // ── Split into 3 sections ─────────────────────────────────────────────
  // Featured: top 2 by importance (from last 48 hours)
  const now = new Date().getTime();
  const fortyEightHours = 48 * 60 * 60 * 1000;
  const recentHighImpact = sorted.filter(
    i => (now - new Date(i.created_at).getTime()) < fortyEightHours
  );
  const featured = recentHighImpact.slice(0, 2);
  const featuredIds = new Set(featured.map(i => i.activity_id));

  // High Value: importance >= 3 (scholar_star, endorsement, substantive revision, quality_assessment)
  const highValue = sorted.filter(
    i => !featuredIds.has(i.activity_id) && getImportanceScore(i) >= 3
  );

  // Recent: everything else
  const highValueIds = new Set(highValue.map(i => i.activity_id));
  const recent = sorted.filter(
    i => !featuredIds.has(i.activity_id) && !highValueIds.has(i.activity_id)
  );

  // ── Sidebar stats ─────────────────────────────────────────────────────
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const weekItems = items.filter(i => new Date(i.created_at) >= weekAgo);
  const totalStars = items.filter(i => i.activity_type === 'scholar_star').length;
  const activeScholars = new Set(items.map(i => i.actor_id)).size;
  const semanticItems = items.filter(i => i.contribution_thesis);
  const substantialSemanticItems = semanticItems.filter(
    i => i.scholarly_significance === 'substantial' || i.scholarly_significance === 'foundational'
  );
  const contributionTypeCounts = new Map<string, number>();
  for (const item of semanticItems) {
    if (!item.contribution_type) continue;
    contributionTypeCounts.set(item.contribution_type, (contributionTypeCounts.get(item.contribution_type) || 0) + 1);
  }
  const topContributionTypes = [...contributionTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Top contributors this week (from feed data)
  const contributorMap = new Map<string, { username: string; role: string; points: number }>();
  for (const item of weekItems) {
    const existing = contributorMap.get(item.actor_id);
    const pts = getImportanceScore(item);
    if (existing) {
      existing.points += pts;
    } else {
      contributorMap.set(item.actor_id, { username: item.actor_username, role: item.actor_role, points: pts });
    }
  }
  const topContributors = [...contributorMap.values()]
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  // User's own weekly points
  const userWeeklyPoints = user
    ? weekItems.filter(i => i.actor_id === user.id).reduce((acc, i) => acc + getImportanceScore(i), 0)
    : 0;

  // Percentile calculation (from all-time feed data)
  const allContributorScores = new Map<string, number>();
  for (const item of items) {
    allContributorScores.set(item.actor_id, (allContributorScores.get(item.actor_id) || 0) + getImportanceScore(item));
  }
  let userPercentile = 0;
  if (user && allContributorScores.size > 1) {
    const userScore = allContributorScores.get(user.id) || 0;
    const scoresBelow = [...allContributorScores.values()].filter(s => s < userScore).length;
    userPercentile = Math.round((scoresBelow / allContributorScores.size) * 100);
  }

  return (
    <div className="recognition-layout premium-layout">
      {/* ═══════════════ SIDEBAR ═══════════════ */}
      <aside className="recognition-sidebar">
        {/* Your Status (logged-in users) */}
        {userRep && (
          <div className="sidebar-card glass-panel">
            <h3>Your Status</h3>
            <div className="sidebar-status-block">
              <div className="sidebar-role-display" style={{ background: getRoleMeta(userRep.role).bgTint, borderColor: `${getRoleMeta(userRep.role).color}30` }}>
                <span className="sidebar-role-icon">{getRoleMeta(userRep.role).icon}</span>
                <span className="sidebar-role-label" style={{ color: getRoleMeta(userRep.role).color }}>
                  {userRep.role_label}
                </span>
              </div>
              <div>
                <div className="sidebar-rep-score">{userRep.reputation_score}</div>
                <div className="sidebar-rep-label">Reputation</div>
              </div>
              {userRep.next_level && (
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Progress to {userRep.next_level.name}
                  </div>
                  <div className="sidebar-progress-bar">
                    <div className="sidebar-progress-fill" style={{
                      width: `${Math.min(100, Math.round((userRep.reputation_score / userRep.next_level.requirements.reputation.needed) * 100))}%`
                    }} />
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {userRep.reputation_score} / {userRep.next_level.requirements.reputation.needed} rep
                  </div>
                </div>
              )}
              <div>
                <div className="sidebar-week-stat" style={{ color: '#22c55e' }}>+{userWeeklyPoints}</div>
                <div className="sidebar-rep-label">This Week</div>
              </div>
              {userPercentile > 0 && (
                <div className="sidebar-percentile">
                  You are in the <strong>top {Math.max(1, 100 - userPercentile)}%</strong> of contributors
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feed Filters */}
        <div className="sidebar-card glass-panel">
          <h3>Recognition Feed</h3>
          <nav className="recognition-nav">
            <Link href="/recognition" className={`rec-nav-item ${filter === 'all' ? 'active' : ''}`}>
              🌎 All Activity
            </Link>
            <Link href="/recognition?filter=recognition" className={`rec-nav-item ${filter === 'recognition' ? 'active' : ''}`}>
              🏅 Endorsements
            </Link>
            <Link href="/recognition?filter=scholar_star" className={`rec-nav-item ${filter === 'scholar_star' ? 'active' : ''}`}>
              ⭐ Scholar Stars
            </Link>
            <Link href="/recognition?filter=revision" className={`rec-nav-item ${filter === 'revision' ? 'active' : ''}`}>
              📝 Latest Edits
            </Link>
            <Link href="/recognition?filter=quality" className={`rec-nav-item ${filter === 'quality' ? 'active' : ''}`}>
              ⚖️ Quality Assessments
            </Link>
            <Link href="/recognition?filter=community" className={`rec-nav-item ${filter === 'community' ? 'active' : ''}`}>
              🏛 Community
            </Link>
          </nav>
        </div>

        {/* Top Contributors This Week */}
        {topContributors.length > 0 && (
          <div className="sidebar-card glass-panel">
            <h3>Top This Week</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topContributors.map((c, idx) => (
                <div key={c.username} className="sidebar-leaderboard-item">
                  <span className="sidebar-leaderboard-rank">{idx + 1}.</span>
                  <Link href={`/profile/${c.username}`} className="sidebar-leaderboard-name" style={{ textDecoration: 'none' }}>
                    {c.username}
                  </Link>
                  <span className="sidebar-leaderboard-score">+{c.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Community Pulse */}
        <div className="sidebar-card glass-panel">
          <h3>Scholarly Ledger</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--color-gold)', lineHeight: 1 }}>
                {totalStars}
              </div>
              <div className="sidebar-rep-label">Scholar Stars Awarded</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', lineHeight: 1 }}>
                {activeScholars}
              </div>
              <div className="sidebar-rep-label">Active Contributors</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#8b5cf6', lineHeight: 1 }}>
                {semanticItems.length}
              </div>
              <div className="sidebar-rep-label">Semantic Contributions</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#2563eb', lineHeight: 1 }}>
                {substantialSemanticItems.length}
              </div>
              <div className="sidebar-rep-label">Substantial / Foundational</div>
            </div>
            {topContributionTypes.length > 0 && (
              <div className="sidebar-semantic-types">
                {topContributionTypes.map(([type, count]) => (
                  <div key={type} className="sidebar-semantic-type">
                    <span>{type.replace(/_/g, ' ')}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="sidebar-card glass-panel">
          <h3>Navigation</h3>
          <nav className="recognition-nav">
            <Link href="/recent-changes" className="rec-nav-item">🔥 Scholarly Chronicle</Link>
            <Link href="/dashboard" className="rec-nav-item">🏠 Scholar's Desk</Link>
            <Link href="/nodes" className="rec-nav-item">🔗 Knowledge Archive</Link>
          </nav>
        </div>
      </aside>

      {/* ═══════════════ MAIN FEED ═══════════════ */}
      <main className="feed-container">
        <header className="feed-header">
          <h1 className="heading-premium">Community Recognition</h1>
          <p>The verifiable record of scholarly excellence, peer acknowledgement, and collective reasoning.</p>
        </header>

        {error && (
          <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', color: '#ef4444', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        {/* ── SECTION: FEATURED ── */}
        {featured.length > 0 && (
          <>
            <div className="feed-section-header featured">
              <span className="feed-section-icon">⭐</span>
              <span className="feed-section-title">Featured</span>
            </div>
            <div className="feed-list feed-list-featured">
              {featured.map(item => (
                <FeedCard
                  key={item.activity_id}
                  item={item}
                  currentUser={user}
                  initialAcknowledged={userEndorseState.acknowledgedIds.includes(item.activity_id)}
                  initialEndorsed={userEndorseState.endorsedIds.includes(item.activity_id)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── SECTION: AGGREGATED ENDORSEMENTS ── */}
        {aggregated.length > 0 && (
          <>
            <div className="feed-section-header high-value">
              <span className="feed-section-icon">🏛</span>
              <span className="feed-section-title">Community Endorsements</span>
            </div>
            <div className="feed-list feed-list-endorsements">
              {aggregated.map(agg => (
                <AggregatedEndorsementCard key={agg.targetRevisionId} agg={agg} />
              ))}
            </div>
          </>
        )}

        {/* ── SECTION: HIGH VALUE ── */}
        {highValue.length > 0 && (
          <>
            <div className="feed-section-header high-value">
              <span className="feed-section-icon">🏅</span>
              <span className="feed-section-title">Recognized Contributions</span>
            </div>
            <div className="feed-list feed-list-high-value">
              {highValue.map(item => (
                <FeedCard
                  key={item.activity_id}
                  item={item}
                  currentUser={user}
                  initialAcknowledged={userEndorseState.acknowledgedIds.includes(item.activity_id)}
                  initialEndorsed={userEndorseState.endorsedIds.includes(item.activity_id)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── SECTION: RECENT ── */}
        {recent.length > 0 && (
          <>
            <div className="feed-section-header">
              <span className="feed-section-icon">📋</span>
              <span className="feed-section-title">Recent Activity</span>
            </div>
            <div className="feed-list feed-list-recent">
              {recent.map(item => (
                <FeedCard
                  key={item.activity_id}
                  item={item}
                  currentUser={user}
                  initialAcknowledged={userEndorseState.acknowledgedIds.includes(item.activity_id)}
                  initialEndorsed={userEndorseState.endorsedIds.includes(item.activity_id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {items.length === 0 && !error && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '80px 40px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🏅</div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>The stage is yours.</h3>
            <p>Be the first to endorse a scholar and spark a discussion in this category.</p>
          </div>
        )}
      </main>
    </div>
  );
}


/* ─── Aggregated Endorsement Card (Server Component) ─── */
function AggregatedEndorsementCard({ agg }: { agg: AggregatedEndorsement }) {
  const topEndorsers = agg.endorsers.slice(0, 3);
  const remainingCount = agg.endorsers.length - topEndorsers.length;
  const contributionThesis = agg.contributionThesis
    || getContributionThesisFromSummary(agg.sourceCommitMessage, agg.nodeTitle);

  // Count roles for emphasis (e.g., "2 Senior Scholars")
  const roleCounts = new Map<string, number>();
  for (const e of agg.endorsers) {
    const role = getRoleMeta(e.role);
    roleCounts.set(role.label, (roleCounts.get(role.label) || 0) + 1);
  }
  const roleBreakdown = [...roleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${count} ${label}${count > 1 ? 's' : ''}`)
    .join(', ');

  return (
    <div className="aggregated-endorsement-card">
      <div className="aec-header">
        {/* Avatar stack */}
        <div className="aec-avatar-stack">
          {topEndorsers.map((e, i) => {
            const role = getRoleMeta(e.role);
            return (
              <div
                key={e.username}
                className="aec-avatar-circle"
                style={{ background: role.color, zIndex: 10 - i, marginLeft: i > 0 ? '-8px' : '0' }}
                title={`@${e.username} • ${role.label}`}
              >
                {e.username.charAt(0).toUpperCase()}
              </div>
            );
          })}
          {remainingCount > 0 && (
            <div className="aec-avatar-circle aec-avatar-more" style={{ marginLeft: '-8px' }}>
              +{remainingCount}
            </div>
          )}
        </div>

        <div className="aec-title-block">
          <div className="aec-title">
            <b>{agg.endorsers.length} scholars</b> endorsed{' '}
            {agg.recipientUsername && (
              <Link href={`/profile/${agg.recipientUsername}`} style={{ color: 'var(--color-gold)', textDecoration: 'none', fontWeight: 700 }}>
                @{agg.recipientUsername}
              </Link>
            )}
            {"'s contribution"}
          </div>
          <div className="aec-role-breakdown">{roleBreakdown}</div>
        </div>
      </div>

      <section className="scholarly-evidence-record scholarly-evidence-record-aggregate">
        <div className="ser-label">
          Contribution thesis
          {agg.contributionThesis && <span className="ser-ai-label">AI extracted</span>}
        </div>
        <p className="ser-thesis">{contributionThesis}</p>
        {(agg.contributionType || agg.scholarlySignificance) && (
          <div className="ser-semantic-badges">
            {agg.contributionType && (
              <span className="ser-semantic-badge">{agg.contributionType.replace(/_/g, ' ')}</span>
            )}
            {agg.scholarlySignificance && (
              <span className="ser-semantic-badge">{agg.scholarlySignificance}</span>
            )}
          </div>
        )}
        {(agg.claimsAdded.length > 0 || agg.conceptsIntroduced.length > 0) && (
          <div className="ser-claims-grid">
            {agg.claimsAdded.length > 0 && (
              <div>
                <span className="ser-mini-label">Claims added</span>
                <ul>
                  {agg.claimsAdded.slice(0, 3).map(claim => <li key={claim}>{claim}</li>)}
                </ul>
              </div>
            )}
            {agg.conceptsIntroduced.length > 0 && (
              <div>
                <span className="ser-mini-label">Concepts introduced</span>
                <ul>
                  {agg.conceptsIntroduced.slice(0, 3).map(concept => <li key={concept}>{concept}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
        {agg.sourceCommitMessage && (
          <div className="ser-meta-row">
            <span className="ser-source-summary">
              Source edit summary: &quot;{agg.sourceCommitMessage}&quot;
            </span>
          </div>
        )}
      </section>

      {agg.endorsers.length >= 2 && (
        <div className="endorsement-dimension-row">
          <span className="endorsement-dimension-label">Community signal</span>
          <span className="endorsement-dimension-value">
            {agg.endorsers.length} independent endorsements
          </span>
          <span className="endorsement-dimension-value">
            {roleBreakdown}
          </span>
        </div>
      )}

      {/* Impact Statement */}
      <div className="aec-impact">
        <span className="impact-statement-prominent">
          ✦ {agg.nodeTitle ? `Validated analytical depth on ${agg.nodeTitle}` : 'Validated scholarly contribution'}
        </span>
      </div>

      <div className="aec-badges">
        <span className="impact-badge impact-badge-purple impact-badge-primary">
          +{agg.endorsers.length * 10} Total Rep Impact
        </span>
        {agg.nodeSlug && (
          <Link href={`/topic/${agg.nodeSlug}`} className="impact-badge impact-badge-link">
            § {agg.nodeTitle}
          </Link>
        )}
        {agg.sourceRevisionId && agg.nodeSlug && (
          <Link href={`/topic/${agg.nodeSlug}/compare?rev=${agg.sourceRevisionId}`} className="impact-badge impact-badge-link">
            📄 View Changes →
          </Link>
        )}
      </div>
    </div>
  );
}
