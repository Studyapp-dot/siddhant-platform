'use client';

import React, { useState, useEffect } from 'react';
import { addEdge } from './actions';
import { EDGE_FAMILIES } from './edgeTypes';
import { getNodeSections } from '@/app/actions/article-sections';
import type { ArticleSection } from '@/app/actions/article-sections';

interface NodeOption {
  id: string;
  slug: string;
  title: string;
}

interface EdgeFormProps {
  sourceNodeId: string;
  sourceSlug: string;
  allNodes: NodeOption[];
}

export default function EdgeForm({ sourceNodeId, sourceSlug, allNodes }: EdgeFormProps) {
  const [targetSlug, setTargetSlug] = useState('');
  const [sections, setSections] = useState<ArticleSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  useEffect(() => {
    const selectedNode = allNodes.find(n => n.slug === targetSlug);
    if (selectedNode) {
      setLoadingSections(true);
      getNodeSections(selectedNode.id)
        .then(data => setSections(data))
        .catch(err => console.error(err))
        .finally(() => setLoadingSections(false));
    } else {
      setSections([]);
    }
  }, [targetSlug, allNodes]);

  return (
    <form action={addEdge} className="composition-form">
      <input type="hidden" name="source_node_id" value={sourceNodeId} />
      <input type="hidden" name="slug" value={sourceSlug} />

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
          value={targetSlug}
          onChange={(e) => setTargetSlug(e.target.value)}
        />
        <datalist id="node-autocomplete">
          {(allNodes ?? []).map(n => (
            <option key={n.slug} value={n.slug}>{n.title}</option>
          ))}
        </datalist>
      </div>

      {/* Optional: Target Section */}
      {targetSlug && (
        <div className="comp-field" style={{ marginTop: '12px', animation: 'fadeIn 0.3s ease-in' }}>
          <label className="comp-label">
            Target Section <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>(Optional precision)</span>
          </label>
          {loadingSections ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading structural hierarchy...</div>
          ) : sections.length > 0 ? (
            <select name="target_section_id" className="comp-input" style={{ appearance: 'auto', background: 'rgba(0,0,0,0.2)' }}>
              <option value="">-- Connect to entire authority --</option>
              {sections.map(sec => {
                const indent = '—'.repeat(Math.max(0, sec.level - 1));
                return (
                  <option key={sec.id} value={sec.id}>
                    {indent} {sec.title}
                  </option>
                );
              })}
            </select>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              This authority has no mapped internal structure. The edge will connect to the entire node.
            </div>
          )}
        </div>
      )}

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
  );
}
