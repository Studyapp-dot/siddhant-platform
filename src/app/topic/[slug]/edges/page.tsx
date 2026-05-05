import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { addEdge, removeEdge } from './actions';
import './edges.css';

/* ========================================
   EDGE FAMILIES — Enriched Ontology
   Each type: value, label, signal, hint,
   description (tooltip), guidance, example
   ======================================== */

const EDGE_FAMILIES = [
  {
    family: 'Judicial Treatment',
    color: '#f59e0b',
    narrative: 'How courts have adopted, distinguished, or departed from this authority.',
    types: [
      {
        value: 'followed', label: 'Followed', signal: 'positive', class: 'chip-positive',
        hint: 'Ratio applied as binding precedent',
        description: 'The court expressly adopted the ratio decidendi of the cited authority as binding precedent.',
        guidance: 'Use when the judgment directly follows and applies the legal principle established in the target authority.',
        example: 'Maneka Gandhi v. Union of India followed Rustom Cavasjee Cooper v. Union of India',
      },
      {
        value: 'applied', label: 'Applied', signal: 'positive', class: 'chip-positive',
        hint: 'Principle used in new context',
        description: 'The court applied the legal principle from the cited authority to the facts of the present case.',
        guidance: 'Use when the principle is applied but not necessarily as binding — may be persuasive application.',
        example: 'Vishaka v. State of Rajasthan applied CEDAW principles to workplace harassment',
      },
      {
        value: 'approved', label: 'Approved', signal: 'positive', class: 'chip-positive',
        hint: 'Endorsed by higher authority',
        description: 'A higher court endorsed or affirmed the reasoning of the cited authority.',
        guidance: 'Use when an appellate or constitutional court approves a lower court decision.',
        example: 'Supreme Court approved the reasoning in Delhi High Court\'s Naz Foundation judgment',
      },
      {
        value: 'explained', label: 'Explained', signal: 'neutral', class: 'chip-neutral',
        hint: 'Clarified scope or meaning',
        description: 'The court clarified or elaborated the scope and meaning of the cited authority without altering its application.',
        guidance: 'Use when a judgment explains what an earlier decision actually held — resolving ambiguity.',
        example: 'A.K. Gopalan explained the scope of Article 21 before Maneka Gandhi expanded it',
      },
      {
        value: 'referred_to', label: 'Referred To', signal: 'neutral', class: 'chip-neutral',
        hint: 'Mentioned without full adoption',
        description: 'The court mentioned the cited authority in passing — not as a basis for the decision.',
        guidance: 'Use for citations that appear in the judgment but do not drive the ratio.',
        example: 'The court referred to various Law Commission reports in its obiter',
      },
      {
        value: 'distinguished', label: 'Distinguished', signal: 'neutral', class: 'chip-neutral',
        hint: 'Facts or context differ materially',
        description: 'The court held that the cited authority was decided on materially different facts and therefore does not apply.',
        guidance: 'Use when a court acknowledges a precedent but finds it inapplicable due to factual differences.',
        example: 'ADM Jabalpur distinguished from Habeas Corpus cases involving non-emergency contexts',
      },
      {
        value: 'doubted', label: 'Doubted', signal: 'negative', class: 'chip-negative',
        hint: 'Correctness questioned',
        description: 'The court expressed doubt about the correctness of the cited authority without formally overruling it.',
        guidance: 'Use when judicial skepticism is expressed — the authority remains technically valid but weakened.',
        example: 'Several benches doubted the continued applicability of ADM Jabalpur before formal overruling',
      },
      {
        value: 'not_followed', label: 'Not Followed', signal: 'negative', class: 'chip-negative',
        hint: 'Declined to apply',
        description: 'The court declined to follow the cited authority, typically by a court not bound by it.',
        guidance: 'Use when a coordinate or lower court departs from a precedent — distinct from overruling.',
        example: 'A High Court declined to follow another High Court\'s interpretation of Section 498A',
      },
      {
        value: 'overruled', label: 'Overruled', signal: 'negative', class: 'chip-negative',
        hint: 'No longer good law',
        description: 'A higher court has expressly overruled the cited authority — it is no longer good law.',
        guidance: 'Use only for formal overruling by a competent court. The most significant negative treatment.',
        example: 'Puttaswamy overruled the surveillance-permissive aspects of M.P. Sharma and Kharak Singh',
      },
    ],
  },
  {
    family: 'Legislative Lineage',
    color: '#8b5cf6',
    narrative: 'How statutes succeed, modify, or supersede one another through legislative action.',
    types: [
      {
        value: 'replaces', label: 'Replaces', signal: 'neutral', class: 'chip-legislative',
        hint: 'Successor legislation',
        description: 'The source statute entirely replaces the target statute as its successor.',
        guidance: 'Use when a new Act replaces an older one in its entirety (e.g., BNS replacing IPC).',
        example: 'Bharatiya Nyaya Sanhita (BNS) replaces Indian Penal Code (IPC)',
      },
      {
        value: 'amends', label: 'Amends', signal: 'neutral', class: 'chip-legislative',
        hint: 'Modifies specific provisions',
        description: 'The source legislation amends or modifies specific provisions of the target statute.',
        guidance: 'Use for amendment acts that alter portions of an existing statute.',
        example: 'Criminal Law (Amendment) Act 2013 amends Indian Penal Code',
      },
      {
        value: 'repeals', label: 'Repeals', signal: 'negative', class: 'chip-negative',
        hint: 'Formally abolished',
        description: 'The source legislation formally repeals the target statute — it ceases to have legal force.',
        guidance: 'Use when a statute is explicitly repealed by legislative action.',
        example: 'The Repealing and Amending Act 2016 repealed several obsolete statutes',
      },
      {
        value: 'subordinate_to', label: 'Subordinate To', signal: 'neutral', class: 'chip-legislative',
        hint: 'Delegated legislation under parent Act',
        description: 'The source is subordinate/delegated legislation made under the authority of the target parent Act.',
        guidance: 'Use for rules, regulations, and notifications issued under a parent statute.',
        example: 'Companies (Share Capital) Rules are subordinate to the Companies Act 2013',
      },
      {
        value: 'overrides', label: 'Overrides', signal: 'negative', class: 'chip-negative',
        hint: 'Takes precedence over conflicting provisions',
        description: 'The source legislation overrides conflicting provisions in the target through a non-obstante clause.',
        guidance: 'Use when a statute contains "notwithstanding anything contained in" language overriding another.',
        example: 'SARFAESI Act overrides conflicting provisions of the Limitation Act',
      },
    ],
  },
  {
    family: 'Conceptual',
    color: '#3b82f6',
    narrative: 'How legal ideas, doctrines, and principles relate to and build upon each other.',
    types: [
      {
        value: 'interprets', label: 'Interprets', signal: 'positive', class: 'chip-conceptual',
        hint: 'Provides authoritative meaning',
        description: 'The source provides authoritative judicial interpretation of the target provision or concept.',
        guidance: 'Use when a judgment gives definitive meaning to a statutory provision or constitutional article.',
        example: 'Maneka Gandhi interprets Article 21 to include procedural fairness',
      },
      {
        value: 'establishes', label: 'Establishes', signal: 'positive', class: 'chip-conceptual',
        hint: 'Creates new legal doctrine',
        description: 'The source establishes a new legal doctrine, test, or principle derived from the target.',
        guidance: 'Use when a judgment creates a new legal standard or doctrinal framework.',
        example: 'Kesavananda Bharati establishes the Basic Structure Doctrine from constitutional interpretation',
      },
      {
        value: 'codifies', label: 'Codifies', signal: 'positive', class: 'chip-conceptual',
        hint: 'Judge-made law enacted as statute',
        description: 'The source statute codifies a principle previously established through judicial precedent.',
        guidance: 'Use when legislation formally enacts what was previously judge-made law.',
        example: 'Consumer Protection Act 2019 codifies various consumer rights established through case law',
      },
      {
        value: 'prerequisite', label: 'Prerequisite', signal: 'neutral', class: 'chip-conceptual',
        hint: 'Foundational knowledge required',
        description: 'Understanding the target is a prerequisite for properly comprehending the source.',
        guidance: 'Use for pedagogical relationships — what must be understood first.',
        example: 'Understanding Article 14 is prerequisite to understanding reasonable classification doctrine',
      },
      {
        value: 'distinguish_from', label: 'Distinguish From', signal: 'neutral', class: 'chip-conceptual',
        hint: 'Conceptually related but different',
        description: 'The source and target are conceptually related but must be carefully distinguished.',
        guidance: 'Use when two concepts are commonly confused or conflated but are legally distinct.',
        example: 'Ratio decidendi must be distinguished from obiter dicta',
      },
      {
        value: 'related_to', label: 'Related To', signal: 'neutral', class: 'chip-conceptual',
        hint: 'Thematically connected',
        description: 'The source and target share thematic or subject-matter connections.',
        guidance: 'Use as a general relationship when more specific types do not apply.',
        example: 'Right to Privacy is related to Right to Life under Article 21',
      },
      {
        value: 'exception_to', label: 'Exception To', signal: 'cautionary', class: 'chip-neutral',
        hint: 'Carve-out from general rule',
        description: 'The source represents an exception or carve-out from the general rule established by the target.',
        guidance: 'Use when a provision creates an exception to a broader legal principle.',
        example: 'Section 80 CPC (notice requirement) is exception to general right to sue the government',
      },
      {
        value: 'governed_by', label: 'Governed By', signal: 'neutral', class: 'chip-conceptual',
        hint: 'Primary governing legislation',
        description: 'The source concept or subject area is primarily governed by the target statute.',
        guidance: 'Use to link a legal topic to its primary governing legislation.',
        example: 'Contract formation in India is governed by the Indian Contract Act 1872',
      },
      {
        value: 'analogous_to', label: 'Analogous To', signal: 'neutral', class: 'chip-conceptual',
        hint: 'Similar legal purpose or function',
        description: 'The source and target serve analogous legal purposes or operate on similar principles.',
        guidance: 'Use for comparative relationships — especially across jurisdictions or legal systems.',
        example: 'Article 21 is analogous to the Due Process Clause of the US 14th Amendment',
      },
    ],
  },
  {
    family: 'Structural',
    color: '#64748b',
    narrative: 'Hierarchical and organizational relationships within the knowledge structure.',
    types: [
      {
        value: 'part_of', label: 'Part Of', signal: 'neutral', class: 'chip-structural',
        hint: 'Component of larger structure',
        description: 'The source is a constituent part of the target within a hierarchical structure.',
        guidance: 'Use for chapters within statutes, sections within chapters, etc.',
        example: 'Section 302 IPC is part of Chapter XVI (Offences Affecting the Human Body)',
      },
      {
        value: 'grouped_with', label: 'Grouped With', signal: 'neutral', class: 'chip-structural',
        hint: 'Contextually grouped together',
        description: 'The source and target are contextually grouped together — often studied or applied together.',
        guidance: 'Use when topics are naturally grouped in scholarly or practical contexts.',
        example: 'Articles 14, 19, and 21 are grouped together as the "Golden Triangle" of fundamental rights',
      },
    ],
  },
];


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
      id, relationship_type, description, signal, created_at, created_by,
      nodes!cross_references_target_node_id_fkey ( slug, title, node_type )
    `)
    .eq('source_node_id', node.id)
    .order('relationship_type');

  // Fetch INCOMING edges
  const { data: incoming } = await supabase
    .from('cross_references')
    .select(`
      id, relationship_type, description, signal, created_at, created_by,
      nodes!cross_references_source_node_id_fkey ( slug, title, node_type )
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
    .select('slug, title')
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
                                href={`/topic/${edge.nodes?.slug}`}
                                className="edge-target-link"
                              >
                                {edge.nodes?.title}
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

          <form action={addEdge} className="composition-form">
            <input type="hidden" name="source_node_id" value={node.id} />
            <input type="hidden" name="slug" value={slug} />

            {/* 1. Target Authority */}
            <div className="comp-field">
              <label className="comp-label">1. Related Legal Authority</label>
              <input
                type="text"
                name="target_slug"
                required
                placeholder="Search by title or slug — e.g. article-21, kesavananda-bharati..."
                list="node-autocomplete"
                className="comp-input"
              />
              <datalist id="node-autocomplete">
                {(allNodes ?? []).map(n => (
                  <option key={n.slug} value={n.slug}>{n.title}</option>
                ))}
              </datalist>
            </div>

            {/* 2. Relationship Type */}
            <div className="comp-field">
              <label className="comp-label">2. Classify Doctrinal Relationship</label>
              <div className="comp-relationship-grid">
                {EDGE_FAMILIES.map(fam => (
                  <details key={fam.family} className="comp-family-section">
                    <summary className="comp-family-summary">
                      <span className="comp-family-dot" style={{ background: fam.color }} />
                      <span className="comp-family-name">{fam.family}</span>
                      <span className="comp-family-count">{fam.types.length} types</span>
                      <span className="comp-family-chevron">›</span>
                    </summary>
                    <div className="comp-family-body">
                      <p className="comp-family-narrative">{fam.narrative}</p>
                      <div className="comp-chips-container">
                        {fam.types.map(t => (
                          <label
                            key={t.value}
                            className="rel-chip"
                            title={`${t.description}\n\nGuidance: ${t.guidance}\n\nExample: ${t.example}`}
                          >
                            <input type="radio" name="relationship_type" value={t.value} required />
                            <div className="chip-content">
                              <span className="chip-main">{t.label}</span>
                              <span className="chip-hint">{t.hint}</span>
                            </div>
                            <div className="chip-guidance">
                              {t.guidance}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>

            {/* 3. Scholarly Interpretation — Soft Mandatory */}
            <div className="comp-field">
              <label className="comp-label">3. Scholarly Interpretation</label>
              <textarea
                name="description"
                placeholder="Explain why this doctrinal relationship exists. What is the legal significance of this connection?"
                className="comp-interpretation"
              />
              <span className="comp-field-hint">
                Relationships supported by scholarly reasoning are more trusted by the community. 
                Describe the doctrinal significance, cite relevant passages, or explain the interpretive basis.
              </span>
            </div>

            <button type="submit" className="comp-submit">
              Propose Doctrinal Relationship
            </button>
          </form>
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
