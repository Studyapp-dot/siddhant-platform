'use client';

import React, { useMemo, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthorityMarker from './AuthorityMarker';
import { renderMarkdown, renderMarkdownParagraphs } from '@/app/utils/markdownRenderer';
import type { AuthorityAnchor } from '@/app/actions/authority-anchors';
import { AUTHORITY_TYPE_META } from '@/app/actions/authority-constants';
import { createClient } from '@/utils/supabase/client';
import './authority-anchors.css';

interface ReportContentProps {
  content: string;
  authorities?: AuthorityAnchor[];
}

interface NodePreview {
  title: string;
  node_type: string;
  excerpt: string | null;
}

// Helper: extract hostname from URL safely
function getHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getSafeHttpUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export default function ReportContent({ content, authorities = [] }: ReportContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  // Authority Popover State
  const [hoveredAnchorId, setHoveredAnchorId] = useState<string | null>(null);
  
  // Node Link Popover State
  const [hoveredNodeSlug, setHoveredNodeSlug] = useState<string | null>(null);
  const [nodePreviews, setNodePreviews] = useState<Record<string, NodePreview>>({});
  
  // Shared Popover Positioning
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Group authorities by paragraph index for fallback rendering
  const authorityByParagraph = useMemo(() => {
    if (authorities.length === 0) return {};
    const map: Record<number, AuthorityAnchor[]> = {};
    for (const anchor of authorities) {
      const idx = anchor.paragraph_index ?? 0;
      if (!map[idx]) map[idx] = [];
      map[idx].push(anchor);
    }
    return map;
  }, [authorities]);

  // Inject authority markers directly into the HTML string before React renders it.
  // This prevents React from overwriting our markers during state updates (like hover).
  const injectAuthorityMarkers = (html: string, anchors: AuthorityAnchor[]) => {
    let processedHtml = html;
    const newlyInjected = new Set<string>();
    
    const anchorsToMatch = anchors.filter(a => a.anchor_text && a.anchor_text.length > 0);
    anchorsToMatch.sort((a, b) => (b.anchor_text?.length || 0) - (a.anchor_text?.length || 0));
    
    for (const anchor of anchorsToMatch) {
      const searchStr = anchor.anchor_text.trim();
      if (!searchStr) continue;
      
      const escapedStr = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(<[^>]+>)|(${escapedStr})`, 'gi');
      
      let matchedInThisParagraph = false;
      
      processedHtml = processedHtml.replace(regex, (match, tag, textMatch) => {
        if (tag) return match;
        if (textMatch && !matchedInThisParagraph) {
          matchedInThisParagraph = true;
          newlyInjected.add(anchor.id);
          const isNavigable = !!(anchor.authority_node_slug || getSafeHttpUrl(anchor.authority_url));
          const navClass = isNavigable ? ' authority-navigable' : '';
          return `<span class="authority-inline-marker${navClass}" data-authority-id="${escapeHtmlAttribute(anchor.id)}" style="position: relative; transition: all 0.2s ease;">${textMatch}<span style="color: #c5a059; font-weight: 800; margin-left: 2px; vertical-align: super; font-size: 0.9em;">°</span></span>`;
        }
        return match;
      });
    }
    
    return { html: processedHtml, injected: newlyInjected };
  };

  // Event Delegation for Inline Hover (Authorities & Node Links)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      const authMarker = target.closest('.authority-inline-marker') as HTMLElement;
      const nodeLink = target.closest('.inline-node-link') as HTMLElement;
      
      if (authMarker) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        const authId = authMarker.dataset.authorityId;
        if (authId) {
          const rect = authMarker.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          setHoveredNodeSlug(null);
          setHoveredAnchorId(authId);
          setPopoverPos({
            top: rect.bottom - containerRect.top + 5,
            left: rect.left - containerRect.left
          });
          authMarker.classList.add('hovered');
        }
      } else if (nodeLink) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        const slug = nodeLink.dataset.nodeSlug;
        if (slug) {
          const rect = nodeLink.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          setHoveredAnchorId(null);
          setHoveredNodeSlug(slug);
          setPopoverPos({
            top: rect.bottom - containerRect.top + 5,
            left: rect.left - containerRect.left
          });
          
          // Fetch preview if we don't have it
          if (!nodePreviews[slug]) {
            const supabase = createClient();
            Promise.resolve(supabase
              .from('nodes')
              .select('title, node_type, metadata')
              .eq('slug', slug)
              .single())
              .then(({ data }) => {
                if (data) {
                  const meta = data.metadata || {};
                  const excerpt = meta.legal_essence || meta.explanation_summary || meta.significance || null;
                  
                  setNodePreviews(prev => ({
                    ...prev,
                    [slug]: {
                      title: data.title,
                      node_type: data.node_type || 'topic',
                      excerpt,
                    }
                  }));
                }
              })
              .catch(console.error);
          }
        }
      } else if (popoverRef.current && popoverRef.current.contains(target as Node)) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const authMarker = target.closest('.authority-inline-marker') as HTMLElement;
      const nodeLink = target.closest('.inline-node-link') as HTMLElement;
      
      if (authMarker) {
        authMarker.classList.remove('hovered');
        hideTimeoutRef.current = setTimeout(() => {
          setHoveredAnchorId(null);
        }, 150);
      } else if (nodeLink) {
        hideTimeoutRef.current = setTimeout(() => {
          setHoveredNodeSlug(null);
        }, 150);
      } else if (popoverRef.current && !popoverRef.current.contains(e.relatedTarget as Node)) {
        hideTimeoutRef.current = setTimeout(() => {
          setHoveredAnchorId(null);
          setHoveredNodeSlug(null);
        }, 150);
      }
    };

    // Click delegation for inline-node-links (SPA navigation) and authority markers
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 1. Inline node links → intercept for SPA navigation
      const nodeLink = target.closest('a.inline-node-link') as HTMLAnchorElement;
      if (nodeLink) {
        e.preventDefault();
        const href = nodeLink.getAttribute('href');
        if (href) router.push(href);
        return;
      }

      // 2. Authority inline markers → navigate to authority target
      const authMarker = target.closest('.authority-inline-marker') as HTMLElement;
      if (authMarker) {
        const authId = authMarker.dataset.authorityId;
        if (authId) {
          const anchor = authorities.find(a => a.id === authId);
          if (anchor?.authority_node_slug) {
            router.push(`/topic/${anchor.authority_node_slug}`);
          } else {
            const safeUrl = getSafeHttpUrl(anchor?.authority_url);
            if (safeUrl) window.open(safeUrl, '_blank', 'noopener,noreferrer');
          }
        }
        return;
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      container.removeEventListener('click', handleClick);
    };
  }, [authorities, nodePreviews, router]);

  // Render Authority Popover
  const renderAuthorityPopover = () => {
    if (!hoveredAnchorId || !popoverPos) return null;
    const anchor = authorities.find(a => a.id === hoveredAnchorId);
    if (!anchor) return null;
    
    const meta = AUTHORITY_TYPE_META[anchor.authority_type];
    const isLinked = !!anchor.authority_node_slug;
    const safeAuthorityUrl = getSafeHttpUrl(anchor.authority_url);
    
    const content = (
      <>
        <span className="authority-popover-item-icon">{meta?.icon || '📎'}</span>
        <div className="authority-popover-item-info">
          <span className="authority-popover-item-title">{anchor.authority_title}</span>
          {anchor.authority_citation && (
            <span className="authority-popover-item-citation">{anchor.authority_citation}</span>
          )}
          <span
            className="authority-popover-item-type"
            style={{ color: meta?.color, background: meta?.bg }}
          >
            {meta?.label}
          </span>
        </div>
      </>
    );

    return (
      <div 
        ref={popoverRef}
        className="authority-popover" 
        style={{ 
          position: 'absolute', 
          top: `${popoverPos.top}px`, 
          left: `${popoverPos.left}px`,
          zIndex: 1000 
        }}
        onMouseEnter={() => {
          if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        }}
        onMouseLeave={() => {
          setHoveredAnchorId(null);
        }}
      >
        <div className="authority-popover-header">
          <span>Authority Grounding</span>
        </div>
        <div className="authority-popover-list">
          {isLinked ? (
            <Link
              href={`/topic/${anchor.authority_node_slug}`}
              className="authority-popover-item"
            >
              {content}
            </Link>
          ) : (
            <div className="authority-popover-item">
              {content}
            </div>
          )}
          {anchor.anchor_text && (
            <div className="authority-popover-anchor-text">
              &ldquo;{anchor.anchor_text.length > 100 
                ? anchor.anchor_text.slice(0, 100) + '…' 
                : anchor.anchor_text
              }&rdquo;
            </div>
          )}
          {/* External source link */}
          {safeAuthorityUrl && (
            <a
              href={safeAuthorityUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="authority-popover-external-link"
              onClick={(e) => e.stopPropagation()}
              title={safeAuthorityUrl}
            >
              <svg className="authority-external-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span className="authority-popover-external-hostname">{getHostname(safeAuthorityUrl)}</span>
              <span className="authority-popover-external-label">Open Source</span>
            </a>
          )}
        </div>
      </div>
    );
  };

  // Render Node Link Popover (Tiny Preview)
  const renderNodePreviewPopover = () => {
    if (!hoveredNodeSlug || !popoverPos) return null;
    const preview = nodePreviews[hoveredNodeSlug];
    
    // We render a smaller, distinct popover to differentiate from Evidence
    return (
      <div 
        ref={popoverRef}
        className="authority-popover node-preview-popover" 
        style={{ 
          position: 'absolute', 
          top: `${popoverPos.top}px`, 
          left: `${popoverPos.left}px`,
          zIndex: 1000,
          minWidth: '220px',
          padding: '8px 12px'
        }}
        onMouseEnter={() => {
          if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        }}
        onMouseLeave={() => {
          setHoveredNodeSlug(null);
        }}
      >
        {!preview ? (
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Loading context...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
              {preview.node_type}
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {preview.title}
            </div>
            {preview.excerpt && (
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4, fontStyle: 'italic' }}>
                {preview.excerpt.length > 90 ? preview.excerpt.slice(0, 90) + '...' : preview.excerpt}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const hasAuthorities = authorities.length > 0;
  
  if (hasAuthorities) {
    const paragraphs = renderMarkdownParagraphs(content);
    
    // We compute the injected HTML and collect all injected IDs
    const processedParagraphs = paragraphs.map(para => {
      const paraAuthorities = authorityByParagraph[para.originalIndex] || [];
      const { html, injected } = injectAuthorityMarkers(para.html, authorities); // We match against all authorities, not just paragraph ones, to be safe.
      return {
        ...para,
        html,
        injected,
        paraAuthorities
      };
    });
    
    const allInjectedIds = new Set<string>();
    processedParagraphs.forEach(p => {
      p.injected.forEach(id => allInjectedIds.add(id));
    });

    return (
      <div className="report-body rendered-markdown" ref={containerRef} style={{ position: 'relative' }}>
        {processedParagraphs.map((para, i) => {
          // Only show fallback marker for authorities that weren't injected inline anywhere
          const unmatchedAuthorities = para.paraAuthorities.filter(a => !allInjectedIds.has(a.id));
          
          return (
            <div key={i} className="report-paragraph-block">
              <div dangerouslySetInnerHTML={{ __html: para.html }} />
              {unmatchedAuthorities.length > 0 && (
                <AuthorityMarker anchors={unmatchedAuthorities} />
              )}
            </div>
          );
        })}
        
        {/* Catch-all for any authorities that didn't get assigned to a rendered paragraph */}
        {(() => {
          const orphanedAuthorities = authorities.filter(
            a => (!allInjectedIds.has(a.id)) && (typeof a.paragraph_index !== 'number' || a.paragraph_index >= paragraphs.length)
          );
          
          if (orphanedAuthorities.length === 0) return null;
          
          return (
            <div className="report-paragraph-block orphaned-authorities" style={{ marginTop: '1rem' }}>
              <AuthorityMarker anchors={orphanedAuthorities} />
            </div>
          );
        })()}
        
        {renderAuthorityPopover()}
        {renderNodePreviewPopover()}
      </div>
    );
  }

  // Fallback if no authorities, but we still need the container ref for Node Links
  const html = renderMarkdown(content);

  return (
    <div className="report-body rendered-markdown" ref={containerRef} style={{ position: 'relative' }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {renderNodePreviewPopover()}
    </div>
  );
}
