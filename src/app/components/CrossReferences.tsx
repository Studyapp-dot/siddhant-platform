import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';

interface CrossReferencesProps {
  nodeId: string;
}

// All 20 types organized by display family
const EDGE_FAMILIES: Record<string, {
  label: string;
  color: string;
  types: Record<string, { label: string; icon: string }>;
}> = {
  structural: {
    label: 'Structure',
    color: '#64748b',
    types: {
      part_of:      { label: 'Part Of',       icon: '📁' },
    },
  },
  legislative: {
    label: 'Legislative Lineage',
    color: '#8b5cf6',
    types: {
      replaces:       { label: 'Replaces',        icon: '🔄' },
      amends:         { label: 'Amends',           icon: '✏️' },
      repeals:        { label: 'Repeals',          icon: '🚫' },
      subordinate_to: { label: 'Subordinate To',   icon: '📋' },
      overrides:      { label: 'Overrides',        icon: '⬆️' },
    },
  },
  judicial: {
    label: 'Judicial Treatment',
    color: '#f59e0b',
    types: {
      followed:      { label: 'Followed',       icon: '✅' },
      applied:       { label: 'Applied',        icon: '✅' },
      approved:      { label: 'Approved',       icon: '✅' },
      explained:     { label: 'Explained',      icon: '🟡' },
      referred_to:   { label: 'Referred To',    icon: '🟡' },
      distinguished: { label: 'Distinguished',  icon: '🟡' },
      doubted:       { label: 'Doubted',        icon: '🔴' },
      not_followed:  { label: 'Not Followed',   icon: '🔴' },
      overruled:     { label: 'Overruled',      icon: '🔴' },
    },
  },
  conceptual: {
    label: 'Conceptual',
    color: '#3b82f6',
    types: {
      interprets:      { label: 'Interprets',       icon: '🔍' },
      establishes:     { label: 'Establishes',      icon: '⭐' },
      codifies:        { label: 'Codifies',         icon: '📝' },
      exception_to:    { label: 'Exception To',     icon: '🛡' },
      governed_by:     { label: 'Governed By',      icon: '📜' },
    },
  },
};

// Flatten for lookup
function getEdgeMeta(type: string): { label: string; icon: string; familyColor: string; familyLabel: string } {
  for (const [, family] of Object.entries(EDGE_FAMILIES)) {
    if (family.types[type]) {
      return { ...family.types[type], familyColor: family.color, familyLabel: family.label };
    }
  }
  return { label: type, icon: '🔗', familyColor: '#64748b', familyLabel: 'Other' };
}

export default async function CrossReferences({ nodeId }: CrossReferencesProps) {
  const supabase = await createClient();

  const { data: refs } = await supabase
    .from('cross_references')
    .select(`
      relationship_type, description, signal,
      target_node_id,
      nodes!cross_references_target_node_id_fkey ( slug, title )
    `)
    .eq('source_node_id', nodeId);

  if (!refs || refs.length === 0) {
    return null;
  }

  // Group by family
  const familyGroups: Record<string, Array<{
    type: string;
    slug: string;
    title: string;
    description?: string;
    signal?: string;
    meta: ReturnType<typeof getEdgeMeta>;
  }>> = {};

  for (const ref of refs) {
    const meta = getEdgeMeta(ref.relationship_type);
    const familyKey = meta.familyLabel;
    if (!familyGroups[familyKey]) familyGroups[familyKey] = [];
    const node = ref.nodes as any;
    if (node?.slug && node?.title) {
      familyGroups[familyKey].push({
        type: ref.relationship_type,
        slug: node.slug,
        title: node.title,
        description: ref.description ?? undefined,
        signal: ref.signal ?? undefined,
        meta,
      });
    }
  }

  return (
    <div className="cross-refs-section">
      <h3 className="cross-refs-heading">Related Jurisprudential Movement</h3>
      <p className="cross-refs-intro">
        This authority continues through mapped claims of lineage, treatment, and interpretation.
      </p>
      <div className="cross-refs-families">
        {Object.entries(familyGroups).map(([familyLabel, items]) => (
          <div key={familyLabel} className="cross-ref-family">
            <div className="cross-ref-family-header">
              <span
                className="cross-ref-family-dot"
                style={{ background: items[0]?.meta.familyColor }}
              />
              <span className="cross-ref-family-label">{familyLabel}</span>
            </div>
            <div className="cross-ref-items">
              {items.map((item, i) => (
                <Link
                  key={`${item.slug}-${item.type}-${i}`}
                  href={`/topic/${item.slug}`}
                  className="cross-ref-card"
                  title={item.description || undefined}
                >
                  <span className="cross-ref-icon">{item.meta.icon}</span>
                  <div className="cross-ref-info">
                    <span className="cross-ref-type" style={{ color: item.meta.familyColor }}>
                      {item.meta.label}
                    </span>
                    <span className="cross-ref-title">{item.title}</span>
                    {item.description && (
                      <span className="cross-ref-desc">{item.description}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .cross-refs-section {
          margin-top: 24px;
          padding: 24px;
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-surface);
        }
        .cross-refs-heading {
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 8px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .cross-refs-intro {
          margin: 0 0 20px;
          max-width: 640px;
          font-family: var(--font-serif);
          font-size: 0.94rem;
          line-height: 1.6;
          color: var(--text-secondary);
        }
        .cross-refs-families {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .cross-ref-family {}
        .cross-ref-family-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .cross-ref-family-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .cross-ref-family-label {
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary);
        }
        .cross-ref-items {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cross-ref-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 8px;
          background: var(--bg-panel);
          border: 1px solid var(--border-subtle);
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .cross-ref-card:hover {
          background: var(--color-gold-soft);
          border-color: var(--color-gold);
        }
        .cross-ref-icon {
          font-size: 1rem;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .cross-ref-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .cross-ref-type {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .cross-ref-title {
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .cross-ref-desc {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-style: italic;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
