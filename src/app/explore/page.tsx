import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import './explore.css';

type NodeReference = {
  id?: string;
  slug?: string;
  title?: string;
  node_type?: string;
};

type RelationshipReference = {
  relationship_type?: string;
  description?: string | null;
  signal?: string | null;
  source?: NodeReference | NodeReference[] | null;
  nodes?: NodeReference | NodeReference[] | null;
};

function formatDate(date?: string | null) {
  if (!date) return 'Recent';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function FirstExplorationPage() {
  const supabase = await createClient();

  const { data: article21Matches } = await supabase
    .from('nodes')
    .select('id, slug, title, node_type')
    .is('deleted_at', null)
    .ilike('title', '%Article 21%')
    .limit(1);

  const featuredNode = article21Matches?.[0] || null;

  const recentQuery = supabase
    .from('recent_changes_view')
    .select('*')
    .eq('activity_type', 'revision')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: recentChanges } = await recentQuery;
  const recentDevelopment = recentChanges?.[0] || null;

  let relationship: RelationshipReference | null = null;
  if (featuredNode?.id) {
    const { data: featuredEdges } = await supabase
      .from('cross_references')
      .select(`
        relationship_type, description, signal,
        nodes!cross_references_target_node_id_fkey ( slug, title, node_type )
      `)
      .eq('source_node_id', featuredNode.id)
      .limit(1);
    relationship = (featuredEdges?.[0] as RelationshipReference | undefined) || null;
  }

  if (!relationship) {
    const { data: anyEdges } = await supabase
      .from('cross_references')
      .select(`
        relationship_type, description, signal,
        source:nodes!cross_references_source_node_id_fkey ( slug, title, node_type ),
        nodes!cross_references_target_node_id_fkey ( slug, title, node_type )
      `)
      .limit(1);
    relationship = (anyEdges?.[0] as RelationshipReference | undefined) || null;
  }

  const featuredHref = featuredNode ? `/topic/${featuredNode.slug}` : '/nodes';
  const recentHref = recentDevelopment?.node_slug
    ? `/topic/${recentDevelopment.node_slug}/compare?rev=${recentDevelopment.activity_id}`
    : '/recent-changes';
  const relationshipTarget = Array.isArray(relationship?.nodes)
    ? relationship.nodes[0]
    : relationship?.nodes;
  const relationshipSource = Array.isArray(relationship?.source)
    ? relationship.source[0]
    : relationship?.source;
  const relationshipBase = relationshipSource?.slug || featuredNode?.slug;
  const relationshipHref = relationshipBase ? `/topic/${relationshipBase}/edges` : '/nodes';

  return (
    <div className="first-exploration">
      <section className="first-exploration-hero">
        <div className="first-exploration-kicker">Curated First Exploration</div>
        <h1>Begin Exploring Jurisprudence</h1>
        <p>
          A finite reading room for entering Siddhant&apos;s archive: start with one
          constitutional pathway, then trace one development and one relationship
          without being pushed into a feed.
        </p>
      </section>

      <section className="reading-room" aria-label="Guided jurisprudential exploration">
        <article className="constitutional-path">
          <div className="path-index">01</div>
          <div>
            <span className="exploration-label">Featured Constitutional Path</span>
            <h2>{featuredNode?.title || 'Article 21 Evolution'}</h2>
            <p className="path-thesis">
              Trace how personal liberty moves from textual guarantee to living
              constitutional doctrine through interpretation, precedent, and revision history.
            </p>
            <div className="path-stages" aria-label="Suggested reading sequence">
              <span>Text</span>
              <span>Interpretation</span>
              <span>Revision</span>
              <span>Relationship</span>
            </div>
            <div className="exploration-actions primary-actions">
              <Link href={featuredHref}>Open the path</Link>
              {featuredNode && <Link href={`/topic/${featuredNode.slug}/history`}>View evolution</Link>}
            </div>
          </div>
        </article>

        <aside className="editorial-traces" aria-label="Editorial traces">
          <article className="trace-panel">
            <span className="exploration-label">Recent Scholarly Development</span>
            <h2>{recentDevelopment?.node_title || 'Scholarly Chronicle'}</h2>
            <p>
              {recentDevelopment?.action_summary
                ? recentDevelopment.action_summary.replace(/^committed edit: /, '')
                : "Review the latest meaningful changes in Siddhant's living record of legal knowledge."}
            </p>
            <div className="exploration-meta">{formatDate(recentDevelopment?.created_at)}</div>
            <Link href={recentHref} className="text-link">Inspect the development</Link>
          </article>

          <article className="trace-panel">
            <span className="exploration-label">Suggested Exploration</span>
            <h2>
              {relationshipTarget?.title
                ? `Follow the relationship to ${relationshipTarget.title}`
                : 'Follow a doctrinal relationship'}
            </h2>
            <p>
              {relationship?.description ||
                'Move through legal meaning by relationship: interpretation, lineage, treatment, and doctrine.'}
            </p>
            <div className="exploration-meta">
              {relationship?.relationship_type?.replace(/_/g, ' ') || 'Doctrinal pathway'}
            </div>
            <Link href={relationshipHref} className="text-link">Explore related jurisprudence</Link>
          </article>
        </aside>
      </section>

      <section className="participation-invitation" aria-labelledby="participation-title">
        <div>
          <span className="exploration-label">First Contribution Path</span>
          <h2 id="participation-title">Participate after reading</h2>
          <p>
            Contribution begins as jurisprudential care: improve a topic, review an
            interpretive trace, or map one relationship with a reasoned explanation.
          </p>
        </div>
        <div className="participation-links">
          <Link href="/topic/new">Improve a topic</Link>
          <Link href="/recognition">Review contribution traces</Link>
        </div>
      </section>
    </div>
  );
}
