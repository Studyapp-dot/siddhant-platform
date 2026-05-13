'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import GraphVisualizer from './GraphVisualizer';

interface Node {
  id: string;
  slug: string;
  title: string;
  created_at: string;
  node_type?: string;
}

interface Edge {
  source_node_id: string;
  target_node_id: string;
  relationship_type: string;
}

interface NodesContainerProps {
  nodes: Node[];
  edges: Edge[];
  revMap: Record<string, any>;
  summaryMap: Record<string, string>;
  isLoggedIn: boolean;
}

const NODE_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  statute:                  { label: 'Statute',     icon: '📜', color: '#b8963e' },
  chapter:                  { label: 'Chapter',     icon: '📖', color: '#7c6b3a' },
  section:                  { label: 'Section',     icon: '§',  color: '#2b6cb0' },
  constitutional_provision: { label: 'Const.',      icon: '🏛', color: '#1a365d' },
  judgment:                 { label: 'Judgment',    icon: '⚖️', color: '#c05621' },
  doctrine:                 { label: 'Doctrine',    icon: '💡', color: '#276749' },
  concept:                  { label: 'Concept',     icon: '🧠', color: '#6b46c1' },
  topic:                    { label: 'Topic',       icon: '📝', color: '#718096' },
};

export default function NodesContainer({ nodes, edges, revMap, summaryMap, isLoggedIn }: NodesContainerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Ref map for sidebar scroll sync
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filtered nodes
  const filteredNodes = useMemo(() => nodes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !typeFilter || (n.node_type || 'topic') === typeFilter;
    return matchesSearch && matchesType;
  }), [nodes, searchQuery, typeFilter]);

  // Selected node object
  const selectedNode = useMemo(() =>
    nodes.find(n => n.id === selectedNodeId) ?? null,
  [nodes, selectedNodeId]);

  const nodeById = useMemo(() => {
    const map: Record<string, Node> = {};
    for (const node of nodes) map[node.id] = node;
    return map;
  }, [nodes]);

  const visibleNodeIds = useMemo(
    () => new Set(filteredNodes.map(node => node.id)),
    [filteredNodes],
  );

  useEffect(() => {
    if (selectedNodeId && !visibleNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, visibleNodeIds]);

  // Type counts for filter chips
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) {
      const t = n.node_type || 'topic';
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [nodes]);

  // Connection count for selected node
  const connectionCount = useMemo(() => {
    if (!selectedNodeId) return 0;
    return edges.filter(e =>
      e.source_node_id === selectedNodeId || e.target_node_id === selectedNodeId
    ).length;
  }, [edges, selectedNodeId]);

  // Outgoing and incoming edges for selected node
  const outgoingEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges.filter(e => e.source_node_id === selectedNodeId);
  }, [edges, selectedNodeId]);

  const incomingEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges.filter(e => e.target_node_id === selectedNodeId);
  }, [edges, selectedNodeId]);

  const visibleEdgeCount = useMemo(() => (
    edges.filter(e => visibleNodeIds.has(e.source_node_id) && visibleNodeIds.has(e.target_node_id)).length
  ), [edges, visibleNodeIds]);

  // Sidebar scroll sync when selection changes
  useEffect(() => {
    if (selectedNodeId && nodeRefs.current[selectedNodeId]) {
      nodeRefs.current[selectedNodeId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedNodeId]);

  // ESC key to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedNodeId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedNodeId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className="nodes-workbench">
      {/* ---- Left Panel: Knowledge Archive ---- */}
      <div className={`knowledge-index-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div>
            <span className="sidebar-title">Knowledge Archive</span>
            <div className="sidebar-counts">
              {nodes.length} topics / {edges.length} relationships
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="sidebar-close" aria-label="Collapse archive panel">&times;</button>
        </div>

        <div className="sidebar-search-container">
          <input
            type="text"
            placeholder="Search titles or slugs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sidebar-search-input"
            aria-label="Search knowledge archive"
          />
        </div>

        <div className="sidebar-filter-container">
          <button
            onClick={() => setTypeFilter(null)}
            className={`filter-chip ${!typeFilter ? 'active' : ''}`}
          >
            All ({nodes.length})
          </button>
          {Object.entries(NODE_TYPE_META)
            .filter(([type]) => typeCounts[type])
            .map(([type, meta]) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
              className={`filter-chip ${typeFilter === type ? 'active' : ''}`}
            >
              {meta.icon} {meta.label} ({typeCounts[type]})
            </button>
          ))}
        </div>

        <div className="sidebar-node-list">
          {filteredNodes.map(node => {
            const nodeType = node.node_type || 'topic';
            const meta = NODE_TYPE_META[nodeType] || NODE_TYPE_META.topic;

            return (
              <div
                key={node.id}
                ref={el => { nodeRefs.current[node.id] = el; }}
                role="button"
                tabIndex={0}
                aria-pressed={selectedNodeId === node.id}
                onClick={() => handleSelectNode(node.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSelectNode(node.id);
                  }
                }}
                className={`sidebar-node-link ${selectedNodeId === node.id ? 'active' : ''}`}
                style={{ opacity: selectedNodeId && selectedNodeId !== node.id ? 0.5 : 1 }}
              >
                <span className="sidebar-node-icon">{meta.icon}</span>
                <div className="sidebar-node-info">
                  <div className="sidebar-node-title">{node.title}</div>
                  <div className="sidebar-node-type">{meta.label}</div>
                </div>
              </div>
            );
          })}
          {filteredNodes.length === 0 && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No matching topics
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          {filteredNodes.length} of {nodes.length} topics
        </div>
      </div>

      {/* ---- Center: Graph Canvas ---- */}
      <main className={`graph-canvas-area ${selectedNodeId ? 'dimmed' : ''}`}>
        <GraphVisualizer
          nodes={filteredNodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNode}
        />

        <div className="graph-context-strip" aria-live="polite">
          <span>{filteredNodes.length} of {nodes.length} topics</span>
          <span>{visibleEdgeCount} visible relationships</span>
          {typeFilter && (
            <button type="button" onClick={() => setTypeFilter(null)}>
              Clear {NODE_TYPE_META[typeFilter]?.label || typeFilter}
            </button>
          )}
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')}>
              Clear search
            </button>
          )}
        </div>

        {/* Empty state overlay — only show if no data present per user request */}
        {nodes.length === 0 && (
          <div className="graph-empty-overlay">
            <div className="graph-empty-text">Awaiting the first curated topic</div>
          </div>
        )}

        {/* Sidebar toggle FAB */}
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="fab-sidebar-toggle" aria-label="Open archive panel">☰</button>
        )}

        {/* New Topic FAB */}
        {isLoggedIn && (
          <Link href="/topic/new" className="fab-new-concept">
            + New Topic
          </Link>
        )}
      </main>

      {/* ---- Right Panel: Node Inspector ---- */}
      {selectedNode && (
        <aside className="node-inspector-panel">
          <button className="inspector-close" onClick={() => setSelectedNodeId(null)} aria-label="Close node inspector">&times;</button>

          <div className="inspector-content">
            {/* Type Badge */}
            <div
              className="inspector-badge"
              style={{
                background: (NODE_TYPE_META[selectedNode.node_type || 'topic']?.color || '#718096') + '12',
                color: NODE_TYPE_META[selectedNode.node_type || 'topic']?.color || '#718096',
              }}
            >
              {NODE_TYPE_META[selectedNode.node_type || 'topic']?.icon}{' '}
              {NODE_TYPE_META[selectedNode.node_type || 'topic']?.label}
            </div>

            {/* Title */}
            <h2 className="inspector-title">{selectedNode.title}</h2>

            {/* Summary */}
            <p className="inspector-summary">
              {summaryMap[selectedNode.id] || 'No summary available yet.'}
            </p>

            {/* Stats */}
            <div className="inspector-stats">
              <div className="stat-pill">
                <span className="stat-label">Network</span>
                <span className="stat-value">{connectionCount} {connectionCount === 1 ? 'related concept' : 'related concepts'}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">Last Updated</span>
                <span className="stat-value">
                  {revMap[selectedNode.id]?.created_at
                    ? new Date(revMap[selectedNode.id].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : '—'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="inspector-actions">
              <Link href={`/topic/${selectedNode.slug}`} className="inspector-btn primary">
                Open Full Analysis →
              </Link>
              <Link href={`/topic/${selectedNode.slug}/edit`} className="inspector-btn secondary">
                Propose Revision
              </Link>
            </div>

            {/* Related Authorities */}
            {(outgoingEdges.length > 0 || incomingEdges.length > 0) && (
              <div>
                <div className="inspector-section-label">Related Authorities</div>
                <div className="inspector-relation-list">
                  {outgoingEdges.map((e, idx) => {
                    const target = nodeById[e.target_node_id];
                    if (!target) return null;
                    return (
                      <button
                        type="button"
                        key={`out-${idx}`}
                        className="relation-item"
                        onClick={() => handleSelectNode(target.id)}
                      >
                        <span className="rel-type">{e.relationship_type.replace(/_/g, ' ')}</span>
                        <span className="rel-arrow">→</span>
                        <span className="rel-target">{target.title}</span>
                      </button>
                    );
                  })}
                  {incomingEdges.map((e, idx) => {
                    const source = nodeById[e.source_node_id];
                    if (!source) return null;
                    return (
                      <button
                        type="button"
                        key={`in-${idx}`}
                        className="relation-item"
                        onClick={() => handleSelectNode(source.id)}
                      >
                        <span className="rel-target">{source.title}</span>
                        <span className="rel-arrow">→</span>
                        <span className="rel-type">{e.relationship_type.replace(/_/g, ' ')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {outgoingEdges.length === 0 && incomingEdges.length === 0 && (
              <div className="inspector-empty-relations">Doctrinal connections will appear as relationships are mapped</div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
