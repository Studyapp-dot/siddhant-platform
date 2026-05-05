import React from 'react';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LEVEL_THRESHOLDS } from '@/app/actions/reputation-constants';
import '@/app/community-core.css';
import '../../topic/[slug]/page.css';
import '../[username]/profile.css';

interface ProfilePageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}

// The 6-level hierarchy with display metadata
const ROLE_CONFIG: Record<string, { label: string; level: number; color: string; icon: string }> = {
  reader:             { label: 'Reader',                 level: 1, color: '#94a3b8', icon: '👁' },
  contributor:        { label: 'Contributor',            level: 2, color: 'var(--color-gold)', icon: '✍️' },
  recognized:         { label: 'Recognized Contributor', level: 3, color: '#22c55e', icon: '✅' },
  senior_scholar:     { label: 'Senior Scholar',         level: 4, color: '#8b5cf6', icon: '🎓' },
  steward:            { label: 'Steward',                level: 5, color: '#ef4444', icon: '🛡️' },
  governance_council: { label: 'Governance Council',     level: 6, color: '#f59e0b', icon: '⚖️' },
};

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const { username } = await params;
  const { tab } = (await searchParams) || {};
  const activeTab = tab || 'portfolio';
  const supabase = await createClient();

  // Fetch the profile with all reputation columns
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, role, reputation_score, accepted_edits_count, total_edits_count, endorsements_received, peer_reviews_completed, scholar_stars_received, created_at')
    .eq('username', username)
    .single();

  if (!profile) notFound();

  // Parallel data fetching
  const [
    { count: totalRevisions },
    { count: totalDiscussions },
    { count: totalTags },
    { count: totalGroupPosts },
    { data: coordination },
    { data: scholarStars },
    { data: reputationEvents },
    { data: revisions },
    { data: discussions },
    { data: flags },
    { data: userGroups },
  ] = await Promise.all([
    supabase.from('revisions').select('id', { count: 'exact', head: true }).eq('author_id', profile.id),
    supabase.from('discussions').select('id', { count: 'exact', head: true }).eq('author_id', profile.id),
    supabase.from('inline_tags').select('id', { count: 'exact', head: true }).eq('author_id', profile.id),
    supabase.from('group_discussions').select('id', { count: 'exact', head: true }).eq('author_id', profile.id),
    supabase.from('user_discussions').select(`
      id, content, created_at,
      author:profiles!user_discussions_author_id_fkey ( username )
    `).eq('target_user_id', profile.id).is('parent_id', null).order('created_at', { ascending: false }).limit(3),
    // Scholar Stars — the socialization signal
    supabase.from('scholar_stars').select(`
      id, reason, source_type, created_at,
      giver:profiles!scholar_stars_giver_id_fkey ( username )
    `).eq('recipient_id', profile.id).order('created_at', { ascending: false }).limit(5),
    // Recent reputation events — transparent audit trail
    supabase.from('reputation_events').select('*')
      .eq('user_id', profile.id).order('created_at', { ascending: false }).limit(10),
    // Full revision history
    supabase.from('revisions').select(`
      id, commit_message, created_at, content_size, node_id, is_revert, is_reverted,
      nodes!revisions_node_id_fkey ( slug, title )
    `).eq('author_id', profile.id).order('created_at', { ascending: false }).limit(50),
    // Discussion contributions
    supabase.from('discussions').select(`
      id, content, created_at, node_id,
      nodes!discussions_node_id_fkey ( slug, title )
    `).eq('author_id', profile.id).order('created_at', { ascending: false }).limit(20),
    // Flags raised
    supabase.from('inline_tags').select(`
      id, tag_type, context_quote, created_at, resolved, node_id,
      nodes!inline_tags_node_id_fkey ( slug, title )
    `).eq('author_id', profile.id).order('created_at', { ascending: false }).limit(20),
    // Subject Group memberships — Phase 1 ecosystem integration
    supabase.from('subject_group_members').select(`
      role, joined_at,
      group:subject_groups!subject_group_members_group_id_fkey ( id, name, slug, icon )
    `).eq('user_id', profile.id).order('joined_at', { ascending: true }),
  ]);

  // ── Phase 2: Topic Affinity Map ──
  // Aggregate revisions by node to find areas of expertise
  const topicAffinityMap: { slug: string; title: string; count: number; lastEdit: string }[] = [];
  if (revisions && revisions.length > 0) {
    const nodeCounts: Record<string, { slug: string; title: string; count: number; lastEdit: string }> = {};
    for (const rev of revisions) {
      const nodeData = Array.isArray(rev.nodes) ? rev.nodes[0] : rev.nodes;
      if (!nodeData) continue;
      const key = nodeData.slug;
      if (!nodeCounts[key]) {
        nodeCounts[key] = { slug: nodeData.slug, title: nodeData.title, count: 0, lastEdit: rev.created_at };
      }
      nodeCounts[key].count++;
      // Keep the most recent edit date
      if (rev.created_at > nodeCounts[key].lastEdit) {
        nodeCounts[key].lastEdit = rev.created_at;
      }
    }
    // Sort by contribution count, take top 5
    topicAffinityMap.push(
      ...Object.values(nodeCounts).sort((a, b) => b.count - a.count).slice(0, 5)
    );
  }
  const maxAffinity = topicAffinityMap.length > 0 ? topicAffinityMap[0].count : 1;

  // ── Phase 2: Scholar Journey Milestones ──
  // Extract meaningful milestones from reputation events
  const milestoneTypes = [
    'edit_accepted_minor', 'edit_accepted_substantive',
    'endorsement_received', 'scholar_star_received',
    'peer_review_completed', 'tier_advancement_bonus',
    'mentee_first_contribution',
  ];
  const milestoneLabels: Record<string, string> = {
    edit_accepted_minor: 'First minor edit accepted',
    edit_accepted_substantive: 'First substantive contribution',
    endorsement_received: 'First "This Helped Me" endorsement',
    scholar_star_received: 'First Scholar Star received ⭐',
    peer_review_completed: 'First peer review completed',
    tier_advancement_bonus: 'Level advancement',
    mentee_first_contribution: 'Mentee made first contribution',
  };
  const milestoneIcons: Record<string, string> = {
    edit_accepted_minor: '📝',
    edit_accepted_substantive: '✍️',
    endorsement_received: '🤝',
    scholar_star_received: '⭐',
    peer_review_completed: '🔍',
    tier_advancement_bonus: '🎓',
    mentee_first_contribution: '🌱',
  };

  // Build timeline: first occurrence of each milestone type
  const allReputationEvents = reputationEvents || [];
  const seenTypes = new Set<string>();
  const journeyMilestones: { type: string; label: string; icon: string; date: string; detail?: string }[] = [];

  // Add account creation as first milestone
  journeyMilestones.push({
    type: 'account_created',
    label: 'Joined Siddhant',
    icon: '🏛',
    date: profile.created_at,
  });

  // Walk events from oldest to newest to find "firsts"
  const sortedEvents = [...allReputationEvents].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const event of sortedEvents) {
    if (milestoneTypes.includes(event.event_type) && !seenTypes.has(event.event_type)) {
      seenTypes.add(event.event_type);
      journeyMilestones.push({
        type: event.event_type,
        label: milestoneLabels[event.event_type] || event.event_type,
        icon: milestoneIcons[event.event_type] || '📌',
        date: event.created_at,
        detail: event.description || undefined,
      });
    }
  }

  // ── Phase 2: Level Progress Computation ──
  const roleConfig = ROLE_CONFIG[profile.role] ?? { label: profile.role, level: 0, color: 'var(--color-gold)', icon: '👤' };
  const currentLevel = roleConfig.level;
  let progressPercent = 100;
  let nextLevelLabel = 'Maximum Level';
  let progressDetail = '';

  if (currentLevel < 3 && LEVEL_THRESHOLDS.recognized) {
    // Working toward Recognized Contributor
    const target = LEVEL_THRESHOLDS.recognized;
    const repProgress = Math.min((profile.reputation_score || 0) / target.reputation, 1);
    const editProgress = Math.min((profile.accepted_edits_count || 0) / target.accepted_edits, 1);
    progressPercent = Math.round(((repProgress + editProgress) / 2) * 100);
    nextLevelLabel = 'Recognized Contributor';
    progressDetail = `${profile.reputation_score || 0}/${target.reputation} rep · ${profile.accepted_edits_count || 0}/${target.accepted_edits} edits`;
  } else if (currentLevel < 4 && LEVEL_THRESHOLDS.senior_scholar) {
    // Working toward Senior Scholar
    const target = LEVEL_THRESHOLDS.senior_scholar;
    const repProgress = Math.min((profile.reputation_score || 0) / target.reputation, 1);
    const editProgress = Math.min((profile.accepted_edits_count || 0) / target.accepted_edits, 1);
    progressPercent = Math.round(((repProgress + editProgress) / 2) * 100);
    nextLevelLabel = 'Senior Scholar';
    progressDetail = `${profile.reputation_score || 0}/${target.reputation} rep · ${profile.accepted_edits_count || 0}/${target.accepted_edits} edits`;
  } else if (currentLevel === 4) {
    // Senior Scholar → working toward Steward (editorial governance)
    // No hard threshold defined — Steward promotion is community-driven
    progressPercent = 0; // Community nomination required — no auto-progress
    nextLevelLabel = 'Steward';
    progressDetail = 'Steward nomination is community-driven';
  } else {
    // Level 5 (Steward) or 6 (Governance Council) — highest tiers
    progressPercent = 100;
    nextLevelLabel = '__MAX__'; // Sentinel value used to skip the progress bar
  }


  const memberSince = new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const acceptanceRate = profile.total_edits_count > 0
    ? Math.round((profile.accepted_edits_count / profile.total_edits_count) * 1000) / 10
    : 0;

  // Event type display labels
  const eventLabels: Record<string, string> = {
    edit_accepted_minor: 'Minor edit accepted',
    edit_accepted_substantive: 'Substantive edit accepted',
    upvote_received: 'Upvote received',
    endorsement_received: '"This Helped Me" endorsement',
    scholar_star_received: 'Scholar Star received ⭐',
    peer_review_completed: 'Peer review completed',
    peer_review_aligned: 'Review aligned with consensus',
    discussion_cited: 'Discussion contribution cited',
    flag_resolved: 'Flag resolved',
    mentee_first_contribution: 'Mentee contributed',
    tier_advancement_bonus: 'Level advancement',
  };

  // Pre-fetch contexts for reputation events that map to revisions
  const revIds = (reputationEvents || [])
    .filter((e: any) => e.source_type === 'revision' && e.source_id)
    .map((e: any) => e.source_id);
    
  let eventContexts: Record<string, { slug: string, title: string, revId: string }> = {};
  if (revIds.length > 0) {
    const { data: revNodes } = await supabase
      .from('revisions')
      .select('id, nodes!revisions_node_id_fkey(slug, title)')
      .in('id', revIds);
      
    if (revNodes) {
      revNodes.forEach((rn: any) => {
        const n = Array.isArray(rn.nodes) ? rn.nodes[0] : rn.nodes;
        if (n) eventContexts[rn.id] = { slug: n.slug, title: n.title, revId: rn.id };
      });
    }
  }

  return (
    <div className="community-layout">
      {/* Profile Identity Sidebar */}
      <aside className="community-sidebar" style={{ animation: 'slideRight 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="glass-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
          {/* Avatar */}
          <div className="scholar-avatar" style={{
            width: '100px', height: '100px', fontSize: '2.5rem',
            margin: '0 auto 1.5rem',
            background: 'var(--color-gold-gradient)', color: 'var(--bg-app)',
            border: 'none', boxShadow: 'var(--color-gold-glow)',
            borderRadius: '24px', transform: 'rotate(-3deg)',
          }}>
            {profile.username.charAt(0).toUpperCase()}
          </div>

          {/* Username */}
          <h2 className="scholar-name" style={{ fontSize: '1.6rem', marginBottom: '0.25rem', fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>
            {profile.username}
          </h2>

          {/* Level Badge — Prominent */}
          <div style={{
            marginTop: '0.75rem', padding: '8px 16px',
            borderRadius: '20px',
            background: `${roleConfig.color}15`,
            border: `1px solid ${roleConfig.color}40`,
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>
            <span style={{ fontSize: '0.9rem' }}>{roleConfig.icon}</span>
            <span style={{
              fontSize: '0.72rem', fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: roleConfig.color,
            }}>
              {roleConfig.label}
            </span>
          </div>

          {/* Level indicator */}
          <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Trust Level {roleConfig.level} of 6
          </div>

          {/* Level Advancement Progress — Phase 2 */}
          {nextLevelLabel !== '__MAX__' && (
            <div className="level-progress">
              <div className="level-progress-header">
                <span className="level-progress-label">Progress to next level</span>
                <span className="level-progress-target">{nextLevelLabel}</span>
              </div>
              <div className="level-progress-bar">
                <div className="level-progress-fill" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
              </div>
              <div className="level-progress-detail">
                {progressDetail || `${progressPercent}%`}
              </div>
            </div>
          )}
          {nextLevelLabel === '__MAX__' && (
            <div className="level-progress" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{roleConfig.icon}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                Highest Scholar Tier Achieved
              </div>
              <div className="level-progress-detail" style={{ fontStyle: 'italic' }}>
                Institutional Scholar · {roleConfig.label}
              </div>
            </div>
          )}

          {/* Reputation Stats — Primary Display */}
          <div className="stats-ledger" style={{ marginTop: '2.5rem', textAlign: 'left', gap: '1rem' }}>
            <span className="nav-heading" style={{ paddingLeft: 0, color: 'var(--color-gold)' }}>Reputation</span>

            {/* Reputation Score — The primary number */}
            <div className="stats-item" style={{
              background: 'rgba(255,255,255,0.03)', padding: '1.25rem',
              borderRadius: '12px', border: '1px solid var(--border-subtle)',
            }}>
              <span className="stats-label" style={{ fontWeight: 700, fontSize: '0.75rem' }}>Reputation Score</span>
              <span className="stats-value" style={{ color: 'var(--color-gold)', fontSize: '1.6rem', fontWeight: 800 }}>
                {profile.reputation_score || 0}
              </span>
            </div>

            {/* Acceptance Rate */}
            <div className="stats-item" style={{
              background: 'rgba(255,255,255,0.03)', padding: '1rem',
              borderRadius: '12px', border: '1px solid var(--border-subtle)',
            }}>
              <span className="stats-label" style={{ fontWeight: 600, fontSize: '0.7rem' }}>Accepted Edits</span>
              <span className="stats-value" style={{ fontSize: '1rem' }}>
                {profile.accepted_edits_count || 0} of {profile.total_edits_count || 0}
                {profile.total_edits_count > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#22c55e', marginLeft: '6px' }}>
                    ({acceptanceRate}%)
                  </span>
                )}
              </span>
            </div>

            {/* Secondary stats — collapsible for sidebar length control */}
            <details style={{ marginTop: '0.75rem' }}>
              <summary style={{
                fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                cursor: 'pointer', padding: '6px 0', listStyle: 'none',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s' }}>▸</span>
                Detailed Statistics
              </summary>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div className="stats-item" style={{
                  flexDirection: 'column', alignItems: 'flex-start',
                  border: 'none', background: 'rgba(255,255,255,0.02)',
                  padding: '0.6rem', borderRadius: '10px',
                }}>
                  <span className="stats-label" style={{ fontSize: '0.55rem' }}>Endorsements</span>
                  <span className="stats-value" style={{ fontSize: '0.9rem' }}>{profile.endorsements_received || 0}</span>
                </div>
                <div className="stats-item" style={{
                  flexDirection: 'column', alignItems: 'flex-start',
                  border: 'none', background: 'rgba(255,255,255,0.02)',
                  padding: '0.6rem', borderRadius: '10px',
                }}>
                  <span className="stats-label" style={{ fontSize: '0.55rem' }}>Scholar Stars</span>
                  <span className="stats-value" style={{ fontSize: '0.9rem' }}>{profile.scholar_stars_received || 0}</span>
                </div>
                <div className="stats-item" style={{
                  flexDirection: 'column', alignItems: 'flex-start',
                  border: 'none', background: 'rgba(255,255,255,0.02)',
                  padding: '0.6rem', borderRadius: '10px',
                }}>
                  <span className="stats-label" style={{ fontSize: '0.55rem' }}>Peer Reviews</span>
                  <span className="stats-value" style={{ fontSize: '0.9rem' }}>{profile.peer_reviews_completed || 0}</span>
                </div>
                <div className="stats-item" style={{
                  flexDirection: 'column', alignItems: 'flex-start',
                  border: 'none', background: 'rgba(255,255,255,0.02)',
                  padding: '0.6rem', borderRadius: '10px',
                }}>
                  <span className="stats-label" style={{ fontSize: '0.55rem' }}>Discussions</span>
                  <span className="stats-value" style={{ fontSize: '0.9rem' }}>{totalDiscussions || 0}</span>
                </div>
                <div className="stats-item" style={{
                  flexDirection: 'column', alignItems: 'flex-start',
                  border: 'none', background: 'rgba(255,255,255,0.02)',
                  padding: '0.6rem', borderRadius: '10px',
                }}>
                  <span className="stats-label" style={{ fontSize: '0.55rem' }}>Community Posts</span>
                  <span className="stats-value" style={{ fontSize: '0.9rem' }}>{totalGroupPosts || 0}</span>
                </div>
                <div className="stats-item" style={{
                  flexDirection: 'column', alignItems: 'flex-start',
                  border: 'none', background: 'rgba(255,255,255,0.02)',
                  padding: '0.6rem', borderRadius: '10px',
                }}>
                  <span className="stats-label" style={{ fontSize: '0.55rem' }}>Flags Raised</span>
                  <span className="stats-value" style={{ fontSize: '0.9rem' }}>{totalTags || 0}</span>
                </div>
              </div>
            </details>
          </div>

          {/* Subject Groups — Phase 1 Ecosystem Integration */}
          {userGroups && userGroups.length > 0 && (
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                      <span className="nav-heading" style={{ paddingLeft: 0, color: 'var(--color-gold)' }}>Scholarly Communities</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '0.75rem' }}>
                {(userGroups || []).map((entry: any) => {
                  const g = Array.isArray(entry.group) ? entry.group[0] : entry.group;
                  if (!g) return null;
                  const roleColor = entry.role === 'coordinator' ? 'var(--color-gold)' : entry.role === 'mentor' ? '#34d399' : 'var(--text-muted)';
                  return (
                    <Link key={g.id} href={`/groups/${g.slug}`} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 8px', borderRadius: '8px',
                      textDecoration: 'none', color: 'inherit',
                      transition: 'background 0.15s',
                    }} className="hover-highlight">
                      <span style={{ fontSize: '1rem', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', background: 'var(--color-gold-soft)', flexShrink: 0 }}>{g.icon || '📚'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                      </div>
                      {entry.role !== 'member' && (
                        <span style={{
                          fontSize: '0.5rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                          padding: '2px 5px', borderRadius: '3px',
                          background: entry.role === 'coordinator' ? 'var(--color-gold-soft)' : 'rgba(52, 211, 153, 0.1)',
                          color: roleColor,
                        }}>{entry.role}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border-subtle)' }}>
            <Link href={`/profile/${username}/discussions`} className="btn-primary" style={{
              width: '100%', padding: '14px', fontSize: '0.85rem',
              fontWeight: 800, letterSpacing: '0.1em',
              background: 'var(--color-gold-gradient)', color: 'var(--bg-base)',
              boxShadow: 'var(--color-gold-glow)', borderRadius: '12px',
              border: 'none', cursor: 'pointer',
            }}>
              SEND MESSAGE
            </Link>
          </div>
        </div>


      </aside>

      {/* Main Content */}
      <main className="scholarly-content">
        <header className="scholarly-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <span className="context-label">Contributor Profile</span>
              <h1 className="scholarly-title" style={{ fontSize: '2.5rem' }}>{profile.username}</h1>
              <p className="scholarly-subtitle">Member since {memberSince}</p>
            </div>
            {/* Level Badge (Header) */}
            <div style={{
              padding: '1rem 1.5rem', border: `1px solid ${roleConfig.color}30`,
              borderRadius: '12px', textAlign: 'center', minWidth: '140px',
              background: `${roleConfig.color}08`,
            }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{roleConfig.icon}</div>
              <div style={{
                fontSize: '0.65rem', fontWeight: 800, color: roleConfig.color,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {roleConfig.label}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Level {roleConfig.level}
              </div>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
          {/* Tab Navigation */}
          <div style={{
            display: 'flex', gap: '2rem',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '-1rem', paddingBottom: '0.5rem',
          }}>
            <Link href={`?tab=portfolio`} style={{
              fontSize: '1.05rem', fontWeight: activeTab === 'portfolio' ? 800 : 500,
              color: activeTab === 'portfolio' ? 'var(--color-gold)' : 'var(--text-muted)',
              textDecoration: 'none', paddingBottom: '10px',
              borderBottom: activeTab === 'portfolio' ? '3px solid var(--color-gold)' : '3px solid transparent',
              marginBottom: '-0.5rem', transition: 'all 0.2s',
            }}>
              Portfolio
            </Link>
            <Link href={`?tab=reputation`} style={{
              fontSize: '1.05rem', fontWeight: activeTab === 'reputation' ? 800 : 500,
              color: activeTab === 'reputation' ? 'var(--color-gold)' : 'var(--text-muted)',
              textDecoration: 'none', paddingBottom: '10px',
              borderBottom: activeTab === 'reputation' ? '3px solid var(--color-gold)' : '3px solid transparent',
              marginBottom: '-0.5rem', transition: 'all 0.2s',
            }}>
              Reputation & Recognition
            </Link>
            <Link href={`?tab=community`} style={{
              fontSize: '1.05rem', fontWeight: activeTab === 'community' ? 800 : 500,
              color: activeTab === 'community' ? 'var(--color-gold)' : 'var(--text-muted)',
              textDecoration: 'none', paddingBottom: '10px',
              borderBottom: activeTab === 'community' ? '3px solid var(--color-gold)' : '3px solid transparent',
              marginBottom: '-0.5rem', transition: 'all 0.2s',
            }}>
              Community Activity
            </Link>
          </div>

          {/* ========================================================= */}
          {/* TAB: REPUTATION & RECOGNITION */}
          {/* ========================================================= */}
          {activeTab === 'reputation' && (
            <>

          {/* Scholar Journey Timeline — Phase 2 */}
          {journeyMilestones.length > 0 && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 className="scholarly-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>Scholar Journey</h3>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  intellectual milestones
                </span>
              </div>
              <div className="glass-card">
                <div className="glass-card-content" style={{ padding: '1.5rem 2rem' }}>
                  <div className="scholar-timeline">
                    {journeyMilestones.map((milestone, i) => (
                      <div key={`${milestone.type}-${i}`} className="timeline-milestone">
                        <div className={`timeline-marker ${milestone.type === 'tier_advancement_bonus' || milestone.type === 'scholar_star_received' ? 'highlight' : ''}`}>
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-event">
                            <span style={{ marginRight: '6px' }}>{milestone.icon}</span>
                            {milestone.label}
                          </div>
                          <div className="timeline-date">
                            {new Date(milestone.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                          {milestone.detail && (
                            <div className="timeline-detail">{milestone.detail}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Scholar Stars — Peer Recognition (Socialization Signal) */}
          {scholarStars && scholarStars.length > 0 && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 className="scholarly-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>
                  Scholar Stars ⭐
                </h3>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {profile.scholar_stars_received || 0} received · peer recognition
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {scholarStars.map((star: any) => (
                  <div key={star.id} className="glass-card" style={{ padding: '1.5rem 2rem' }}>
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: '1rem',
                    }}>
                      <div style={{
                        fontSize: '1.5rem', width: '40px', height: '40px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px',
                        flexShrink: 0,
                      }}>⭐</div>
                      <div style={{ flex: 1 }}>
                        <p style={{
                          fontSize: '1rem', fontStyle: 'italic',
                          color: 'var(--text-primary)', lineHeight: '1.7',
                          marginBottom: '0.75rem',
                        }}>
                          "{star.reason}"
                        </p>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600,
                        }}>
                          <span>Awarded by</span>
                          <Link href={`/profile/${star.giver?.username}`} style={{
                            color: 'var(--color-gold)', textDecoration: 'none', fontWeight: 700,
                          }}>
                            @{star.giver?.username}
                          </Link>
                          <span style={{ opacity: 0.5 }}>•</span>
                          <span>{new Date(star.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          {star.source_type && (
                            <>
                              <span style={{ opacity: 0.5 }}>•</span>
                              <span style={{
                                fontSize: '0.65rem', padding: '2px 8px',
                                background: 'var(--bg-panel)', borderRadius: '4px',
                                textTransform: 'capitalize',
                              }}>{star.source_type}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Reputation Audit Trail — Radical Transparency */}
          {reputationEvents && reputationEvents.length > 0 && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 className="scholarly-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>
                  Reputation History
                </h3>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  transparent audit trail
                </span>
              </div>
              <div className="glass-card">
                <div className="glass-card-content" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {reputationEvents.map((event: any) => {
                      const ctx = eventContexts[event.source_id];
                      return (
                        <div key={event.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.75rem 1rem', borderRadius: '8px',
                          background: 'rgba(255,255,255,0.02)',
                          borderLeft: `3px solid ${event.points > 0 ? '#22c55e' : 'var(--border-subtle)'}`,
                        }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {eventLabels[event.event_type] || event.event_type}
                            </div>
                            {(event.description || ctx) && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {event.description}
                                {ctx && (
                                  <Link href={`/topic/${ctx.slug}/compare?rev=${ctx.revId}`} style={{
                                    marginLeft: '8px', color: 'var(--color-gold)', textDecoration: 'none',
                                  }}>
                                    ({ctx.title}) →
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{
                              fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700,
                              color: event.points > 0 ? '#22c55e' : 'var(--text-muted)',
                            }}>
                              {event.points > 0 ? '+' : ''}{event.points}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', minWidth: '80px', textAlign: 'right' }}>
                              {new Date(event.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}
            </>
          )}

          {/* ========================================================= */}
          {/* TAB: COMMUNITY ACTIVITY */}
          {/* ========================================================= */}
          {activeTab === 'community' && (
            <>
          {/* Coordination Transcript Preview */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="scholarly-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>Recent Messages & Coordination</h3>
              <Link href={`/profile/${username}/discussions`} style={{ fontSize: '0.75rem', color: 'var(--color-gold)', fontWeight: 700, textDecoration: 'none', textTransform: 'uppercase' }}>
                View All Messages →
              </Link>
            </div>
            <div className="glass-card">
              <div className="glass-card-content" style={{ padding: '1.5rem' }}>
                {coordination && coordination.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {coordination.map((msg: any) => (
                      <div key={msg.id} style={{ borderLeft: '2px solid var(--color-gold-soft)', paddingLeft: '1.5rem' }}>
                        <p style={{ fontSize: '1.05rem', fontStyle: 'italic', color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: '1.6', letterSpacing: '0.01em' }}>
                          "{msg.content.length > 180 ? msg.content.slice(0, 180) + '...' : msg.content}"
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          <div className="scholar-avatar" style={{ width: '20px', height: '20px', fontSize: '0.5rem' }}>{msg.author?.username[0].toUpperCase()}</div>
                          <span>
                            From <Link href={`/profile/${msg.author?.username}`} style={{ color: 'var(--color-gold)', textDecoration: 'none', fontWeight: 700 }}>@{msg.author?.username}</Link>
                          </span>
                          <span style={{ opacity: 0.5 }}>•</span>
                          <span>{new Date(msg.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                    <p className="scholarly-subtitle" style={{ textTransform: 'none' }}>No messages found on this profile.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Discussion History */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="scholarly-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>Discussion Contributions</h3>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {totalDiscussions || 0} total posts
              </span>
            </div>
            <div className="glass-card">
              <div className="glass-card-content" style={{ padding: '1.5rem' }}>
                {discussions && discussions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {discussions.map((disc: any) => {
                      const nodeData = Array.isArray(disc.nodes) ? disc.nodes[0] : disc.nodes;
                      return (
                        <div key={disc.id} style={{
                          padding: '1rem 1.25rem', borderRadius: '10px',
                          background: 'rgba(255,255,255,0.02)',
                          borderLeft: '3px solid rgba(59, 130, 246, 0.4)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.9rem' }}>💬</span>
                            {nodeData && (
                              <Link href={`/topic/${nodeData.slug}/discussion`} style={{
                                fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-gold)',
                                textDecoration: 'none',
                              }}>
                                {nodeData.title}
                              </Link>
                            )}
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                              {new Date(disc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <p style={{
                            fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                            margin: 0,
                          }}>
                            {disc.content.length > 200 ? disc.content.slice(0, 200) + '...' : disc.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                    <p className="scholarly-subtitle" style={{ textTransform: 'none' }}>No discussion posts yet.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB: PORTFOLIO (Contributions & Flags) */}
          {/* ========================================================= */}
          {activeTab === 'portfolio' && (
            <>

          {/* Topic Affinity Map — Phase 2: "Areas of Expertise" */}
          {topicAffinityMap.length > 0 && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 className="scholarly-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>Areas of Expertise</h3>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  topic affinity · based on contributions
                </span>
              </div>
              <div className="topic-affinity-map">
                {topicAffinityMap.map((topic) => (
                  <Link key={topic.slug} href={`/topic/${topic.slug}`} className="affinity-item">
                    <div className="affinity-bar-container">
                      <div className="affinity-topic">{topic.title}</div>
                      <div className="affinity-bar-track">
                        <div className="affinity-bar-fill" style={{ width: `${(topic.count / maxAffinity) * 100}%` }} />
                      </div>
                      <div className="affinity-meta">
                        <span>{topic.count} contribution{topic.count !== 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span>Last: {new Date(topic.lastEdit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <span className="affinity-count">{topic.count}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Contribution History — Section 14: Complete Verifiable Record */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="scholarly-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>Contribution History</h3>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {totalRevisions || 0} total edits · verifiable record
              </span>
            </div>
            <div className="registry-container">
              {revisions && revisions.length > 0 ? (
                revisions.map((rev: any) => {
                  const shortId = rev.id.substring(0, 8);
                  const nodeData = Array.isArray(rev.nodes) ? rev.nodes[0] : rev.nodes;
                  const nodeSlug = nodeData?.slug;
                  return (
                    <div key={rev.id} className="registry-entry" style={{ gridTemplateColumns: '80px 1fr 200px', padding: '1.5rem 2rem', borderRadius: '12px' }}>
                      <div className="registry-seal" style={{
                        width: '48px', height: '48px', fontSize: '1.2rem',
                        background: rev.is_revert ? 'rgba(245, 158, 11, 0.08)' : rev.is_reverted ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-panel)',
                        border: rev.is_revert ? '1px solid rgba(245, 158, 11, 0.3)' : rev.is_reverted ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-subtle)',
                      }}>
                        {rev.is_revert ? '↩' : rev.is_reverted ? '✗' : '📝'}
                      </div>
                      <div className="registry-info">
                        <Link href={`/topic/${nodeSlug}`} className="registry-name" style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {nodeData?.title ?? nodeSlug}
                        </Link>
                        <p className="registry-desc" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {rev.is_revert && (
                            <span style={{
                              display: 'inline-block', marginRight: '6px',
                              padding: '1px 6px', borderRadius: '3px',
                              fontSize: '0.6rem', fontWeight: 800,
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              textTransform: 'uppercase', letterSpacing: '0.04em',
                              verticalAlign: 'middle',
                            }}>
                              ↩ REVERT
                            </span>
                          )}
                          {rev.is_reverted && (
                            <span style={{
                              display: 'inline-block', marginRight: '6px',
                              padding: '1px 6px', borderRadius: '3px',
                              fontSize: '0.6rem', fontWeight: 800,
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              textTransform: 'uppercase', letterSpacing: '0.04em',
                              verticalAlign: 'middle',
                            }}>
                              ✗ REVERTED
                            </span>
                          )}
                          {rev.commit_message || 'Academic contribution'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '0.5rem' }}>
                          <span style={{
                            fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
                            fontSize: '0.65rem', fontWeight: 700,
                            color: 'var(--text-muted)', background: 'var(--bg-panel)',
                            border: '1px solid var(--border-subtle)',
                            padding: '2px 6px', borderRadius: '4px',
                          }}>#{shortId}</span>
                          {rev.content_size != null && rev.content_size > 0 && (
                            <span style={{
                              fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 700,
                              color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)',
                              padding: '2px 8px', borderRadius: '4px',
                            }}>{rev.content_size.toLocaleString()} chars</span>
                          )}
                          {nodeSlug && (
                            <Link href={`/topic/${nodeSlug}/compare?rev=${rev.id}`}
                              style={{ fontSize: '0.68rem', color: 'var(--color-gold)', textDecoration: 'none', fontWeight: 700 }}>
                              View Changes →
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="registry-meta" style={{ paddingLeft: '2rem', borderLeft: '1px solid var(--border-subtle)' }}>
                        <div className="registry-stat" style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                          {new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-gold)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Verified Edit</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                  <p className="scholarly-subtitle" style={{ textTransform: 'none' }}>No article revisions recorded.</p>
                </div>
              )}
            </div>
          </section>

          {/* Flags Raised */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="scholarly-title" style={{ fontSize: '1.4rem', marginBottom: 0 }}>Flags Raised</h3>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {totalTags || 0} total flags · quality monitoring
              </span>
            </div>
            <div className="glass-card">
              <div className="glass-card-content" style={{ padding: '1.5rem' }}>
                {flags && flags.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {flags.map((flag: any) => {
                      const nodeData = Array.isArray(flag.nodes) ? flag.nodes[0] : flag.nodes;
                      const tagLabel = (flag.tag_type || '').replace(/_/g, ' ');
                      return (
                        <div key={flag.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.75rem 1rem', borderRadius: '8px',
                          background: 'rgba(255,255,255,0.02)',
                          borderLeft: `3px solid ${flag.resolved ? '#22c55e' : '#fb923c'}`,
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.8rem' }}>🚩</span>
                              <span style={{
                                fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize',
                                color: 'var(--text-primary)',
                              }}>
                                {tagLabel}
                              </span>
                              <span style={{
                                fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                                background: flag.resolved ? 'rgba(34,197,94,0.1)' : 'rgba(251,146,60,0.1)',
                                color: flag.resolved ? '#22c55e' : '#fb923c',
                                textTransform: 'uppercase',
                              }}>
                                {flag.resolved ? 'Resolved' : 'Open'}
                              </span>
                            </div>
                            {nodeData && (
                              <Link href={`/topic/${nodeData.slug}`} style={{
                                fontSize: '0.75rem', color: 'var(--color-gold)', textDecoration: 'none',
                                display: 'block', marginTop: '4px',
                              }}>
                                {nodeData.title}
                              </Link>
                            )}
                            {flag.context_quote && (
                              <p style={{
                                fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic',
                                margin: '4px 0 0 0',
                              }}>
                                &ldquo;{flag.context_quote.length > 100 ? flag.context_quote.slice(0, 100) + '...' : flag.context_quote}&rdquo;
                              </p>
                            )}
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(flag.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="profile-empty-state">
                    <h4>No flags raised yet</h4>
                    <p>Quality monitoring protects the integrity of the knowledge graph. Flag inaccuracies, outdated citations, or policy violations when you encounter them.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
