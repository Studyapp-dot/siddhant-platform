import React from 'react';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import DiscussionThread from './DiscussionThread';
import '@/app/community-core.css';
import './discussion.css';

export default async function DiscussionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: node } = await supabase.from('nodes').select('id, title').eq('slug', slug).single();
  if (!node) {
    return <div style={{padding: '40px', color: 'white'}}>Topic not found for discussion.</div>;
  }

  // Current user profile
  let currentUserRole: string | null = null;
  let currentUserId: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    currentUserRole = profile?.role ?? null;
    currentUserId = user.id;
  }

  // Fetch all comments with author info + thread_type + Phase 3 fields
  const { data: comments } = await supabase
    .from('discussions')
    .select(`
      id, content, created_at, parent_id, status, closing_summary, closed_at, closed_by, thread_type,
      response_type, reference_text, reference_type, cited_participants, impact_summary,
      profiles!discussions_author_id_fkey ( id, username, role, reputation_score )
    `)
    .eq('node_id', node.id)
    .order('created_at', { ascending: true });

  // Resolve closed_by usernames
  const closerIds = [...new Set((comments ?? []).filter((c: any) => c.closed_by).map((c: any) => c.closed_by))];
  let closerUsernames: Record<string, string> = {};
  if (closerIds.length > 0) {
    const { data: closers } = await supabase.from('profiles').select('id, username').in('id', closerIds);
    for (const closer of (closers ?? [])) {
      closerUsernames[closer.id] = closer.username;
    }
  }

  const allComments = (comments ?? []).map((c: any) => ({
    ...c,
    closed_by_username: c.closed_by ? closerUsernames[c.closed_by] || null : null,
  }));

  // Fetch consensus vote counts for all discussion IDs on this node
  const allIds = allComments.map((c: any) => c.id);
  let voteCounts: Record<string, { count: number; voted: boolean }> = {};

  if (allIds.length > 0) {
    // Get counts per discussion
    const { data: voteData } = await supabase
      .from('consensus_votes')
      .select('discussion_id')
      .in('discussion_id', allIds);

    // Count per ID
    const countMap: Record<string, number> = {};
    for (const v of (voteData ?? [])) {
      countMap[v.discussion_id] = (countMap[v.discussion_id] || 0) + 1;
    }

    // Check which ones the current user voted on
    let userVoted = new Set<string>();
    if (currentUserId) {
      const { data: userVotes } = await supabase
        .from('consensus_votes')
        .select('discussion_id')
        .eq('user_id', currentUserId)
        .in('discussion_id', allIds);
      userVoted = new Set((userVotes ?? []).map(v => v.discussion_id));
    }

    for (const id of allIds) {
      voteCounts[id] = { count: countMap[id] || 0, voted: userVoted.has(id) };
    }
  }

  // Fetch thread follows for current user
  let followedThreadIds: string[] = [];
  if (currentUserId) {
    const { data: follows } = await supabase
      .from('thread_follows')
      .select('discussion_id')
      .eq('user_id', currentUserId);
    followedThreadIds = (follows ?? []).map(f => f.discussion_id);
  }

  // Stats
  const topLevel = allComments.filter((c: any) => !c.parent_id);
  const openCount = topLevel.filter((c: any) => c.status !== 'closed').length;
  const closedCount = topLevel.filter((c: any) => c.status === 'closed').length;

  // Count threads by type
  const typeCounts: Record<string, number> = {};
  for (const t of topLevel) {
    const type = (t as any).thread_type || 'general';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }

  return (
    <div className="community-layout">
      <aside className="community-sidebar">
        <div className="glass-card-content">
          <Link href={`/topic/${slug}`} className="nav-link" style={{ marginBottom: '1.5rem', fontWeight: 800, color: 'var(--color-gold)' }}>
            ← Back to Article
          </Link>

          <div className="nav-group">
            <span className="nav-heading">Topic Context</span>
            <Link href={`/topic/${slug}`} className="nav-link">
              <span className="nav-link-icon">📄</span> Article View
            </Link>
            <Link href={`/topic/${slug}/history`} className="nav-link">
              <span className="nav-link-icon">⏳</span> Revision History
            </Link>
          </div>

          <div className="nav-group" style={{ marginTop: '2rem' }}>
            <span className="nav-heading">Board Overview</span>
            <div className="stats-ledger">
              <div className="stats-item">
                <span className="stats-label">Active Threads</span>
                <span className="stats-value">{openCount}</span>
              </div>
              <div className="stats-item">
                <span className="stats-label">Resolved</span>
                <span className="stats-value">{closedCount}</span>
              </div>
              <div className="stats-item" style={{ border: 'none' }}>
                <span className="stats-label">Total Posts</span>
                <span className="stats-value">{allComments.length}</span>
              </div>
            </div>
          </div>

          {/* Thread type breakdown */}
          {Object.keys(typeCounts).length > 0 && (
            <div className="nav-group" style={{ marginTop: '1.5rem' }}>
              <span className="nav-heading">By Type</span>
              <div className="stats-ledger">
                {typeCounts.question > 0 && (
                  <div className="stats-item"><span className="stats-label">❓ Questions</span><span className="stats-value">{typeCounts.question}</span></div>
                )}
                {typeCounts.interpretation > 0 && (
                  <div className="stats-item"><span className="stats-label">⚖️ Interpretations</span><span className="stats-value">{typeCounts.interpretation}</span></div>
                )}
                {typeCounts.improvement > 0 && (
                  <div className="stats-item"><span className="stats-label">🛠 Improvements</span><span className="stats-value">{typeCounts.improvement}</span></div>
                )}
                {typeCounts.issue > 0 && (
                  <div className="stats-item"><span className="stats-label">🚨 Issues</span><span className="stats-value">{typeCounts.issue}</span></div>
                )}
                {typeCounts.general > 0 && (
                  <div className="stats-item" style={{ border: 'none' }}><span className="stats-label">💬 General</span><span className="stats-value">{typeCounts.general}</span></div>
                )}
              </div>
            </div>
          )}

          <div className="nav-group" style={{ marginTop: '2rem' }}>
            <span className="nav-heading">Governance</span>
            <div className="glass-card" style={{ padding: '1rem', background: 'rgba(197, 160, 89, 0.03)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                &ldquo;The person who records community consensus must not have been a party to the prior discussion on that point.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="scholarly-content">
        <header className="scholarly-header">
          <span className="context-label">Legal Reasoning Board</span>
          <h1 className="scholarly-title">{node.title}</h1>
          <p className="scholarly-subtitle">Structured discourse for legal analysis and consensus building</p>
        </header>

        <DiscussionThread
          allComments={allComments}
          isLoggedIn={!!user}
          nodeId={node.id}
          slug={slug}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          voteCounts={voteCounts}
          followedThreadIds={followedThreadIds}
        />

        <section className="discussion-continuation" aria-labelledby="discussion-continuation-title">
          <span className="discussion-continuation-label">After the argument</span>
          <h2 id="discussion-continuation-title">Return Argument To The Record</h2>
          <p>
            Discussion around {node.title} should remain attached to the authority&apos;s
            interpretive sequence, where claims become revisions and revisions remain accountable.
          </p>
          <Link href={`/topic/${slug}/history`} className="discussion-continuation-link">
            Continue through the revision record
          </Link>
        </section>

        {!user && (
          <div className="glass-card" style={{ marginTop: '3rem', padding: '2.5rem', textAlign: 'center' }}>
            <h3 className="scholarly-title" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Account Required</h3>
            <p className="scholarly-subtitle" style={{ marginBottom: '2rem', textTransform: 'none', letterSpacing: 'normal' }}>
              Only registered users can participate in discussions.
            </p>
            <Link href="/login" className="btn-primary">Sign In</Link>
          </div>
        )}
      </main>
    </div>
  );
}
