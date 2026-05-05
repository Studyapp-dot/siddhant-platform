'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════ */

interface GraphVisualizerProps {
  nodes: { id: string; slug: string; title: string; node_type?: string }[];
  edges: { source_node_id: string; target_node_id: string; relationship_type: string }[];
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  statute: '#b8963e', chapter: '#7c6b3a', section: '#2b6cb0',
  constitutional_provision: '#1a365d', judgment: '#c05621',
  doctrine: '#276749', concept: '#6b46c1', topic: '#718096',
};

const NODE_TYPE_SIZES: Record<string, number> = {
  constitutional_provision: 22, statute: 20, judgment: 19,
  chapter: 16, doctrine: 15, section: 14, concept: 13, topic: 12,
};

const NODE_TYPE_BADGES: Record<string, string> = {
  constitutional_provision: 'CONST.', statute: 'STATUTE', judgment: 'JUDGMENT',
  chapter: 'CHAPTER', doctrine: 'DOCTRINE', section: 'SECTION',
  concept: 'CONCEPT', topic: 'TOPIC',
};

const EDGE_COLORS: Record<string, string> = {
  part_of: '#64748b', grouped_with: '#64748b',
  replaces: '#8b5cf6', amends: '#8b5cf6', repeals: '#8b5cf6',
  subordinate_to: '#8b5cf6', overrides: '#8b5cf6',
  followed: '#34d399', applied: '#34d399', approved: '#34d399',
  explained: '#fbbf24', referred_to: '#fbbf24', distinguished: '#fbbf24',
  doubted: '#f87171', not_followed: '#f87171', overruled: '#f87171',
  interprets: '#3b82f6', establishes: '#3b82f6', codifies: '#3b82f6',
  prerequisite: '#3b82f6', distinguish_from: '#3b82f6', related_to: '#3b82f6',
  exception_to: '#3b82f6', governed_by: '#3b82f6', analogous_to: '#3b82f6',
};

const EDGE_LABELS: Record<string, string> = {
  part_of: 'PART OF', grouped_with: 'GROUPED',
  replaces: 'REPLACES', amends: 'AMENDS', repeals: 'REPEALS',
  subordinate_to: 'SUBORDINATE', overrides: 'OVERRIDES',
  followed: 'FOLLOWED', applied: 'APPLIED', approved: 'APPROVED',
  explained: 'EXPLAINED', referred_to: 'REFERRED', distinguished: 'DISTINGUISHED',
  doubted: 'DOUBTED', not_followed: 'NOT FOLLOWED', overruled: 'OVERRULED',
  interprets: 'INTERPRETS', establishes: 'ESTABLISHES', codifies: 'CODIFIES',
  prerequisite: 'PREREQUISITE', distinguish_from: 'DISTINGUISH', related_to: 'RELATED',
  exception_to: 'EXCEPTION', governed_by: 'GOVERNED BY', analogous_to: 'ANALOGOUS',
};

// Very gentle Y-bias hints — easily overridden by actual connections
const TYPE_Y_HINT: Record<string, number> = {
  constitutional_provision: -0.35, statute: -0.18, judgment: 0,
  doctrine: 0.08, chapter: 0.12, section: 0.18, concept: 0.28, topic: 0.32,
};

/* ═══════════════════════════════════════════════════════
   LAYOUT ENGINE — Fruchterman-Reingold to convergence
   Topology-faithful: positions from actual edges, not hierarchy
   ═══════════════════════════════════════════════════════ */

interface LayoutNode {
  id: string; nodeType: string; name: string; slug: string;
  x: number; y: number; vx: number; vy: number;
}

interface LayoutEdge { source: string; target: string; type: string; }

function computeLayout(
  rawNodes: GraphVisualizerProps['nodes'],
  rawEdges: GraphVisualizerProps['edges'],
): Map<string, { x: number; y: number }> {
  if (rawNodes.length === 0) return new Map();

  const nodeIdSet = new Set(rawNodes.map(n => n.id));
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const ITERATIONS = 280;
  const REPULSION = 6500;
  const ATTRACTION = 0.004;
  const DAMPING = 0.9;
  const MAX_DISP = 45;
  const BIAS_STR = 0.018;

  // Deterministic spiral seeding
  const nodes: LayoutNode[] = rawNodes.map((n, i) => {
    const angle = i * GOLDEN_ANGLE;
    const radius = Math.sqrt(i + 1) * 55;
    return {
      id: n.id, nodeType: n.node_type || 'topic', name: n.title, slug: n.slug,
      x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: 0, vy: 0,
    };
  });

  const edges: LayoutEdge[] = rawEdges
    .filter(e => nodeIdSet.has(e.source_node_id) && nodeIdSet.has(e.target_node_id))
    .map(e => ({ source: e.source_node_id, target: e.target_node_id, type: e.relationship_type }));

  const idx = new Map<string, number>();
  nodes.forEach((n, i) => idx.set(n.id, i));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cool = 1 - (iter / ITERATIONS) * 0.7;

    // Repulsion — all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.5) { dx = 0.5; dy = 0.5; d = Math.SQRT2 * 0.5; }
        const f = (REPULSION / (d * d)) * cool;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        nodes[i].vx -= fx; nodes[i].vy -= fy;
        nodes[j].vx += fx; nodes[j].vy += fy;
      }
    }

    // Attraction — along edges
    for (const e of edges) {
      const ai = idx.get(e.source); const bi = idx.get(e.target);
      if (ai === undefined || bi === undefined) continue;
      let dx = nodes[bi].x - nodes[ai].x;
      let dy = nodes[bi].y - nodes[ai].y;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.5) d = 0.5;
      const f = d * ATTRACTION * cool;
      const fx = (dx / d) * f; const fy = (dy / d) * f;
      nodes[ai].vx += fx; nodes[ai].vy += fy;
      nodes[bi].vx -= fx; nodes[bi].vy -= fy;
    }

    // Soft type Y-bias (~2% strength, topology easily overrides)
    const area = Math.max(400, nodes.length * 80);
    for (const n of nodes) {
      const hint = TYPE_Y_HINT[n.nodeType] ?? 0;
      n.vy += (hint * area - n.y) * BIAS_STR * cool;
    }

    // Centering
    let cx = 0, cy = 0;
    for (const n of nodes) { cx += n.x; cy += n.y; }
    cx /= nodes.length; cy /= nodes.length;
    for (const n of nodes) { n.vx -= cx * 0.008; n.vy -= cy * 0.008; }

    // Apply with damping
    for (const n of nodes) {
      n.vx *= DAMPING; n.vy *= DAMPING;
      const disp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (disp > MAX_DISP) { n.vx = (n.vx / disp) * MAX_DISP; n.vy = (n.vy / disp) * MAX_DISP; }
      n.x += n.vx; n.y += n.vy;
    }
  }

  const result = new Map<string, { x: number; y: number }>();
  for (const n of nodes) result.set(n.id, { x: n.x, y: n.y });
  return result;
}

/* ═══════════════════════════════════════════════════════
   EDGE GEOMETRY
   ═══════════════════════════════════════════════════════ */

function edgePath(
  sx: number, sy: number, tx: number, ty: number, srcR: number, tgtR: number, curveDir: number
) {
  let dx = tx - sx, dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { path: '', mx: sx, my: sy, ax: '', show: false };

  const ux = dx / dist, uy = dy / dist;
  const startX = sx + ux * srcR, startY = sy + uy * srcR;
  const endX = tx - ux * (tgtR + 8), endY = ty - uy * (tgtR + 8);

  const nx = -uy, ny = ux;
  const offset = dist * 0.12 * curveDir;
  const cpx = (startX + endX) / 2 + nx * offset;
  const cpy = (startY + endY) / 2 + ny * offset;

  const path = `M${startX},${startY} Q${cpx},${cpy} ${endX},${endY}`;
  const mx = 0.25 * startX + 0.5 * cpx + 0.25 * endX;
  const my = 0.25 * startY + 0.5 * cpy + 0.25 * endY;

  // Arrowhead
  const atx = tx - ux * tgtR, aty = ty - uy * tgtR;
  const tdx = endX - cpx, tdy = endY - cpy;
  const td = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
  const tux = tdx / td, tuy = tdy / td;
  const al = 9, aw = 4.5;
  const bx = atx - tux * al, by = aty - tuy * al;
  const ax = `M${atx},${aty} L${bx - tuy * aw},${by + tux * aw} L${bx + tuy * aw},${by - tux * aw} Z`;

  return { path, mx, my, ax, show: true };
}

/* ═══════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function GraphVisualizer({ nodes, edges, selectedNodeId, onSelectNode }: GraphVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Drag state in refs for performance
  const dragRef = useRef<{
    nodeId: string; startPx: number; startPy: number; origX: number; origY: number; moved: boolean;
  } | null>(null);
  const panRef = useRef<{ active: boolean; startPx: number; startPy: number; origPanX: number; origPanY: number }>({
    active: false, startPx: 0, startPy: 0, origPanX: 0, origPanY: 0,
  });
  const suppressClickRef = useRef(0);

  // Adjacency map
  const adjacencyMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    const idSet = new Set(nodes.map(n => n.id));
    for (const e of edges) {
      if (!idSet.has(e.source_node_id) || !idSet.has(e.target_node_id)) continue;
      if (!map[e.source_node_id]) map[e.source_node_id] = new Set();
      if (!map[e.target_node_id]) map[e.target_node_id] = new Set();
      map[e.source_node_id].add(e.target_node_id);
      map[e.target_node_id].add(e.source_node_id);
    }
    return map;
  }, [nodes, edges]);

  // Processed edges
  const graphEdges = useMemo(() => {
    const idSet = new Set(nodes.map(n => n.id));
    // Track pair indices for curve direction
    const pairCount: Record<string, number> = {};
    return edges
      .filter(e => idSet.has(e.source_node_id) && idSet.has(e.target_node_id))
      .map(e => {
        const pairKey = [e.source_node_id, e.target_node_id].sort().join(':');
        const idx = (pairCount[pairKey] || 0);
        pairCount[pairKey] = idx + 1;
        const curveDir = idx === 0 ? 1 : (idx % 2 === 0 ? 1 : -1) * (1 + Math.floor(idx / 2) * 0.5);
        return { source: e.source_node_id, target: e.target_node_id, type: e.relationship_type, curveDir };
      });
  }, [nodes, edges]);

  // Compute layout ONCE when data changes
  useEffect(() => {
    if (nodes.length === 0) { setPositions(new Map()); return; }
    const layout = computeLayout(nodes, edges);
    setPositions(layout);
  }, [nodes, edges]);

  // Auto-fit after layout or resize
  const fitToView = useCallback(() => {
    if (positions.size === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    positions.forEach(p => {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    const gw = maxX - minX + 160, gh = maxY - minY + 160;
    const z = Math.min(dims.w / gw, dims.h / gh, 1.8);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    setZoom(Math.max(0.3, Math.min(z, 1.8)));
    setPan({ x: dims.w / 2 - cx * z, y: dims.h / 2 - cy * z });
  }, [positions, dims]);

  useEffect(() => { if (positions.size > 0) fitToView(); }, [positions, dims.w, dims.h]);

  // Measure container
  useEffect(() => {
    setIsMounted(true);
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setDims({ w: r.width, h: r.height });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); };
  }, []);

  // Zoom with wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(prev => {
      const nz = Math.max(0.2, Math.min(prev * factor, 3));
      const ratio = nz / prev;
      setPan(p => ({ x: mx - (mx - p.x) * ratio, y: my - (my - p.y) * ratio }));
      return nz;
    });
  }, []);

  // Pan on background drag
  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.gv-node')) return;
    panRef.current = { active: true, startPx: e.clientX, startPy: e.clientY, origPanX: pan.x, origPanY: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Node drag
    if (dragRef.current) {
      const d = dragRef.current;
      const dx = (e.clientX - d.startPx) / zoom;
      const dy = (e.clientY - d.startPy) / zoom;
      if (!d.moved && Math.hypot(e.clientX - d.startPx, e.clientY - d.startPy) > 4) {
        d.moved = true;
      }
      setPositions(prev => {
        const next = new Map(prev);
        next.set(d.nodeId, { x: d.origX + dx, y: d.origY + dy });
        return next;
      });
      return;
    }
    // Pan
    if (panRef.current.active) {
      const p = panRef.current;
      setPan({ x: p.origPanX + (e.clientX - p.startPx), y: p.origPanY + (e.clientY - p.startPy) });
    }
  }, [zoom]);

  const handlePointerUp = useCallback(() => {
    if (dragRef.current) {
      if (dragRef.current.moved) {
        suppressClickRef.current = Date.now() + 200;
      }
      dragRef.current = null;
    }
    panRef.current.active = false;
  }, []);

  const handleNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    const pos = positions.get(nodeId);
    if (!pos) return;
    dragRef.current = { nodeId, startPx: e.clientX, startPy: e.clientY, origX: pos.x, origY: pos.y, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [positions]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (suppressClickRef.current > Date.now()) return;
    onSelectNode?.(selectedNodeId === nodeId ? null : nodeId);
  }, [onSelectNode, selectedNodeId]);

  const handleBgClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.gv-node')) return;
    if (suppressClickRef.current > Date.now()) return;
    onSelectNode?.(null);
  }, [onSelectNode]);

  // Center on selected node
  useEffect(() => {
    if (!selectedNodeId || !positions.has(selectedNodeId)) return;
    const pos = positions.get(selectedNodeId)!;
    setPan({ x: dims.w / 2 - pos.x * zoom, y: dims.h / 2 - pos.y * zoom });
  }, [selectedNodeId]);

  if (!isMounted) {
    return (
      <div ref={containerRef} className="gv-viewport">
        <div className="gv-loading">
          <div className="gv-loading-dot" />
          <span>Initializing graph…</span>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div ref={containerRef} className="gv-viewport gv-viewport-empty">
        <div className="gv-empty-state">
          <span className="gv-empty-kicker">Knowledge Archive</span>
          <span className="gv-empty-title">No topics have been curated yet.</span>
          <span className="gv-empty-copy">The archive is ready for its first constitutional entries.</span>
        </div>
      </div>
    );
  }

  const nodeRadius = (type: string) => NODE_TYPE_SIZES[type] || 12;

  return (
    <div
      ref={containerRef}
      className="gv-viewport"
      onWheel={handleWheel}
      onPointerDown={handleBgPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleBgClick}
    >
      {/* Transform container */}
      <div className="gv-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {/* SVG Edge Layer */}
        <svg className="gv-edge-layer" style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0, width: 1, height: 1, pointerEvents: 'none' }}>
          {graphEdges.map((e, i) => {
            const sp = positions.get(e.source);
            const tp = positions.get(e.target);
            if (!sp || !tp) return null;

            const sr = nodeRadius(nodes.find(n => n.id === e.source)?.node_type || 'topic');
            const tr = nodeRadius(nodes.find(n => n.id === e.target)?.node_type || 'topic');
            const { path, mx, my, ax, show } = edgePath(sp.x, sp.y, tp.x, tp.y, sr, tr, e.curveDir);
            if (!show) return null;

            const color = EDGE_COLORS[e.type] || '#94a3b8';
            const label = EDGE_LABELS[e.type] || e.type.replace(/_/g, ' ').toUpperCase();
            const isRelated = hoveredId && (e.source === hoveredId || e.target === hoveredId);
            const isDimmed = hoveredId && !isRelated;

            return (
              <g key={`${e.source}-${e.target}-${i}`} className={`gv-edge-group ${isDimmed ? 'dimmed' : ''} ${isRelated ? 'highlighted' : ''}`}>
                <path d={path} fill="none" stroke={isRelated ? '#b8963e' : color} strokeWidth={isRelated ? 2.6 : 1.8} strokeOpacity={isDimmed ? 0.08 : 0.65} />
                <path d={ax} fill={isRelated ? '#b8963e' : color} fillOpacity={isDimmed ? 0.08 : 0.7} />
                {!isDimmed && (
                  <g>
                    <rect x={mx - label.length * 3.2 - 5} y={my - 8} width={label.length * 6.4 + 10} height={16} rx={4} fill="var(--bg-surface, #fff)" stroke={color} strokeWidth={0.8} fillOpacity={0.92} />
                    <text x={mx} y={my + 0.5} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={8} fontWeight={700} fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.04em">
                      {label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Node Layer */}
        {nodes.map((node, i) => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const type = node.node_type || 'topic';
          const r = nodeRadius(type);
          const color = NODE_TYPE_COLORS[type] || '#718096';
          const badge = NODE_TYPE_BADGES[type] || 'TOPIC';
          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredId === node.id;
          const isNeighbor = hoveredId ? adjacencyMap[hoveredId]?.has(node.id) : false;
          const isDimmed = hoveredId ? (!isHovered && !isNeighbor) : false;

          return (
            <div
              key={node.id}
              className={`gv-node ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${isDimmed ? 'dimmed' : ''}`}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                '--node-color': color,
                '--node-r': `${r * 2}px`,
                animationDelay: `${i * 40}ms`,
              } as React.CSSProperties}
              onPointerDown={e => handleNodePointerDown(e, node.id)}
              onPointerEnter={() => setHoveredId(node.id)}
              onPointerLeave={() => setHoveredId(null)}
              onClick={e => { e.stopPropagation(); handleNodeClick(node.id); }}
            >
              <span className="gv-node-badge">{badge}</span>
              <div className="gv-node-circle" style={{ width: r * 2, height: r * 2 }} />
              <span className="gv-node-label">{node.title}</span>
            </div>
          );
        })}
      </div>

      {/* Zoom Controls */}
      <div className="gv-zoom-controls">
        <button onClick={() => setZoom(z => Math.min(z * 1.25, 3))} title="Zoom in">+</button>
        <button onClick={() => setZoom(z => Math.max(z * 0.8, 0.2))} title="Zoom out">−</button>
        <button onClick={fitToView} title="Fit all">⊡</button>
      </div>
    </div>
  );
}
