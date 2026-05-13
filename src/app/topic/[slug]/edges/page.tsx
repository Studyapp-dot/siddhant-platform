import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { addEdge, removeEdge } from './actions';
import EdgeForm from './EdgeForm';
import './edges.css';

/* ========================================
   EDGE FAMILIES — Enriched Ontology
   Each type: value, label, signal, hint,
   description (tooltip), guidance, example
   ======================================== */

import { EDGE_FAMILIES } from './edgeTypes';


export default async function EdgeManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { slug } = await params;
  const { error, success } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: node } = await supabase
    .from('nodes')
    .select('id, title, node_type')
    .eq('slug', slug)
    .single();
  if (!node) redirect('/');

  // Fetch OUTGOING edges
  const { data: outgoing } = await supabase
    .from('cross_references')
    .select(`
      id, relationship_type, description, signal, created_at, created_by, target_section_id,
      nodes!cross_references_target_node_id_fkey ( slug, title, node_type ),
      article_sections ( slug, title, deleted_at )
    `)
    .eq('source_node_id', node.id)
    .order('relationship_type');

  // Fetch INCOMING edges
  const { data: incoming } = await supabase
    .from('cross_references')
    .select(`
      id, relationship_type, description, signal, created_at, created_by, target_section_id,
      nodes!cross_references_source_node_id_fkey ( slug, title, node_type ),
      article_sections ( slug, title, deleted_at )
    `)
    .eq('target_node_id', node.id)
    .order('relationship_type');

  // Resolve creator usernames from created_by IDs (resilient — no FK dependency)
  const allEdges = [...(outgoing || []), ...(incoming || [])];
  const creatorIds = [...new Set(allEdges.map((e: any) => e.created_by).filter(Boolean))];
  const creatorMap: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', creatorIds);
    for (const c of (creators || [])) {
      creatorMap[c.id] = c.username;
    }
  }

  const { data: allNodes } = await supabase
    .from('nodes')
    .select('id, slug, title')
    .neq('id', node.id)
    .order('title');

  // Helpers
  const getTypeInfo = (type: string) => {
    for (const fam of EDGE_FAMILIES) {
      const found = fam.types.find(t => t.value === type);
      if (found) return { ...found, family: fam.family, color: fam.color };
    }
    return null;
  };

  // Group outgoing edges by family for scholarly presentation
  const groupedOutgoing: Record<string, Array<any>> = {};
  for (const edge of (outgoing || [])) {
    const info = getTypeInfo(edge.relationship_type);
    const familyKey = info?.family || 'Other';
    if (!groupedOutgoing[familyKey]) groupedOutgoing[familyKey] = [];
    groupedOutgoing[familyKey].push(edge);
  }

  // Format date for attribution
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const totalOutgoing = outgoing?.length ?? 0;
  const totalIncoming = incoming?.length ?? 0;
  const primaryOutgoing = outgoing?.[0] as any | undefined;

  return (
    <div className="edges-layout">
      <div className="edges-container">
        <Link href={`/topic/${slug}`} className="back-link">
          ← Back to Scholar View
        </Link>

        <header className="edges-header">
          <div className="header-meta">
            <h1 className="edges-title">Doctrinal Relationships</h1>
            <p className="edges-subtitle">
              How this legal authority connects to the broader jurisprudential landscape — 
              through precedent, interpretation, legislation, and doctrine. The graph remains
              Siddhant&apos;s cartography; this page is the scholarly reading of its mapped claims.
            </p>
          </div>

          <div className="anchor-node-card">
            <span className="anchor-label">Subject Authority</span>
            <span className="anchor-title">{node.title}</span>
            <span className="anchor-type">
              {node.node_type?.replace(/_/g, ' ')}
            </span>
          </div>
        </header>

        {error && (
          <div className="alert-error">
            ⚠ {decodeURIComponent(error)}
          </div>
        )}
        {success && (
          <div className="alert-success">
            ✓ {decodeURIComponent(success)}
          </div>
        )}

        {/* ===== EXISTING RELATIONSHIPS (Primary — Dominates Page) ===== */}

        <section className="relationships-area">
          <div className="section-header">
            <h2 className="section-heading">
              Established Doctrinal Relationships
              <span className="count-pill">{totalOutgoing}</span>
            </h2>
            {totalOutgoing > 0 && (
              <p className="section-desc">
                The jurisprudential connections established from this authority to other legal sources.
              </p>
            )}
          </div>

          {totalOutgoing > 0 ? (
            <>
              {EDGE_FAMILIES.map(fam => {
                const familyEdges = groupedOutgoing[fam.family];
                if (!familyEdges || familyEdges.length === 0) return null;

                return (
                  <div key={fam.family} className="family-group">
                    <div className="family-group-header">
                      <span className="family-group-title">
                        <span className="family-dot" style={{ background: fam.color }} />
                        {fam.family}
                        <span className="family-count">({familyEdges.length})</span>
                      </span>
                      <span className="family-group-desc">{fam.narrative}</span>
                    </div>

                    <div className="family-group-edges">
                      {familyEdges.map((edge: any) => {
                        const info = getTypeInfo(edge.relationship_type);
                        const creatorName = edge.created_by ? creatorMap[edge.created_by] : null;

                        return (
                          <div
                            key={edge.id}
                            className="edge-card"
                            data-signal={edge.signal || info?.signal || 'neutral'}
                          >
                            {/* Thesis — the primary content */}
                            {edge.description ? (
                              <div className="edge-thesis">
                                {edge.description}
                              </div>
                            ) : (
                              <div className="edge-no-thesis">
                                No scholarly interpretation provided. Relationships supported by reasoning are more trusted by the community.
                              </div>
                            )}

                            {/* Relationship type + target authority */}
                            <div className="edge-type-line">
                              <span
                                className="edge-type-badge"
                                style={{ color: info?.color }}
                                title={info?.description || ''}
                              >
                                {info?.label || edge.relationship_type}
                              </span>
                              <span className="edge-arrow">→</span>
                              <Link
                                href={`/topic/${edge.nodes?.slug}${edge.article_sections && !edge.article_sections.deleted_at ? `#${edge.article_sections.slug}` : ''}`}
                                className="edge-target-link"
                              >
                                {edge.nodes?.title}
                                {edge.article_sections ? (
                                  edge.article_sections.deleted_at ? (
                                    <span className="edge-target-section deleted" title="This section was removed or altered in a recent revision." style={{ opacity: 0.6, fontSize: '0.9em', marginLeft: '6px' }}>
                                      — § {edge.article_sections.title} (Archived)
                                    </span>
                                  ) : (
                                    <span className="edge-target-section" style={{ fontSize: '0.9em', marginLeft: '6px', color: 'var(--text-muted)' }}>
                                      — § {edge.article_sections.title}
                                    </span>
                                  )
                                ) : null}
                              </Link>
                            </div>

                            {/* Evidence placeholder */}
                            <div className="edge-evidence-placeholder">
                              Supporting evidence · citations · coming soon
                            </div>

                            {/* Attribution + Remove */}
                            <div className="edge-meta">
                              <span className="edge-attribution">
                                {creatorName ? (
                                  <>
                                    Proposed by{' '}
                                    <Link href={`/profile/${creatorName}`}>@{creatorName}</Link>
                                  </>
                                ) : (
                                  'Attribution pending'
                                )}
                                {edge.created_at && ` · ${formatDate(edge.created_at)}`}
                              </span>
                              <form action={removeEdge}>
                                <input type="hidden" name="edge_id" value={edge.id} />
                                <input type="hidden" name="slug" value={slug} />
                                <button type="submit" className="remove-btn">
                                  Remove Relationship
                                </button>
                              </form>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📖</div>
              <span className="empty-state-text">
                No doctrinal relationships established yet.
              </span>
              <span className="empty-state-hint">
                Use the form below to map how this authority connects to the broader legal landscape.
              </span>
            </div>
          )}

          {/* ===== INCOMING EDGES ===== */}
          {totalIncoming > 0 && (
            <div className="incoming-section">
              <div className="section-header">
                <h3 className="section-heading">
                  Authorities Citing This Topic
                  <span className="count-pill">{totalIncoming}</span>
                </h3>
                <p className="section-desc">
                  Other legal authorities that have established doctrinal relationships to this topic.
                </p>
              </div>

              <div className="family-group-edges">
                {incoming!.map((edge: any) => {
                  const info = getTypeInfo(edge.relationship_type);
                  const creatorName = edge.created_by ? creatorMap[edge.created_by] : null;

                  return (
                    <div key={edge.id} className="incoming-edge-card">
                      {/* Source link */}
                      <div className="incoming-source-line">
                        <span className="incoming-from-label">Cited by</span>
                        <Link
                          href={`/topic/${edge.nodes?.slug}`}
                          className="incoming-source-link"
                        >
                          {edge.nodes?.title}
                        </Link>
                        {edge.article_sections ? (
                          edge.article_sections.deleted_at ? (
                            <span className="edge-target-section deleted" title="This section was removed or altered in a recent revision." style={{ opacity: 0.6, fontSize: '0.85rem', marginLeft: '6px' }}>
                              ↳ citing § {edge.article_sections.title} (Archived)
                            </span>
                          ) : (
                            <span className="edge-target-section" style={{ fontSize: '0.85rem', marginLeft: '6px', color: 'var(--text-muted)' }}>
                              ↳ citing § {edge.article_sections.title}
                            </span>
                          )
                        ) : null}
                      </div>

                      {/* Thesis if present */}
                      {edge.description && (
                        <div className="edge-thesis" style={{ fontSize: '0.95rem' }}>
                          {edge.description}
                        </div>
                      )}

                      {/* Type + attribution */}
                      <div className="edge-type-line">
                        <span
                          className="incoming-type-badge"
                          style={{ color: info?.color }}
                        >
                          via {info?.label || edge.relationship_type}
                        </span>
                        {creatorName && (
                          <span className="edge-attribution" style={{ marginLeft: 'auto' }}>
                            by{' '}
                            <Link href={`/profile/${creatorName}`}>@{creatorName}</Link>
                            {edge.created_at && ` · ${formatDate(edge.created_at)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ===== COMPOSITION PANEL (Secondary — Bottom) ===== */}

        <section className="composition-panel">
          <div className="composition-header">
            <h2 className="composition-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Propose a Doctrinal Relationship
            </h2>
            <p className="composition-desc">
              Explain how this authority relates to another legal source. 
              Well-reasoned relationships with scholarly interpretation are valued most by the community.
            </p>
          </div>

          <EdgeForm sourceNodeId={node.id} sourceSlug={slug} allNodes={allNodes || []} />
        </section>

        <section className="edges-continuation" aria-labelledby="edges-continuation-title">
          <div className="edges-continuation-heading">
            <span className="edges-continuation-label">After the relation</span>
            <h2 id="edges-continuation-title">Move From Map To Interpretation</h2>
            <p>
              A mapped relationship matters only when it changes how an authority is read.
              Continue into the connected interpretation most directly before this page.
            </p>
          </div>

          {primaryOutgoing?.nodes?.slug ? (
            <Link href={`/topic/${primaryOutgoing.nodes.slug}`} className="edges-continuation-link edges-continuation-primary">
              <span>Continue into {primaryOutgoing.nodes.title}</span>
              <small>Read the connected authority through the relationship just mapped here.</small>
            </Link>
          ) : (
            <Link href={`/topic/${slug}/discussion`} className="edges-continuation-link edges-continuation-primary">
              <span>Discuss the doctrinal significance</span>
              <small>When no relationship has been mapped yet, the next movement is scholarly argument.</small>
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
