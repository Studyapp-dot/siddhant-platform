import React from 'react';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import DiffViewer from './DiffViewer';
import './compare.css';

// Contribution type labels (matches History page)
const TYPE_LABELS: Record<string, string> = {
  citation_addition: 'Citation Addition',
  doctrinal_expansion: 'Doctrinal Expansion',
  conceptual_clarification: 'Conceptual Clarification',
  precedent_synthesis: 'Precedent Synthesis',
  contradiction_resolution: 'Contradiction Resolution',
  structural_reorganization: 'Structural Reorganization',
  historical_context: 'Historical Context',
  analytical_improvement: 'Analytical Improvement',
  terminology_standardization: 'Terminology Standardization',
  evidence_strengthening: 'Evidence Strengthening',
  mixed: 'Mixed Contribution',
};

export default async function ComparePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>,
  searchParams: Promise<{ oldRev?: string, newRev?: string, rev?: string }>
}) {
  const { slug } = await params;
  const { oldRev, newRev, rev } = await searchParams;
  const supabase = await createClient();

  if (!oldRev && !newRev && !rev) {
    return (
      <div className="compare-layout" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <h2 className="compare-header-title">Selection Required</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Please select exactly two revisions from the history to perform a comparison.
        </p>
        <Link href={`/topic/${slug}/history`} className="btn-primary">Return to History</Link>
      </div>
    );
  }

  // ── 1. Fetch revision data ──
  let oldData: any = null;
  let newData: any = null;

  const revisionFields = 'id, node_id, report_content, tier1_content, commit_message, created_at, content_size, is_revert, is_reverted, is_flagged, profiles!revisions_author_id_fkey(username, role)';

  if (rev) {
    const { data: currentRev } = await supabase
      .from('revisions')
      .select(revisionFields)
      .eq('id', rev)
      .maybeSingle();

    if (currentRev) {
      newData = currentRev;

      const { data: previousRev } = await supabase
        .from('revisions')
        .select(revisionFields)
        .eq('node_id', currentRev.node_id)
        .lt('created_at', currentRev.created_at)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousRev) {
        oldData = previousRev;
      } else {
        oldData = {
          id: 'initial',
          node_id: currentRev.node_id,
          commit_message: '[Created Article]',
          created_at: currentRev.created_at,
          report_content: '',
          tier1_content: '',
          content_size: 0,
          profiles: { username: 'System', role: 'System' }
        };
      }
    }
  } else {
    const { data: revData } = await supabase
      .from('revisions')
      .select(revisionFields)
      .in('id', [oldRev, newRev]);

    oldData = revData?.find((r: any) => r.id === oldRev) || null;
    newData = revData?.find((r: any) => r.id === newRev) || null;
  }

  if (!oldData || !newData) {
    return (
      <div className="compare-layout" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ color: '#ef4444' }}>Error loading revisions.</p>
        <Link href={`/topic/${slug}/history`} className="compare-nav-link" style={{ marginTop: '16px', display: 'inline-block' }}>
          Return to History
        </Link>
      </div>
    );
  }

  // ── 2. Fetch node info ──
  const nodeId = newData.node_id || oldData.node_id;
  const { data: node } = await supabase
    .from('nodes')
    .select('id, title, node_type')
    .eq('id', nodeId)
    .single();

  const nodeTitle = node?.title || 'Untitled';

  // ── 3. Fetch semantics for the newer revision ──
  let semantics: any = null;
  if (newData.id !== 'initial') {
    const { data: semData } = await supabase
      .from('revision_semantics')
      .select('contribution_thesis, contribution_type, significance, concepts_introduced')
      .eq('revision_id', newData.id)
      .maybeSingle();
    semantics = semData;
  }

  // ── 4. Compute revision positions & navigation ──
  const { data: allRevisions } = await supabase
    .from('revisions')
    .select('id')
    .eq('node_id', nodeId)
    .order('created_at', { ascending: true });

  const revList = (allRevisions || []).map((r: any) => r.id);
  const totalRevisions = revList.length;
  const oldIndex = revList.indexOf(oldData.id);
  const newIndex = revList.indexOf(newData.id);
  const oldPosition = oldIndex >= 0 ? oldIndex + 1 : null;
  const newPosition = newIndex >= 0 ? newIndex + 1 : null;

  // Navigation: step through revision comparisons
  const prevCompareRevId = newIndex > 0 ? revList[newIndex - 1] : null;
  const nextCompareRevId = newIndex < revList.length - 1 ? revList[newIndex + 1] : null;

  // ── 5. Prepare display data ──
  const oldContent = oldData?.report_content || oldData?.tier1_content || '';
  const newContent = newData?.report_content || newData?.tier1_content || '';

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const oldDate = oldData?.created_at ? formatDate(oldData.created_at) : '';
  const newDate = newData?.created_at ? formatDate(newData.created_at) : '';
  const oldShortId = oldData?.id?.substring(0, 8) || '';
  const newShortId = newData?.id?.substring(0, 8) || '';

  // Significance
  const significance = semantics?.significance || null;
  const significanceLabel = significance === 'foundational' ? '✦ High Significance'
    : significance === 'substantial' ? 'Major Revision' : null;

  // Governance state
  const isRevert = newData.is_revert === true;
  const isReverted = newData.is_reverted === true;
  const isFlagged = newData.is_flagged === true;
  const hasGovernance = isRevert || isReverted || isFlagged;

  // Semantic display
  const thesis = semantics?.contribution_thesis || null;
  const contributionType = semantics?.contribution_type
    ? TYPE_LABELS[semantics.contribution_type] || semantics.contribution_type
    : null;
  const concepts = (semantics?.concepts_introduced || []).slice(0, 2);

  return (
    <div className="compare-layout">
      {/* ── Contextual Header ── */}
      <header className="compare-header">
        <h1 className="compare-header-title">{nodeTitle} — Revision Evolution</h1>
        <div className="compare-header-range">
          <span>
            Comparing{' '}
            {oldPosition ? `Revision ${oldPosition}` : 'Origin'}
            {' → '}
            {newPosition ? `Revision ${newPosition}` : 'Latest'}
            {totalRevisions > 0 && ` of ${totalRevisions}`}
          </span>
          <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>·</span>
          <span>{oldDate} → {newDate}</span>
          <span className="hash-secondary">#{oldShortId} → #{newShortId}</span>
        </div>
        {significanceLabel && (
          <div className="compare-header-sig">
            <span className={`sig-badge ${significance}`}>{significanceLabel}</span>
          </div>
        )}
      </header>

      {/* ── Scholarly Change Summary ── */}
      {thesis && (
        <div className="scholarly-summary">
          <div className="summary-label">Scholarly Change Summary</div>
          <div className="summary-thesis">{thesis}</div>
          <div className="summary-meta">
            {contributionType && (
              <span className="summary-chip type-chip">{contributionType}</span>
            )}
            {significance && significance !== 'minor' && (
              <span className="summary-chip">{significance}</span>
            )}
            {concepts.map((c: string, i: number) => (
              <span key={i} className="summary-chip">{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Governance Context ── */}
      {hasGovernance && (
        <div className="governance-strip">
          <div className="governance-badges">
            {isReverted && <span className="governance-badge reverted">✗ Reverted</span>}
            {isRevert && <span className="governance-badge revert">↩ Revert</span>}
            {isFlagged && <span className="governance-badge flagged">⚑ Flagged</span>}
          </div>
          <div className="governance-actions">
            <Link href={`/topic/${slug}/history`}>View in History</Link>
          </div>
        </div>
      )}

      {/* ── Commit Cards ── */}
      <div className="diff-commits-row">
        <div className="diff-commit-card old-commit">
          <span className="diff-commit-badge">Previous</span>
          <p className="diff-commit-msg">{oldData?.commit_message}</p>
          <div className="diff-commit-meta">
            <Link href={`/profile/${oldData?.profiles?.username}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>
              @{oldData?.profiles?.username}
            </Link>
            {' · '}{oldDate}
          </div>
        </div>
        <div className="diff-arrow">→</div>
        <div className="diff-commit-card new-commit">
          <span className="diff-commit-badge">New Revision</span>
          <p className="diff-commit-msg">{newData?.commit_message}</p>
          <div className="diff-commit-meta">
            <Link href={`/profile/${newData?.profiles?.username}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>
              @{newData?.profiles?.username}
            </Link>
            {' · '}{newDate}
          </div>
        </div>
      </div>

      {/* ── Navigation Continuity ── */}
      <div className="compare-nav">
        <div className="compare-nav-group">
          {prevCompareRevId ? (
            <Link href={`/topic/${slug}/compare?rev=${prevCompareRevId}`} className="compare-nav-link">
              ← Previous Revision
            </Link>
          ) : (
            <span className="compare-nav-link disabled">← Previous Revision</span>
          )}
        </div>
        <div className="compare-nav-group">
          <Link href={`/topic/${slug}/history`} className="compare-nav-link">History</Link>
          <Link href={`/topic/${slug}`} className="compare-nav-link">Current Article</Link>
        </div>
        <div className="compare-nav-group">
          {nextCompareRevId ? (
            <Link href={`/topic/${slug}/compare?rev=${nextCompareRevId}`} className="compare-nav-link">
              Next Revision →
            </Link>
          ) : (
            <span className="compare-nav-link disabled">Next Revision →</span>
          )}
        </div>
      </div>

      {/* ── Diff Viewer ── */}
      <DiffViewer oldText={oldContent} newText={newContent} significance={significance} />

      <section className="interpretive-continuation" aria-labelledby="compare-continuation-title">
        <div className="continuation-heading">
          <span className="continuation-label">After this shift</span>
          <h2 id="compare-continuation-title">Move From Revision To Debate</h2>
          <p>
            This revision changes how {nodeTitle} is read. Its meaning should now be
            tested through the scholarly discussion around the authority.
          </p>
        </div>

        <Link href={`/topic/${slug}/discussion`} className="continuation-link continuation-primary">
          <span>Continue into the scholarly discussion</span>
          <small>Examine whether this interpretive change should be accepted, refined, or contested.</small>
        </Link>
      </section>
    </div>
  );
}
