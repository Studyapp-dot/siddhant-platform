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
  exception_to: '#3b82f6', governed_by: '#3b82f6',
};

const EDGE_LABELS: Record<string, string> = {
  part_of: 'PART OF', grouped_with: 'GROUPED',
  replaces: 'REPLACES', amends: 'AMENDS', repeals: 'REPEALS',
  subordinate_to: 'SUBORDINATE', overrides: 'OVERRIDES',
  followed: 'FOLLOWED', applied: 'APPLIED', approved: 'APPROVED',
  explained: 'EXPLAINED', referred_to: 'REFERRED', distinguished: 'DISTINGUISHED',
  doubted: 'DOUBTED', not_followed: 'NOT FOLLOWED', overruled: 'OVERRULED',
  interprets: 'INTERPRETS', establishes: 'ESTABLISHES', codifies: 'CODIFIES',
  exception_to: 'EXCEPTION', governed_by: 'GOVERNED BY',
};

const DASHED_EDGES = new Set(['repeals', 'overruled', 'doubted', 'not_followed', 'exception_to']);
const GRAPH_VIEW_STORAGE_KEY = 'siddhant_graph_view_nodes';

// Estimated label width in layout-space pixels (title.length * factor + padding)
function estimateLabelWidth(title: string): number {
  return Math.min(title.length * 5.5 + 20, 160);
}

/* ═══════════════════════════════════════════════════════
   LAYOUT ENGINE — Label-aware, degree-scaled Fruchterman-Reingold
   ═══════════════════════════════════════════════════════ */

interface LayoutNode {
  id: string; nodeType: string; name: string; slug: string;
  x: number; y: number; vx: number; vy: number;
  radius: number; labelW: number; degree: number;
}

interface LayoutEdge { source: string; target: string; type: string; }

function computeLayout(
  rawNodes: GraphVisualizerProps['nodes'],
  rawEdges: GraphVisualizerProps['edges'],
): Map<string, { x: number; y: number }> {
  if (rawNodes.length === 0) return new Map();

  const nodeIdSet = new Set(rawNodes.map(n => n.id));
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const N = rawNodes.length;

  // ── Tuning constants — scale gently from small (6) to large (100+) graphs ──
  const ITERATIONS = 320;
  const BASE_REPULSION = 8000;
  const REPULSION = BASE_REPULSION + Math.max(0, N - 10) * 400;
  const ATTRACTION = 0.003;
  const IDEAL_EDGE_LEN = 120 + N * 5;
  const DAMPING = 0.88;
  const MAX_DISP = 50;
  const MIN_DIST = 80;            // label-aware (supplemented by labelW below)
  const DEGREE_SCALE = 0.25;      // extra spacing per connection

  // ── Build edge list + degree map ──
  const degreeMap: Record<string, number> = {};
  const edges: LayoutEdge[] = rawEdges
    .filter(e => nodeIdSet.has(e.source_node_id) && nodeIdSet.has(e.target_node_id))
    .map(e => {
      degreeMap[e.source_node_id] = (degreeMap[e.source_node_id] || 0) + 1;
      degreeMap[e.target_node_id] = (degreeMap[e.target_node_id] || 0) + 1;
      return { source: e.source_node_id, target: e.target_node_id, type: e.relationship_type };
    });

  // ── Deterministic spiral seeding — compact start, grows with N ──
  const spiralScale = 55 + Math.max(0, N - 6) * 8;
  const nodes: LayoutNode[] = rawNodes.map((n, i) => {
    const angle = i * GOLDEN_ANGLE;
    const radius = Math.sqrt(i + 1) * spiralScale;
    const r = NODE_TYPE_SIZES[n.node_type || 'topic'] || 12;
    return {
      id: n.id, nodeType: n.node_type || 'topic', name: n.title, slug: n.slug,
      x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: 0, vy: 0,
      radius: r, labelW: estimateLabelWidth(n.title), degree: degreeMap[n.id] || 0,
    };
  });

  const idx = new Map<string, number>();
  nodes.forEach((n, i) => idx.set(n.id, i));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cool = 1 - (iter / ITERATIONS) * 0.75;
    const t = cool * MAX_DISP;

    // ── Repulsion — label-aware + degree-scaled ──
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const ni = nodes[i], nj = nodes[j];
        let dx = nj.x - ni.x;
        let dy = nj.y - ni.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) { dx = Math.random() * 2 - 1; dy = Math.random() * 2 - 1; d = 1.5; }

        // Effective minimum distance: accounts for node radius + half label widths + degree padding
        const degBonus = (ni.degree + nj.degree) * DEGREE_SCALE * 10;
        const effectiveMin = MIN_DIST + (ni.labelW + nj.labelW) * 0.2 + degBonus;

        const f = (REPULSION / (d * d)) * cool;
        // Gentle push below effectiveMin
        const overlap = d < effectiveMin ? (effectiveMin - d) * 0.25 : 0;
        const fx = (dx / d) * (f + overlap);
        const fy = (dy / d) * (f + overlap);
        ni.vx -= fx; ni.vy -= fy;
        nj.vx += fx; nj.vy += fy;
      }
    }

    // ── Attraction — along edges with ideal length ──
    for (const e of edges) {
      const ai = idx.get(e.source), bi = idx.get(e.target);
      if (ai === undefined || bi === undefined) continue;
      const na = nodes[ai], nb = nodes[bi];
      let dx = nb.x - na.x;
      let dy = nb.y - na.y;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) d = 1;
      // Spring-like: attract toward ideal length, not just closer
      const displacement = d - IDEAL_EDGE_LEN;
      const f = displacement * ATTRACTION * cool;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      na.vx += fx; na.vy += fy;
      nb.vx -= fx; nb.vy -= fy;
    }

    // ── Centering gravity ──
    let cx = 0, cy = 0;
    for (const n of nodes) { cx += n.x; cy += n.y; }
    cx /= N; cy /= N;
    for (const n of nodes) {
      n.vx -= cx * 0.012;
      n.vy -= cy * 0.012;
    }

    // ── Apply velocities with damping + displacement cap ──
    for (const n of nodes) {
      n.vx *= DAMPING; n.vy *= DAMPING;
      const disp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (disp > t) { n.vx = (n.vx / disp) * t; n.vy = (n.vy / disp) * t; }
      n.x += n.vx; n.y += n.vy;
    }
  }

  const result = new Map<string, { x: number; y: number }>();
  for (const n of nodes) result.set(n.id, { x: n.x, y: n.y });
  return result;
}

/* ═══════════════════════════════════════════════════════
   EDGE GEOMETRY — better curve separation
   ═══════════════════════════════════════════════════════ */

function edgePath(
  sx: number, sy: number, tx: number, ty: number,
  srcR: number, tgtR: number, curveDir: number, pairIdx: number
) {
  let dx = tx - sx, dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { path: '', mx: sx, my: sy, ax: '', show: false };

  const ux = dx / dist, uy = dy / dist;
  // Start edge at node border
  const startX = sx + ux * (srcR + 4), startY = sy + uy * (srcR + 4);
  // End edge well outside the node's visual territory (circle + badge above)
  // This ensures the arrowhead never overlaps the badge label
  const arrowStandoff = 18;
  const endX = tx - ux * (tgtR + arrowStandoff), endY = ty - uy * (tgtR + arrowStandoff);

  const nx = -uy, ny = ux;
  // Stronger curve separation for parallel edges
  const baseOffset = dist * 0.15;
  const pairSpread = pairIdx * 18;
  const offset = (baseOffset + pairSpread) * curveDir;
  const cpx = (startX + endX) / 2 + nx * offset;
  const cpy = (startY + endY) / 2 + ny * offset;

  const path = `M${startX},${startY} Q${cpx},${cpy} ${endX},${endY}`;
  const mx = 0.25 * startX + 0.5 * cpx + 0.25 * endX;
  const my = 0.25 * startY + 0.5 * cpy + 0.25 * endY;

  // Arrowhead — tip at path endpoint
  const tdx = endX - cpx, tdy = endY - cpy;
  const td = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
  const tux = tdx / td, tuy = tdy / td;
  const al = 14, aw = 7;
  const bx = endX - tux * al, by = endY - tuy * al;
  const ax = `M${endX},${endY} L${bx - tuy * aw},${by + tux * aw} L${bx + tuy * aw},${by - tux * aw} Z`;

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

  const dragRef = useRef<{
    nodeId: string; startPx: number; startPy: number; origX: number; origY: number; moved: boolean;
  } | null>(null);
  const panRef = useRef<{ active: boolean; startPx: number; startPy: number; origPanX: number; origPanY: number }>({
    active: false, startPx: 0, startPy: 0, origPanX: 0, origPanY: 0,
  });
  const suppressClickRef = useRef(0);

  // Viewport persistence: only auto-fit on initial load or topology changes
  const hasUserInteracted = useRef(false);
  const prevNodeCountRef = useRef(0);
  const shouldAutoFitRef = useRef(true);

  // Active focus node: hovered OR selected
  const focusId = hoveredId || selectedNodeId || null;

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

  // Processed edges with better pair separation
  const graphEdges = useMemo(() => {
    const idSet = new Set(nodes.map(n => n.id));
    const pairCount: Record<string, number> = {};
    return edges
      .filter(e => idSet.has(e.source_node_id) && idSet.has(e.target_node_id))
      .map(e => {
        const pairKey = [e.source_node_id, e.target_node_id].sort().join(':');
        const idx = (pairCount[pairKey] || 0);
        pairCount[pairKey] = idx + 1;
        const curveDir = idx === 0 ? 1 : (idx % 2 === 0 ? 1 : -1);
        return { source: e.source_node_id, target: e.target_node_id, type: e.relationship_type, curveDir, pairIdx: idx };
      });
  }, [nodes, edges]);

  // Compute layout — track topology changes for smart auto-fit
  useEffect(() => {
    if (nodes.length === 0) { setPositions(new Map()); return; }
    const previousNodeCount = prevNodeCountRef.current;
    const isTopologyChange = nodes.length !== previousNodeCount;
    prevNodeCountRef.current = nodes.length;
    const layout = computeLayout(nodes, edges);
    setPositions(layout);
    shouldAutoFitRef.current =
      !hasUserInteracted.current && (previousNodeCount === 0 || isTopologyChange);
  }, [nodes, edges]);

  // Auto-fit — tight framing with padding proportional to content
  const fitToView = useCallback(() => {
    if (positions.size === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    positions.forEach(p => {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    const pad = Math.max(120, Math.min((maxX - minX) * 0.15, 200));
    const gw = maxX - minX + pad * 2;
    const gh = maxY - minY + pad * 2;
    const z = Math.min(dims.w / gw, dims.h / gh, 1.5);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    setZoom(Math.max(0.25, Math.min(z, 1.5)));
    setPan({ x: dims.w / 2 - cx * z, y: dims.h / 2 - cy * z });
  }, [positions, dims]);

  // Only auto-fit when user hasn't interacted (initial load / topology change)
  useEffect(() => {
    if (positions.size > 0 && shouldAutoFitRef.current) {
      fitToView();
      shouldAutoFitRef.current = false;
    }
  }, [positions, fitToView]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(GRAPH_VIEW_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (
        typeof parsed?.zoom === 'number' &&
        typeof parsed?.pan?.x === 'number' &&
        typeof parsed?.pan?.y === 'number'
      ) {
        setZoom(Math.max(0.15, Math.min(parsed.zoom, 3)));
        setPan({ x: parsed.pan.x, y: parsed.pan.y });
        hasUserInteracted.current = true;
        shouldAutoFitRef.current = false;
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!isMounted || !hasUserInteracted.current) return;
    try {
      localStorage.setItem(GRAPH_VIEW_STORAGE_KEY, JSON.stringify({ zoom, pan }));
    } catch {}
  }, [isMounted, zoom, pan]);

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
      const nz = Math.max(0.15, Math.min(prev * factor, 3));
      const ratio = nz / prev;
      setPan(p => ({ x: mx - (mx - p.x) * ratio, y: my - (my - p.y) * ratio }));
      hasUserInteracted.current = true;
      return nz;
    });
  }, []);

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.gv-node')) return;
    panRef.current = { active: true, startPx: e.clientX, startPy: e.clientY, origPanX: pan.x, origPanY: pan.y };
    hasUserInteracted.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragRef.current) {
      const d = dragRef.current;
      const dx = (e.clientX - d.startPx) / zoom;
      const dy = (e.clientY - d.startPy) / zoom;
      if (!d.moved && Math.hypot(e.clientX - d.startPx, e.clientY - d.startPy) > 4) {
        d.moved = true;
        hasUserInteracted.current = true;
      }
      setPositions(prev => {
        const next = new Map(prev);
        next.set(d.nodeId, { x: d.origX + dx, y: d.origY + dy });
        return next;
      });
      return;
    }
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

  // Note: selectedNodeId no longer forces camera movement.
  // The user's viewport position is preserved — clicking a node in the sidebar
  // highlights it visually but doesn't hijack the camera.

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

  // Adaptive rendering: hide edge labels at far zoom
  const showEdgeLabels = zoom > 0.45;

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
      <div className="gv-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>

        {/* Pre-compute edge render data (shared between path and arrow layers) */}
        {(() => {
          const edgeRenderData = graphEdges.map((e, i) => {
            const sp = positions.get(e.source);
            const tp = positions.get(e.target);
            if (!sp || !tp) return null;

            const sr = nodeRadius(nodes.find(n => n.id === e.source)?.node_type || 'topic');
            const tr = nodeRadius(nodes.find(n => n.id === e.target)?.node_type || 'topic');
            const geo = edgePath(sp.x, sp.y, tp.x, tp.y, sr, tr, e.curveDir, e.pairIdx);
            if (!geo.show) return null;

            const color = EDGE_COLORS[e.type] || '#94a3b8';
            const label = EDGE_LABELS[e.type] || e.type.replace(/_/g, ' ').toUpperCase();
            const isRelated = focusId && (e.source === focusId || e.target === focusId);
            const isDimmed = focusId && !isRelated;
            const isDashed = DASHED_EDGES.has(e.type);

            return { key: `${e.source}-${e.target}-${i}`, geo, color, label, isRelated, isDimmed, isDashed };
          }).filter(Boolean) as {
            key: string; geo: ReturnType<typeof edgePath>;
            color: string; label: string; isRelated: boolean | null | string;
            isDimmed: boolean | null | string; isDashed: boolean;
          }[];

          const svgStyle = { overflow: 'visible' as const, position: 'absolute' as const, top: 0, left: 0, width: 1, height: 1, pointerEvents: 'none' as const };

          return (
            <>
              {/* Layer 1: Edge paths + labels — BELOW nodes */}
              <svg className="gv-edge-layer" style={{ ...svgStyle, zIndex: 1 }}>
                {edgeRenderData.map(ed => (
                  <g key={ed.key} className={`gv-edge-group ${ed.isDimmed ? 'dimmed' : ''} ${ed.isRelated ? 'highlighted' : ''}`}>
                    <path
                      d={ed.geo.path}
                      fill="none"
                      stroke={ed.isRelated ? '#b8963e' : ed.color}
                      strokeWidth={ed.isRelated ? 3 : 1.8}
                      strokeOpacity={ed.isDimmed ? 0.04 : 0.6}
                      strokeDasharray={ed.isDashed ? '6 3' : undefined}
                    />
                    {showEdgeLabels && !ed.isDimmed && (
                      <g>
                        <rect x={ed.geo.mx - ed.label.length * 3.2 - 5} y={ed.geo.my - 22} width={ed.label.length * 6.4 + 10} height={16} rx={4} fill="var(--bg-surface, #fff)" stroke={ed.color} strokeWidth={0.8} fillOpacity={0.92} />
                        <text x={ed.geo.mx} y={ed.geo.my - 13.5} textAnchor="middle" dominantBaseline="middle" fill={ed.color} fontSize={7} fontWeight={700} fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.04em">
                          {ed.label}
                        </text>
                      </g>
                    )}
                  </g>
                ))}
              </svg>

              {/* Layer 2: Node divs */}
              {nodes.map((node, i) => {
                const pos = positions.get(node.id);
                if (!pos) return null;

                const type = node.node_type || 'topic';
                const r = nodeRadius(type);
                const color = NODE_TYPE_COLORS[type] || '#718096';
                const badge = NODE_TYPE_BADGES[type] || 'TOPIC';
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredId === node.id;
                const isFocused = focusId === node.id;
                const isNeighbor = focusId ? adjacencyMap[focusId]?.has(node.id) : false;
                const isDimmed = focusId ? (!isFocused && !isNeighbor) : false;

                return (
                  <div
                    key={node.id}
                    className={`gv-node ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${isDimmed ? 'dimmed' : ''}`}
                    style={{
                      transform: `translate(${pos.x}px, ${pos.y}px)`,
                      '--node-color': color,
                      '--node-r': `${r * 2}px`,
                      animationDelay: `${i * 40}ms`,
                      opacity: isDimmed ? 0.04 : undefined,
                      transition: 'opacity 0.2s ease',
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

              {/* Layer 3: Arrowheads — ABOVE all nodes (z:20 beats .gv-node.selected z:11) */}
              <svg className="gv-arrow-layer" style={{ ...svgStyle, zIndex: 20 }}>
                {edgeRenderData.map(ed => (
                  <path
                    key={`arrow-${ed.key}`}
                    d={ed.geo.ax}
                    fill={ed.isRelated ? '#b8963e' : ed.color}
                    fillOpacity={ed.isDimmed ? 0.04 : 0.85}
                  />
                ))}
              </svg>
            </>
          );
        })()}
      </div>

      {/* Zoom Controls */}
      <div className="gv-zoom-controls">
        <button type="button" onClick={() => { setZoom(z => Math.min(z * 1.25, 3)); hasUserInteracted.current = true; }} title="Zoom in" aria-label="Zoom in">+</button>
        <button type="button" onClick={() => { setZoom(z => Math.max(z * 0.8, 0.15)); hasUserInteracted.current = true; }} title="Zoom out" aria-label="Zoom out">−</button>
        <button type="button" onClick={() => { hasUserInteracted.current = false; shouldAutoFitRef.current = true; fitToView(); }} title="Reset view" aria-label="Reset graph view">⊡</button>
      </div>
    </div>
  );
}
