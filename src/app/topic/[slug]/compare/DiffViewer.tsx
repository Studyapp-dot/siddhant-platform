'use client';

import React, { useState, useMemo, useCallback, Fragment } from 'react';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  significance?: string | null;
}

type DiffOp = 'equal' | 'insert' | 'delete';
type DiffEntry = [DiffOp, string];

// ===== Region types for paragraph-based grouping =====
interface EqualRegion {
  kind: 'equal';
  text: string;
  paragraphs: string[];
  collapsible: boolean;
}

interface ChangeRegion {
  kind: 'change';
  entries: DiffEntry[];
  changeIndex: number;
}

type Region = EqualRegion | ChangeRegion;

// ===== Legal reference regex (Article, Section, AIR, SCC only) =====
const LEGAL_REF_PATTERN = /\b(Article\s+\d+[A-Z]?(?:\s*\(\d+\))?|Section\s+\d+[A-Z]?|AIR\s+\d{4}\s+\w+\s+\d+|\(\d{4}\)\s*\d+\s*SCC\s*\d+|\d+\s+SCC\s+\d+)/gi;

function highlightLegalRefs(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(LEGAL_REF_PATTERN.source, 'gi');

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span className="legal-ref" key={`${keyPrefix}-${match.index}`}>{match[0]}</span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// ===== Build paragraph-based regions from flat diff entries =====
function buildRegions(diffs: DiffEntry[]): Region[] {
  const regions: Region[] = [];
  let changeIndex = 0;
  let pendingChange: DiffEntry[] = [];

  const flushChange = () => {
    if (pendingChange.length > 0) {
      regions.push({ kind: 'change', entries: [...pendingChange], changeIndex: changeIndex++ });
      pendingChange = [];
    }
  };

  for (const [op, text] of diffs) {
    if (op === 'equal') {
      flushChange();
      const paragraphs = text.split(/\n\n+/).filter(p => p.length > 0);
      regions.push({
        kind: 'equal',
        text,
        paragraphs,
        collapsible: paragraphs.length > 3,
      });
    } else {
      pendingChange.push([op, text]);
    }
  }
  flushChange();

  return regions;
}

/**
 * Scholarly diff viewer with paragraph collapse, legal highlighting, and change navigation.
 * Diff engine unchanged — only the rendering layer is transformed.
 */
export default function DiffViewer({ oldText, newText, significance }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [expandedRegions, setExpandedRegions] = useState<Set<number>>(new Set());
  const [activeChange, setActiveChange] = useState<number>(0);

  const diffs = useMemo(() => computeWordDiff(oldText, newText), [oldText, newText]);
  const regions = useMemo(() => buildRegions(diffs), [diffs]);

  const totalChanges = useMemo(
    () => regions.filter(r => r.kind === 'change').length,
    [regions]
  );

  // Stats
  const additions = useMemo(
    () => diffs.filter(d => d[0] === 'insert').reduce((n, d) => n + d[1].split(/\s+/).filter(Boolean).length, 0),
    [diffs]
  );
  const deletions = useMemo(
    () => diffs.filter(d => d[0] === 'delete').reduce((n, d) => n + d[1].split(/\s+/).filter(Boolean).length, 0),
    [diffs]
  );

  const toggleRegion = useCallback((index: number) => {
    setExpandedRegions(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const scrollToChange = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, totalChanges - 1));
    setActiveChange(clamped);
    const el = document.getElementById(`change-${clamped}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [totalChanges]);

  // ===== Render helpers =====

  // Render an equal region (with collapse support)
  const renderEqualRegion = (region: EqualRegion, regionIndex: number, filterOp?: 'old' | 'new') => {
    if (!region.collapsible || expandedRegions.has(regionIndex)) {
      return <span className="diff-equal" key={`eq-${regionIndex}`}>{highlightLegalRefs(region.text, `eq-${regionIndex}`)}</span>;
    }

    const hiddenCount = region.paragraphs.length - 2;
    const firstPara = region.paragraphs[0];
    const lastPara = region.paragraphs[region.paragraphs.length - 1];

    return (
      <Fragment key={`eq-${regionIndex}`}>
        <span className="diff-equal">{highlightLegalRefs(firstPara, `eq-${regionIndex}-first`)}</span>
        <div className="collapsed-region" onClick={() => toggleRegion(regionIndex)}>
          <span className="collapsed-region-icon">▸</span>
          <span className="collapsed-region-text">
            {hiddenCount} unchanged paragraph{hiddenCount > 1 ? 's' : ''}
          </span>
        </div>
        <span className="diff-equal">{highlightLegalRefs(lastPara, `eq-${regionIndex}-last`)}</span>
      </Fragment>
    );
  };

  // Render a change region (unified)
  const renderChangeRegionUnified = (region: ChangeRegion, regionIndex: number) => (
    <span key={`ch-${regionIndex}`} id={`change-${region.changeIndex}`} className="change-region">
      {region.entries.map(([op, text], j) => (
        <span key={j} className={`diff-word diff-${op}`}>
          {highlightLegalRefs(text, `ch-${regionIndex}-${j}`)}
        </span>
      ))}
    </span>
  );

  // Render a change region for split view (filter to old or new side)
  const renderChangeRegionSplit = (region: ChangeRegion, regionIndex: number, side: 'old' | 'new') => (
    <span key={`ch-${regionIndex}`} id={side === 'old' ? undefined : `change-${region.changeIndex}`} className="change-region">
      {region.entries.map(([op, text], j) => {
        if (side === 'old' && op === 'insert') return null;
        if (side === 'new' && op === 'delete') return null;
        const cls = op === 'equal' ? 'diff-equal'
          : op === 'delete' ? 'diff-delete'
          : 'diff-insert';
        return (
          <span key={j} className={`diff-word ${cls}`}>
            {highlightLegalRefs(text, `ch-${regionIndex}-${j}-${side}`)}
          </span>
        );
      })}
    </span>
  );

  return (
    <div className="diff-container">
      {/* Toolbar */}
      <div className="diff-toolbar">
        <div className="diff-stats">
          <span className="diff-stat-add">+{additions} words</span>
          <span className="diff-stat-del">−{deletions} words</span>
        </div>
        <div className="diff-toolbar-right">
          {/* Change Navigation */}
          {totalChanges > 1 && (
            <div className="change-nav">
              <span className="change-nav-label">{totalChanges} changes</span>
              <button
                className="change-nav-btn"
                onClick={() => scrollToChange(activeChange - 1)}
                title="Previous change"
              >↑</button>
              <button
                className="change-nav-btn"
                onClick={() => scrollToChange(activeChange + 1)}
                title="Next change"
              >↓</button>
            </div>
          )}
          {/* View Toggle */}
          <div className="diff-view-toggle">
            <button
              className={`diff-toggle-btn ${viewMode === 'unified' ? 'active' : ''}`}
              onClick={() => setViewMode('unified')}
            >Unified</button>
            <button
              className={`diff-toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
            >Split</button>
          </div>
        </div>
      </div>

      {/* Diff Content */}
      {viewMode === 'unified' ? (
        <div className="diff-unified">
          {regions.map((region, i) =>
            region.kind === 'equal'
              ? renderEqualRegion(region, i)
              : renderChangeRegionUnified(region, i)
          )}
        </div>
      ) : (
        <div className="diff-split-view">
          <div className="diff-split-pane diff-split-old">
            <div className="diff-split-label">Previous State</div>
            <div className="diff-split-body">
              {regions.map((region, i) =>
                region.kind === 'equal'
                  ? renderEqualRegion(region, i, 'old')
                  : renderChangeRegionSplit(region, i, 'old')
              )}
            </div>
          </div>
          <div className="diff-split-pane diff-split-new">
            <div className="diff-split-label">New Revision</div>
            <div className="diff-split-body">
              {regions.map((region, i) =>
                region.kind === 'equal'
                  ? renderEqualRegion(region, i, 'new')
                  : renderChangeRegionSplit(region, i, 'new')
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════
// DIFF ENGINE — UNCHANGED from original
// ═════════════════════════════════════════════════

/**
 * Word-level diff computation using a simplified LCS approach.
 * Splits text into words (preserving whitespace) and computes minimal edit operations.
 */
function computeWordDiff(oldText: string, newText: string): DiffEntry[] {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  const m = oldWords.length;
  const n = newWords.length;

  // For very large texts, use a simpler approach
  if (m * n > 500000) {
    return simpleDiff(oldWords, newWords);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffEntry[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift(['equal', oldWords[i - 1]]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift(['insert', newWords[j - 1]]);
      j--;
    } else {
      result.unshift(['delete', oldWords[i - 1]]);
      i--;
    }
  }

  return mergeOps(result);
}

/** Tokenize text into words, preserving leading/trailing whitespace as part of each token */
function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) || [];
}

/** Merge consecutive diff operations of the same type for cleaner output */
function mergeOps(ops: DiffEntry[]): DiffEntry[] {
  if (ops.length === 0) return ops;

  const merged: DiffEntry[] = [ops[0]];
  for (let i = 1; i < ops.length; i++) {
    const last = merged[merged.length - 1];
    if (last[0] === ops[i][0]) {
      merged[merged.length - 1] = [last[0], last[1] + ops[i][1]];
    } else {
      merged.push(ops[i]);
    }
  }
  return merged;
}

/** Fallback simple diff for very large texts — paragraph-level comparison */
function simpleDiff(oldWords: string[], newWords: string[]): DiffEntry[] {
  const oldText = oldWords.join('');
  const newText = newWords.join('');

  if (oldText === newText) {
    return [['equal', oldText]];
  }

  let prefix = 0;
  while (prefix < oldText.length && prefix < newText.length && oldText[prefix] === newText[prefix]) {
    prefix++;
  }

  let oldSuffix = oldText.length;
  let newSuffix = newText.length;
  while (oldSuffix > prefix && newSuffix > prefix && oldText[oldSuffix - 1] === newText[newSuffix - 1]) {
    oldSuffix--;
    newSuffix--;
  }

  const result: DiffEntry[] = [];
  if (prefix > 0) result.push(['equal', oldText.slice(0, prefix)]);
  if (oldSuffix > prefix) result.push(['delete', oldText.slice(prefix, oldSuffix)]);
  if (newSuffix > prefix) result.push(['insert', newText.slice(prefix, newSuffix)]);
  if (oldSuffix < oldText.length) result.push(['equal', oldText.slice(oldSuffix)]);

  return result;
}
