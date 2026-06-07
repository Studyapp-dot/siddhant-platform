import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { RevealSection } from './components/LandingAnimations';
import './page.css';

// Node type display config (shared with topic page)
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

// Human-readable relative time
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
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Live node count
  const { count } = await supabase
    .from('nodes')
    .select('id', { count: 'estimated', head: true })
    .is('deleted_at', null);
  const totalCount = count ?? 0;

  // Fetch featured archive nodes — real data, not fake
  const { data: featuredNodes } = await supabase
    .from('nodes')
    .select('id, title, slug, node_type')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(6);

  // For each featured node, get revision count
  const nodesWithStats = await Promise.all(
    (featuredNodes || []).slice(0, 4).map(async (node: any) => {
      const { count: revCount } = await supabase
        .from('revisions')
        .select('id', { count: 'exact', head: true })
        .eq('node_id', node.id);

      const { data: contributors } = await supabase
        .from('revisions')
        .select('author_id')
        .eq('node_id', node.id);
      const uniqueContributors = new Set(contributors?.map((r: any) => r.author_id) || []).size;

      return {
        ...node,
        revisionCount: revCount ?? 0,
        contributorCount: uniqueContributors,
      };
    })
  );

  // === SCHOLARLY VITALITY SIGNALS (real data) ===

  // Latest recorded interpretation (most recent revision with semantic thesis)
  const { data: latestSemanticRev } = await supabase
    .from('revision_semantics')
    .select('contribution_thesis, created_at, revision_id')
    .not('contribution_thesis', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let latestThesisSignal: { thesis: string; nodeTitle: string; timeAgo: string } | null = null;
  if (latestSemanticRev?.contribution_thesis) {
    // Look up the node title for this revision
    const { data: revNode } = await supabase
      .from('revisions')
      .select('nodes!inner(title)')
      .eq('id', latestSemanticRev.revision_id)
      .maybeSingle();
    const nodeTitle = (revNode as any)?.nodes?.title || 'Unknown';
    latestThesisSignal = {
      thesis: latestSemanticRev.contribution_thesis,
      nodeTitle,
      timeAgo: getTimeAgo(new Date(latestSemanticRev.created_at)),
    };
  }

  // Latest doctrinal relationship
  const { data: latestEdge } = await supabase
    .from('cross_references')
    .select('relationship_type, source:nodes!cross_references_source_node_id_fkey(title), target:nodes!cross_references_target_node_id_fkey(title), created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let latestRelationship: { sourceTitle: string; targetTitle: string; type: string; timeAgo: string } | null = null;
  if (latestEdge) {
    const src = Array.isArray(latestEdge.source) ? latestEdge.source[0] : latestEdge.source;
    const tgt = Array.isArray(latestEdge.target) ? latestEdge.target[0] : latestEdge.target;
    latestRelationship = {
      sourceTitle: (src as any)?.title || 'Unknown',
      targetTitle: (tgt as any)?.title || 'Unknown',
      type: (latestEdge.relationship_type || '').replace(/_/g, ' '),
      timeAgo: getTimeAgo(new Date(latestEdge.created_at)),
    };
  }

  // Pending review cycles count
  const { count: pendingReviews } = await supabase
    .from('review_cycles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');

  return (
    <div className="landing-page">
      {/* ===== HERO — INSTITUTIONAL, SERIF-DOMINANT ===== */}
      <header className="lp-hero" style={{ paddingTop: '60px' }}>
        <div className="lp-hero-badge">
          <span className="lp-hero-badge-dot" />
          Private Beta &middot; {totalCount} nodes live
        </div>

        <h1 className="lp-hero-title">
          The Living Memory<br />of Indian Law
        </h1>

        <p className="lp-hero-sub">
          A living archive where Indian jurisprudence is documented,
          debated, and traced through time. Human-authored, community-verified.
        </p>

        <div className="lp-hero-actions">
          {user ? (
            <>
              <Link href="/dashboard" className="lp-btn-primary">Go to Scholar's Desk</Link>
              <Link href="/nodes" className="lp-btn-ghost">Browse the Archive</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="lp-btn-primary">Explore Jurisprudence</Link>
              <Link href="/nodes" className="lp-btn-ghost">Browse the Archive</Link>
            </>
          )}
        </div>

        {/* Institutional anchor — subtle transition from hero to content */}
        <div className="lp-hero-anchor">
          Tracing interpretation through time since 1950
        </div>
      </header>

      {/* ===== NARRATIVE CONNECTOR: Constitution → Interpretation ===== */}
      <div className="lp-narrative-connector">
        <span className="lp-narrative-line" />
        <span className="lp-narrative-text">Constitution is written once. Interpretation never stops.</span>
        <span className="lp-narrative-line" />
      </div>

      {/* ===== JURISPRUDENTIAL EXHIBITION ===== */}
      {/* "Curated constitutional moments" — editorial unfolding, not infographic */}
      <section className="lp-section lp-exhibition" id="exhibition">
        <RevealSection>
          <div className="lp-exhibition-header lp-header-left">
            <div className="lp-section-label">Jurisprudential Exhibition</div>
            <h2 className="lp-section-title">How Article 21 Expanded Across Decades</h2>
            <p className="lp-section-sub">
              Legal meaning is never static. Watch how a single constitutional provision
              evolved through judicial interpretation — the kind of evolution Siddhant traces.
            </p>
          </div>
        </RevealSection>

        {/* Curated constitutional moments */}
        <div className="lp-moments">
          <RevealSection>
            <div className="lp-moment">
              <div className="lp-moment-year">Constitution, 1950</div>
              <h3 className="lp-moment-title">Article 21</h3>
              <p className="lp-moment-desc">
                &ldquo;No person shall be deprived of his life or personal liberty except 
                according to procedure established by law.&rdquo;
              </p>
              <p className="lp-moment-desc" style={{ marginTop: '8px', fontStyle: 'normal', fontSize: '0.82rem' }}>
                Originally interpreted narrowly — procedural compliance alone sufficed, 
                regardless of whether the procedure itself was fair.
              </p>
            </div>
          </RevealSection>

          <RevealSection delay={100}>
            <div className="lp-moment">
              <div className="lp-moment-year">Maneka Gandhi v. Union of India, 1978</div>
              <h3 className="lp-moment-title">Procedure Must Be Fair, Just, and Reasonable</h3>
              <p className="lp-moment-desc">
                The Supreme Court held that &ldquo;procedure established by law&rdquo; must satisfy 
                the test of reasonableness. Article 21 was no longer a mere procedural safeguard — 
                it became a substantive guarantee of liberty.
              </p>
              {/* Diff preview — Siddhant's signature visual */}
              <div className="lp-diff-wrapper">
                <div className="lp-diff-preview">
                  <span className="lp-diff-label">Interpretive Evolution</span>
                  <code className="lp-diff-line removed">
                    Art. 21 requires only that a &quot;procedure established by law&quot; exists.
                  </code>
                  <code className="lp-diff-line added">
                    Art. 21 requires that procedure be fair, just, and reasonable — not arbitrary.
                  </code>
                  <code className="lp-diff-line added">
                    The right to life includes the right to live with dignity.
                  </code>
                </div>
                <aside className="lp-diff-annotation">
                  This is how Siddhant tracks legal evolution — every interpretive shift is recorded, compared, and preserved.
                </aside>
              </div>
            </div>
          </RevealSection>

          <RevealSection delay={200}>
            <div className="lp-moment">
              <div className="lp-moment-year">K.S. Puttaswamy v. Union of India, 2017</div>
              <h3 className="lp-moment-title">Privacy as Intrinsic to Liberty and Dignity</h3>
              <p className="lp-moment-desc">
                A nine-judge bench unanimously recognized the right to privacy as a fundamental 
                right under Article 21 — privacy of body, mind, information, and choice became 
                constitutionally protected.
              </p>
            </div>
          </RevealSection>

          <RevealSection delay={300}>
            <div className="lp-moment">
              <div className="lp-moment-year">Navtej Singh Johar v. Union of India, 2018</div>
              <h3 className="lp-moment-title">Sexual Autonomy Under Article 21</h3>
              <p className="lp-moment-desc">
                Building on Puttaswamy, the Court struck down Section 377 — 
                recognizing that sexual orientation is an intrinsic element of liberty, 
                dignity, and the right to life under Article 21.
              </p>
            </div>
          </RevealSection>
        </div>

        {/* Doctrinal Cartography — subtle relationship constellation */}
        <RevealSection>
          <div className="lp-cartography">
            <div className="lp-cartography-label">Doctrinal Relationships</div>
            <div className="lp-cartography-map">
              <div className="lp-cartography-node">
                <span className="lp-cartography-node-icon">🏛</span>
                Article 21 — Right to Life
              </div>
              
              <div className="lp-cartography-edge">
                <div className="lp-cartography-edge-line" />
                interpreted by
                <div className="lp-cartography-edge-line" />
              </div>

              <div className="lp-cartography-row">
                <div className="lp-cartography-node">
                  <span className="lp-cartography-node-icon">⚖️</span>
                  Maneka Gandhi
                </div>
                <div className="lp-cartography-connector">expanded by</div>
                <div className="lp-cartography-node">
                  <span className="lp-cartography-node-icon">⚖️</span>
                  Puttaswamy
                </div>
                <div className="lp-cartography-connector">applied in</div>
                <div className="lp-cartography-node">
                  <span className="lp-cartography-node-icon">⚖️</span>
                  Navtej Johar
                </div>
              </div>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* ===== NARRATIVE CONNECTOR: Relationships → Archive ===== */}
      <div className="lp-narrative-connector">
        <span className="lp-narrative-line" />
        <span className="lp-narrative-text">Relationships emerge. Knowledge becomes a living archive.</span>
        <span className="lp-narrative-line" />
      </div>

      {/* ===== THE LIVING ARCHIVE — REAL DATA ===== */}
      <section className="lp-section lp-archive" id="archive">
        <RevealSection>
          <div className="lp-archive-header lp-header-left">
            <div className="lp-section-label">The Living Archive</div>
            <h2 className="lp-section-title">Every Concept Is a Living Document</h2>
            <p className="lp-section-sub">
              Revised, debated, and verified by the scholarly community.
              Each node in the knowledge graph is a collaborative, evolving record.
            </p>
          </div>
        </RevealSection>

        {nodesWithStats.length > 0 ? (
          <div className="lp-archive-grid">
            {nodesWithStats.map((node: any) => {
              const typeMeta = NODE_TYPE_META[node.node_type] || NODE_TYPE_META.topic;
              return (
                <Link href={`/topic/${node.slug}`} key={node.id} className="lp-archive-card">
                  <span
                    className="lp-archive-card-type"
                    style={{ color: typeMeta.color, background: typeMeta.bg }}
                  >
                    {typeMeta.icon} {typeMeta.label}
                  </span>
                  <span className="lp-archive-card-title">{node.title}</span>
                  <span className="lp-archive-card-meta">
                    <span>Evolved through {node.revisionCount} recorded {node.revisionCount === 1 ? 'interpretation' : 'interpretations'}</span>
                    <span>&middot; {node.contributorCount} {node.contributorCount === 1 ? 'contributor' : 'contributors'}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            The archive is being built. Early contributions shape the foundation.
          </div>
        )}

        {/* Scholarly Vitality Strip — real data, restrained */}
        {(latestThesisSignal || latestRelationship || (pendingReviews ?? 0) > 0) && (
          <div className="lp-vitality-strip">
            <div className="lp-vitality-label">Recent Scholarly Activity</div>
            <div className="lp-vitality-signals">
              {latestThesisSignal && (
                <div className="lp-vitality-signal">
                  <span className="lp-vitality-signal-type">Latest recorded interpretation</span>
                  <span className="lp-vitality-signal-content">
                    &ldquo;{latestThesisSignal.thesis}&rdquo;
                  </span>
                  <span className="lp-vitality-signal-meta">
                    on {latestThesisSignal.nodeTitle} &middot; {latestThesisSignal.timeAgo}
                  </span>
                </div>
              )}
              {latestRelationship && (
                <div className="lp-vitality-signal">
                  <span className="lp-vitality-signal-type">Doctrinal relationship established</span>
                  <span className="lp-vitality-signal-content">
                    {latestRelationship.sourceTitle} &nbsp;↔&nbsp; {latestRelationship.targetTitle}
                  </span>
                  <span className="lp-vitality-signal-meta">
                    {latestRelationship.type} &middot; {latestRelationship.timeAgo}
                  </span>
                </div>
              )}
              {(pendingReviews ?? 0) > 0 && (
                <div className="lp-vitality-signal">
                  <span className="lp-vitality-signal-type">Under scholarly review</span>
                  <span className="lp-vitality-signal-content">
                    {pendingReviews} interpretive {pendingReviews === 1 ? 'claim' : 'claims'} awaiting peer review
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="lp-archive-cta-row">
          <Link href="/nodes" className="lp-btn-ghost">
            Browse the Knowledge Archive →
          </Link>
        </div>
      </section>

      {/* ===== NARRATIVE CONNECTOR: Archive → Participation ===== */}
      <div className="lp-narrative-connector">
        <span className="lp-narrative-line" />
        <span className="lp-narrative-text">Scholars participate. The record grows.</span>
        <span className="lp-narrative-line" />
      </div>

      {/* ===== CONTRIBUTE TO THE LIVING RECORD ===== */}
      <section className="lp-section lp-contribute" id="contribute">
        <RevealSection>
          <div className="lp-contribute-header lp-header-left">
            <div className="lp-section-label">Participatory Jurisprudence</div>
            <h2 className="lp-section-title">Contribute to the Living Record</h2>
            <p className="lp-section-sub">
              Siddhant is not a passive archive. It is a scholarly community 
              where legal meaning is built, revised, and debated collaboratively.
            </p>
          </div>
        </RevealSection>

        <div className="lp-contribute-pathways">
          <div className="lp-pathway-card">
            <span className="lp-pathway-icon">✍️</span>
            <h4 className="lp-pathway-title">Document Jurisprudential Meaning</h4>
            <p className="lp-pathway-desc">
              Synthesize legal concepts from primary sources. Every revision 
              becomes part of the permanent scholarly record.
            </p>
          </div>

          <div className="lp-pathway-card">
            <span className="lp-pathway-icon">⚖️</span>
            <h4 className="lp-pathway-title">Review Interpretive Claims</h4>
            <p className="lp-pathway-desc">
              Verify edits using structured rubrics. Your judgment shapes 
              the quality and credibility of the archive.
            </p>
          </div>

          <div className="lp-pathway-card">
            <span className="lp-pathway-icon">🔗</span>
            <h4 className="lp-pathway-title">Trace Doctrinal Lineage</h4>
            <p className="lp-pathway-desc">
              Establish doctrinal connections between legal concepts — 
              the interpretive threads that bind jurisprudence together.
            </p>
          </div>
        </div>
      </section>

      {/* ===== FOOTER — INSTITUTIONAL ===== */}
      <footer className="lp-footer">
        <div className="lp-footer-logo">
          <div className="lp-nav-logo-icon">§</div>
          <span className="lp-nav-logo-text">Siddhant</span>
        </div>

        <p className="lp-footer-mission">
          Built for Indian legal scholarship. A permanent, evolving record of how law is
          interpreted, debated, and understood — authored by the scholarly community,
          verified through transparent peer review.
        </p>

        <div className="lp-footer-links">
          <Link href="/nodes" className="lp-footer-link">Knowledge Archive</Link>
          <Link href="/groups" className="lp-footer-link">Communities</Link>
          <Link href="/recent-changes" className="lp-footer-link">Scholarly Chronicle</Link>
          <Link href="/recognition" className="lp-footer-link">Recognition</Link>
          <Link href="/login" className="lp-footer-link">Sign In</Link>
        </div>
        <div className="lp-footer-copy">
          &copy; 2026 Siddhant &middot; Documenting the evolution of Indian law.
        </div>
      </footer>
    </div>
  );
}
