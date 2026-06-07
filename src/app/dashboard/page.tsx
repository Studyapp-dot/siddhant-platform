import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import './dashboard.css';
import '../community-core.css';
import '../page.css'; // For pulse animations
import {
  getLastVisitAt,
  updateLastVisit,
  getPersonalActivity,
  getWatchlistWithDeltas,
  getRecognitionSummary,
  getPendingOpportunities,
} from '@/app/actions/dashboard-data';
import { toPublicRevisionText } from '@/utils/revision-presentation';

interface DashboardPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=Sign+in+to+access+your+dashboard.');
  }

  // 1. Fetch User Profile & Stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 2. Fetch last_visit_at BEFORE updating it (so we have the previous timestamp)
  const lastVisitAt = await getLastVisitAt(user.id);

  // 3. Engagement data — all in parallel
  const [
    personalActivity,
    watchlistData,
    recognitionSummary,
    pendingOpportunities,
  ] = await Promise.all([
    getPersonalActivity(user.id),
    getWatchlistWithDeltas(user.id, lastVisitAt),
    getRecognitionSummary(user.id, lastVisitAt),
    getPendingOpportunities(user.id, lastVisitAt),
  ]);

  // 4. Fetch Global Activity (Latest Revisions) — secondary feed
  const { data: activity } = await supabase
    .from('revisions')
    .select(`
      id, 
      commit_message, 
      created_at,
      is_revert,
      is_reverted,
      nodes!revisions_node_id_fkey(title, slug), 
      profiles!revisions_author_id_fkey(username)
    `)
    .order('created_at', { ascending: false })
    .limit(6);

  // 5. Handle Search Results (if q is present)
  let searchResults: any[] = [];
  if (q && q.trim().length > 0) {
    const { data } = await supabase
      .from('nodes')
      .select('id, slug, title')
      .is('deleted_at', null)
      .ilike('title', `%${q.trim()}%`)
      .order('title')
      .limit(20);
    searchResults = data ?? [];
  }

  // 6. Fetch total contribution counts
  const [{ count: totalEdits }, { count: totalDiscussions }, { count: totalTags }, { count: totalGroupPosts }] = await Promise.all([
    supabase.from('revisions').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
    supabase.from('discussions').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
    supabase.from('inline_tags').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
    supabase.from('group_discussions').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
  ]);
  const totalContributions = (totalEdits ?? 0) + (totalDiscussions ?? 0) + (totalTags ?? 0) + (totalGroupPosts ?? 0);

  // 7. Fetch user's group memberships with group details
  const { data: userGroups } = await supabase
    .from('subject_group_members')
    .select(`
      role, joined_at,
      group:subject_groups!subject_group_members_group_id_fkey ( id, name, slug, icon )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true });

  // Fetch recent activity count per group (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const groupActivityCounts: Record<string, number> = {};
  const userGroupIds = (userGroups || []).map((g: any) => g.group?.id).filter(Boolean);
  if (userGroupIds.length > 0) {
    const { data: recentPosts } = await supabase
      .from('group_discussions')
      .select('group_id')
      .in('group_id', userGroupIds)
      .gte('created_at', weekAgo);
    for (const p of (recentPosts || [])) {
      groupActivityCounts[p.group_id] = (groupActivityCounts[p.group_id] ?? 0) + 1;
    }
  }

  const username = profile?.username || user.email?.split('@')[0] || 'Scholar';
  const role = profile?.role || 'contributor';
  const reputation = profile?.reputation_score || 0;

  // Role display labels for the 6-level hierarchy
  const roleLabels: Record<string, string> = {
    reader: 'Reader',
    contributor: 'Contributor',
    recognized: 'Recognized Contributor',
    senior_scholar: 'Senior Scholar',
    steward: 'Steward',
    governance_council: 'Governance Council',
  };
  const roleLabel = roleLabels[role] || role;

  // Compute "since your last visit" time display
  const isFirstVisit = !lastVisitAt;
  const timeSinceLastVisit = lastVisitAt
    ? getTimeSince(new Date(lastVisitAt))
    : null;

  // Count total watchlist changes
  const totalWatchlistChanges = watchlistData.reduce((sum, w) => sum + w.newEdits, 0);

  // Check if user has meaningful activity to show
  const hasPersonalActivity = personalActivity.revisions.length > 0 || personalActivity.discussions.length > 0;
  const hasRecognition = recognitionSummary.total > 0;
  const hasOpportunities = pendingOpportunities.newMessages > 0 || pendingOpportunities.newDiscussionsOnYourWork > 0;

  // 8. Update last_visit_at AFTER reading all data (non-blocking)
  updateLastVisit(user.id).catch(() => {});

  return (
    <div className="dashboard-container premium-layout">
      {/* HEADER */}
      <header className="dashboard-header">
        <div className="dashboard-title-group">
          <h1 className="heading-premium" style={{ fontFamily: 'var(--font-serif)' }}>Scholar's Desk</h1>
          <p style={{ fontSize: '0.88rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
            Welcome back, <strong style={{ color: 'var(--color-gold)' }}>@{username}</strong>
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {roleLabel} · {reputation} reputation points
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link href="/topic/new" className="btn-primary">
            + New Topic
          </Link>
          <Link href="/nodes" className="btn-secondary">
            Explore the Archive →
          </Link>
        </div>
      </header>

      {/* "SINCE YOUR LAST VISIT" BANNER — Trigger Architecture */}
      {!isFirstVisit && (totalWatchlistChanges > 0 || hasRecognition || hasOpportunities) && (
        <div className="since-visit-banner">
          <span className="since-visit-icon">📡</span>
          <div className="since-visit-text">
            <p>
              <strong>Since you were away</strong> ({timeSinceLastVisit}) — the knowledge graph has evolved.
            </p>
          </div>
          <div className="since-visit-stats">
            {totalWatchlistChanges > 0 && (
              <div className="since-visit-stat">
                <span className="since-visit-stat-value">{totalWatchlistChanges}</span>
                <span className="since-visit-stat-label">Watchlist edits</span>
              </div>
            )}
            {hasRecognition && (
              <div className="since-visit-stat">
                <span className="since-visit-stat-value">{recognitionSummary.total}</span>
                <span className="since-visit-stat-label">Recognition</span>
              </div>
            )}
            {pendingOpportunities.newMessages > 0 && (
              <div className="since-visit-stat">
                <span className="since-visit-stat-value">{pendingOpportunities.newMessages}</span>
                <span className="since-visit-stat-label">Messages</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OMNIBAR SEARCH */}
      <section className="dashboard-search-section">
        <form method="GET" action="/dashboard" className="omnibar-wrapper">
          <span className="omnibar-icon">🔍</span>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Command concepts, articles, or case law..."
            autoFocus={!!q}
            className="omnibar-input"
          />
        </form>

        {q && (
          <div style={{ marginTop: '3rem', maxWidth: '800px', margin: '3rem auto 0' }}>
            <h4 className="dash-section-title"><span></span> Intelligence Matches for &quot;{q}&quot;</h4>
            {searchResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {searchResults.map((res: any) => (
                  <Link key={res.id} href={`/topic/${res.slug}`} style={{ textDecoration: 'none' }}>
                    <div className="activity-item">
                      <div className="activity-content">
                        <span className="activity-node-link">{res.title}</span>
                        <div className="activity-meta">/topic/{res.slug}</div>
                      </div>
                      <span style={{ color: 'var(--color-gold)', fontSize: '1.2rem' }}>→</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>No exact matches found in the archive.</p>
                <Link href={`/topic/new?title=${encodeURIComponent(q)}`} className="btn-primary" style={{ marginTop: '1.5rem' }}>
                  + Start a New Topic: &quot;{q}&quot;
                </Link>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="dashboard-grid">
        {/* LEFT: SCHOLAR STATS */}
        <aside className="stats-card glass-panel">
          <div className="stats-card-header">
            <div className="stats-avatar">{username.charAt(0).toUpperCase()}</div>
            <div className="stats-id">
              <h3>@{username}</h3>
              <span>{roleLabel}</span>
            </div>
          </div>
          
          <div className="stats-row">
            <div className="stat-box">
              <div className="stat-box-label">Reputation Points</div>
              <div className="stat-box-value">{reputation}</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-label">Archive Contributions</div>
              <div className="stat-box-value">{totalContributions}</div>
            </div>
          </div>

          {/* Recognition Summary — "Your scholarly impact" */}
          {hasRecognition && (
            <div className="recognition-summary">
              <div className="recognition-icon">✨</div>
              <div className="recognition-text">
                {recognitionSummary.endorsements > 0 && (
                  <span><strong>{recognitionSummary.endorsements}</strong> endorsement{recognitionSummary.endorsements !== 1 ? 's' : ''} </span>
                )}
                {recognitionSummary.stars > 0 && (
                  <span>{recognitionSummary.endorsements > 0 ? 'and ' : ''}<strong>{recognitionSummary.stars}</strong> Scholar Star{recognitionSummary.stars !== 1 ? 's' : ''} </span>
                )}
                {recognitionSummary.upvotes > 0 && (
                  <span>{(recognitionSummary.endorsements > 0 || recognitionSummary.stars > 0) ? 'and ' : ''}<strong>{recognitionSummary.upvotes}</strong> upvote{recognitionSummary.upvotes !== 1 ? 's' : ''} </span>
                )}
                received recently
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link href={`/profile/${username}`} className="btn-secondary" style={{ width: '100%', textAlign: 'center' }}>
              View Public Portfolio
            </Link>
          </div>

          {/* Intellectual Opportunities (NOT moderation chores) */}
          {hasOpportunities && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-gold)', display: 'block', marginBottom: '0.75rem' }}>
                Awaiting Your Attention
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pendingOpportunities.newMessages > 0 && (
                  <Link href={`/profile/${username}/discussions`} className="opportunity-card">
                    <span className="opportunity-icon">💬</span>
                    <span className="opportunity-text">New messages on your discussion page</span>
                    <span className="opportunity-count">{pendingOpportunities.newMessages}</span>
                  </Link>
                )}
                {pendingOpportunities.newDiscussionsOnYourWork > 0 && (
                  <Link href="/recent-changes" className="opportunity-card">
                    <span className="opportunity-icon">🔍</span>
                    <span className="opportunity-text">Discussions on topics you&apos;ve contributed to</span>
                    <span className="opportunity-count">{pendingOpportunities.newDiscussionsOnYourWork}</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Your Communities — Phase 1 Ecosystem Integration */}
          {userGroups && userGroups.length > 0 && (
            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-gold)', display: 'block', marginBottom: '1rem' }}>
                Your Communities
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(userGroups || []).map((entry: any) => {
                  const g = Array.isArray(entry.group) ? entry.group[0] : entry.group;
                  if (!g) return null;
                  const activityCount = groupActivityCounts[g.id] || 0;
                  const roleColor = entry.role === 'coordinator' ? 'var(--color-gold)' : entry.role === 'mentor' ? '#34d399' : 'var(--text-muted)';
                  return (
                    <Link key={g.id} href={`/groups/${g.slug}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', textDecoration: 'none', color: 'inherit', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}>
                      <span style={{ fontSize: '1.2rem', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'var(--color-gold-soft)', flexShrink: 0 }}>{g.icon || '📚'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: roleColor }}>{entry.role}</span>
                          {activityCount > 0 && (
                            <span style={{ fontSize: '0.58rem', color: '#22c55e', fontWeight: 700 }}>{activityCount} this week</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.9rem', opacity: 0.3 }}>→</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* MIDDLE: ACTIVITY FEEDS */}
        <main>
          {/* FIRST VISIT GUIDE — for users with zero contributions */}
          {isFirstVisit && totalContributions === 0 && (
            <div className="first-visit-guide">
              <h2>Welcome to Siddhant</h2>
              <p>
                This is your scholarly workspace. Every contribution you make — edits, discussions, reviews — builds your intellectual portfolio in the archive.
              </p>
              <div className="first-visit-actions">
                <Link href="/nodes" className="btn-primary">
                  🔍 Explore the Knowledge Archive
                </Link>
                <Link href="/groups" className="btn-secondary">
                  🏛 Join a Scholarly Community
                </Link>
                <Link href="/topic/new" className="btn-secondary">
                  ✍️ Create Your First Topic
                </Link>
              </div>
            </div>
          )}

          {/* PERSONAL ACTIVITY — Primary Feed ("Your Recent Work") */}
          {hasPersonalActivity && (
            <section style={{ marginBottom: '2.5rem' }}>
              <div className="feed-section-label personal">Your Recent Contributions</div>
              <div className="activity-feed">
                {personalActivity.revisions.map((rev: any) => {
                  const nodeData = Array.isArray(rev.nodes) ? rev.nodes[0] : rev.nodes;
                  if (!nodeData) return null;
                  return (
                    <div key={rev.id} className="activity-item" style={{
                      ...(rev.is_reverted ? { opacity: 0.5 } : {}),
                    }}>
                      <div className="activity-icon">
                        {rev.is_revert ? '↩' : rev.is_reverted ? '✗' : '📝'}
                      </div>
                      <div className="activity-content">
                        <Link href={`/topic/${nodeData.slug}`} className="activity-node-link">
                          {nodeData.title}
                        </Link>
                        <div className="activity-meta">
                          {rev.is_revert && (
                            <span style={{
                              display: 'inline-block', marginRight: '6px',
                              padding: '2px 6px', borderRadius: '4px',
                              fontSize: '0.65rem', fontWeight: 900,
                              background: 'rgba(245, 158, 11, 0.1)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              textTransform: 'uppercase',
                            }}>REVERT</span>
                          )}
                          &quot;{toPublicRevisionText(rev.commit_message)}&quot;
                          <br />
                          <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                            {new Date(rev.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {new Date(rev.created_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {personalActivity.discussions.map((disc: any) => {
                  const nodeData = Array.isArray(disc.nodes) ? disc.nodes[0] : disc.nodes;
                  if (!nodeData) return null;
                  return (
                    <div key={disc.id} className="activity-item">
                      <div className="activity-icon">💬</div>
                      <div className="activity-content">
                        <Link href={`/topic/${nodeData.slug}/discussion`} className="activity-node-link">
                          {nodeData.title}
                        </Link>
                        <div className="activity-meta">
                          {disc.content.length > 120 ? disc.content.substring(0, 120) + '…' : disc.content}
                          <br />
                          <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                            {new Date(disc.created_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* GLOBAL KNOWLEDGE PULSE — Secondary Feed */}
          <section>
            <div className="feed-section-label">Global Knowledge Pulse</div>
            <div className="activity-feed">
              {activity && activity.length > 0 ? (
                activity.map((item: any) => {
                  const nodeData = Array.isArray(item.nodes) ? item.nodes[0] : item.nodes;
                  const profileData = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
                  if (!nodeData || !profileData) return null;
                  return (
                    <div key={item.id} className="activity-item" style={{
                      ...(item.is_reverted ? { opacity: 0.5 } : {}),
                    }}>
                      <div className="activity-icon">
                        {item.is_revert ? '↩' : item.is_reverted ? '✗' : '📝'}
                      </div>
                      <div className="activity-content">
                        <Link href={`/topic/${nodeData.slug}`} className="activity-node-link">
                          {nodeData.title}
                        </Link>
                        <div className="activity-meta">
                          <Link href={`/profile/${profileData.username}`} className="activity-user">@{profileData.username}</Link>
                          {' '}
                          {item.is_revert && (
                            <span style={{
                              display: 'inline-block', marginRight: '6px',
                              padding: '2px 6px', borderRadius: '4px',
                              fontSize: '0.65rem', fontWeight: 900,
                              background: 'rgba(245, 158, 11, 0.1)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              textTransform: 'uppercase',
                            }}>REVERT</span>
                          )}
                          &quot;{toPublicRevisionText(item.commit_message)}&quot;
                          <br />
                          <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                            {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {new Date(item.created_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem', opacity: 0.4 }}>📜</div>
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>The graph is quiet</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '320px', margin: '0 auto', lineHeight: 1.5 }}>No recent edits have been recorded. Be the first to contribute to the evolving body of legal knowledge.</p>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* RIGHT: WATCHLIST WITH DELTAS + QUICK LINKS */}
        <aside>
          <h4 className="dash-section-title"><span></span> Knowledge Watchlist</h4>
          <div className="dash-watchlist">
            {watchlistData && watchlistData.length > 0 ? (
              watchlistData.map((node: any) => (
                <div key={node.id} className={`watchlist-card ${node.newEdits > 0 ? 'has-delta' : ''}`}>
                  <span style={{ color: 'var(--color-gold)' }}>★</span>
                  <Link href={`/topic/${node.slug}`} className="watchlist-card-title">
                    {node.title}
                  </Link>
                  {node.newEdits > 0 && (
                    <span className="delta-badge">{node.newEdits} new</span>
                  )}
                  <span style={{ fontSize: '1rem', opacity: 0.3 }}>→</span>
                </div>
              ))
            ) : (
              <div className="glass-panel" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: '0.75rem', opacity: 0.5 }}>★</div>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Your intellectual watchlist
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  Star topics you care about to track their evolution — new edits, discussions, and doctrinal changes will appear here.
                </p>
                <Link href="/nodes" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-gold)', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Explore the Archive →
                </Link>
              </div>
            )}
          </div>

          {/* Quick Scholarly Links — visual rhythm + fast navigation */}
          <div style={{ marginTop: '2rem' }}>
            <h4 className="dash-section-title"><span></span> Quick Links</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <Link href="/recent-changes" style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                textDecoration: 'none', color: 'var(--text-primary)',
                fontSize: '0.82rem', fontWeight: 600,
                border: '1px solid var(--border-subtle)',
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>📋</span>
                Scholarly Chronicle
              </Link>
              <Link href="/recognition" style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                textDecoration: 'none', color: 'var(--text-primary)',
                fontSize: '0.82rem', fontWeight: 600,
                border: '1px solid var(--border-subtle)',
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>⭐</span>
                Recognition Feed
              </Link>
              <Link href="/groups" style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                textDecoration: 'none', color: 'var(--text-primary)',
                fontSize: '0.82rem', fontWeight: 600,
                border: '1px solid var(--border-subtle)',
                transition: 'all 0.15s ease',
              }}>
                <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>🏛</span>
                Scholarly Communities
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}


/**
 * Get a human-friendly "time since" string.
 * Keeps the scholarly tone — no "2h ago" social media energy.
 */
function getTimeSince(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ago`;
}
