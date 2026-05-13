import React from 'react';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import HistoryListClient from './HistoryListClient';
import './history.css';

// Role badge configuration for the 6-level hierarchy
const ROLE_BADGES: Record<string, { label: string; color: string; short: string }> = {
  reader:             { label: 'Reader',             color: '#94a3b8', short: 'L1' },
  contributor:        { label: 'Contributor',        color: 'var(--color-gold)', short: 'L2' },
  recognized:         { label: 'Recognized',         color: '#22c55e', short: 'L3' },
  senior_scholar:     { label: 'Senior Scholar',     color: '#8b5cf6', short: 'L4' },
  steward:            { label: 'Steward',            color: '#ef4444', short: 'L5' },
  governance_council: { label: 'Governance Council', color: '#f59e0b', short: 'L6' },
};

export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: node } = await supabase.from('nodes').select('id, title').eq('slug', slug).single();
  if (!node) {
    return <div style={{padding: '40px', color: 'white'}}>Topic not found mapping.</div>;
  }

  // Fetch all revisions with content_size, author details, and revision semantics
  const { data: revisions, error: revisionsError } = await supabase
    .from('revisions')
    .select(`
      id, created_at, commit_message, content_size, author_id,
      is_revert, is_reverted, reverted_revision_id, is_flagged,
      profiles!revisions_author_id_fkey ( username, full_display_name, role, reputation_score )
    `)
    .eq('node_id', node.id)
    .order('created_at', { ascending: false });

  // Fetch the current user's role for permission-gated actions (revert)
  let currentUserRole: string | null = null;
  if (user) {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    currentUserRole = userProfile?.role ?? null;
  }

  if (revisionsError) {
    console.error('[history-page] Revisions query error:', revisionsError);
  }

  const revs = (revisions || []) as any[];
  const latestComparableRevisionId = revs.length > 1 ? revs[0]?.id : null;

  // Fetch revision semantics separately (the FK may not be in PostgREST schema cache)
  const revisionIds = revs.map(r => r.id);
  let semanticsMap: Record<string, any> = {};
  if (revisionIds.length > 0) {
    const { data: semanticsData } = await supabase
      .from('revision_semantics')
      .select('revision_id, contribution_thesis, contribution_type, contribution_scope, significance, claims_added, concepts_introduced, evidence_quality')
      .in('revision_id', revisionIds);

    if (semanticsData) {
      for (const sem of semanticsData) {
        semanticsMap[sem.revision_id] = sem;
      }
    }
  }

  // Attach semantics to each revision
  for (const rev of revs) {
    rev.revision_semantics = semanticsMap[rev.id] || null;
  }

  // Pre-compute size deltas between consecutive revisions
  const sizeDeltas: Record<string, number | null> = {};
  for (let i = 0; i < revs.length; i++) {
    const currentSize = revs[i].content_size ?? 0;
    if (i === revs.length - 1) {
      sizeDeltas[revs[i].id] = currentSize;
    } else {
      const prevSize = revs[i + 1].content_size ?? 0;
      sizeDeltas[revs[i].id] = currentSize - prevSize;
    }
  }

  // Fetch vote/endorsement counts and user state for each revision

  let voteCounts: Record<string, number> = {};
  let userVotes: string[] = [];
  let endorsementCounts: Record<string, number> = {};
  let userEndorsements: string[] = [];

  if (revisionIds.length > 0) {
    // Upvote counts per revision
    const { data: votes } = await supabase
      .from('contribution_votes')
      .select('revision_id')
      .in('revision_id', revisionIds);

    if (votes) {
      for (const v of votes) {
        voteCounts[v.revision_id] = (voteCounts[v.revision_id] || 0) + 1;
      }
    }

    // Endorsement counts per revision
    const { data: endorsements } = await supabase
      .from('endorsements')
      .select('revision_id')
      .in('revision_id', revisionIds);

    if (endorsements) {
      for (const e of endorsements) {
        endorsementCounts[e.revision_id] = (endorsementCounts[e.revision_id] || 0) + 1;
      }
    }

    if (user) {
      const { data: myVotes } = await supabase
        .from('contribution_votes')
        .select('revision_id')
        .eq('user_id', user.id)
        .in('revision_id', revisionIds);

      if (myVotes) userVotes = myVotes.map(v => v.revision_id);

      const { data: myEndorsements } = await supabase
        .from('endorsements')
        .select('revision_id')
        .eq('endorser_id', user.id)
        .in('revision_id', revisionIds);

      if (myEndorsements) userEndorsements = myEndorsements.map(e => e.revision_id);
    }
  }

  // ---- Compute timeline statistics for sidebar ----
  const uniqueAuthors = new Set(revs.map((r: any) => r.author_id));
  const significanceCounts = { foundational: 0, substantial: 0, meaningful: 0, minor: 0 };
  for (const rev of revs) {
    const sem = Array.isArray(rev.revision_semantics)
      ? rev.revision_semantics[0]
      : rev.revision_semantics;
    const sig = sem?.significance || 'meaningful';
    if (sig in significanceCounts) {
      significanceCounts[sig as keyof typeof significanceCounts]++;
    }
  }

  // Compute epoch data for sidebar jump links
  const epochMap: Record<string, number> = {};
  for (const rev of revs) {
    const d = new Date(rev.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    epochMap[key] = (epochMap[key] || 0) + 1;
  }
  const epochKeys = Object.keys(epochMap).sort().reverse();

  // Date range
  const firstRevDate = revs.length > 0
    ? new Date(revs[revs.length - 1].created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—';
  const lastRevDate = revs.length > 0
    ? new Date(revs[0].created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="history-layout">
      <aside className="topic-sidebar glass-panel">
        {/* Navigation */}
        <div className="sidebar-section">
          <h3>Navigation</h3>
          <ul>
            <li><Link href={`/topic/${slug}`}>Back to Article</Link></li>
            <li><Link href={`/topic/${slug}/discussion`}>Discussion</Link></li>
          </ul>
        </div>

        {/* Timeline Intelligence — Minimal & Scholarly */}
        {revs.length > 0 && (
          <div className="sidebar-section">
            <h3>Timeline</h3>
            <div className="sidebar-stat-row">
              <span className="sidebar-stat-label">Revisions</span>
              <span className="sidebar-stat-value">{revs.length}</span>
            </div>
            <div className="sidebar-stat-row">
              <span className="sidebar-stat-label">Contributors</span>
              <span className="sidebar-stat-value">{uniqueAuthors.size}</span>
            </div>
            {(significanceCounts.foundational + significanceCounts.substantial) > 0 && (
              <div className="sidebar-stat-row">
                <span className="sidebar-stat-label">Major</span>
                <span className="sidebar-stat-value">{significanceCounts.foundational + significanceCounts.substantial}</span>
              </div>
            )}
            <div className="sidebar-stat-row">
              <span className="sidebar-stat-label">Period</span>
              <span className="sidebar-stat-value" style={{ fontSize: '0.68rem' }}>
                {firstRevDate === lastRevDate ? firstRevDate : `${firstRevDate} — ${lastRevDate}`}
              </span>
            </div>
          </div>
        )}

        {/* Epoch Quick-Jump */}
        {epochKeys.length > 1 && (
          <div className="sidebar-section">
            <h3>Epochs</h3>
            <div className="sidebar-epoch-jump">
              {epochKeys.slice(0, 8).map(key => {
                const [y, m] = key.split('-');
                const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                return (
                  <a key={key} className="sidebar-epoch-link" href={`#epoch-${key}`}>
                    {label} <span style={{ opacity: 0.5, fontSize: '0.65rem', marginLeft: 4 }}>({epochMap[key]})</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      <main className="history-content">
        <header className="history-header">
          <div>
            <h1 className="topic-title">Revision History</h1>
            <p className="history-subtitle">
              Intellectual evolution of &quot;{node.title}&quot;
            </p>
          </div>
        </header>

        <section className="history-continuation" aria-labelledby="history-continuation-title">
          <span className="history-continuation-label">Temporal jurisprudence</span>
          <h2 id="history-continuation-title">Read The Latest Movement In Context</h2>
          <p>
            This timeline is not a commit ledger. It records how the interpretation of
            {` ${node.title} `}has moved through successive scholarly interventions.
          </p>
          {latestComparableRevisionId ? (
            <Link href={`/topic/${slug}/compare?rev=${latestComparableRevisionId}`} className="history-continuation-link">
              Compare the latest interpretive movement
            </Link>
          ) : (
            <Link href={`/topic/${slug}/discussion`} className="history-continuation-link">
              Continue into scholarly discussion
            </Link>
          )}
        </section>

        <HistoryListClient
           revs={revs}
           slug={slug}
           user={user}
           voteCounts={voteCounts}
           userVotes={userVotes}
           endorsementCounts={endorsementCounts}
           userEndorsements={userEndorsements}
           currentUserRole={currentUserRole}
           sizeDeltas={sizeDeltas}
           roleBadges={ROLE_BADGES}
        />

        {revs.length === 0 && (
          <div className="history-empty">
            <p>No revisions found for this article.</p>
          </div>
        )}
      </main>
    </div>
  );
}
