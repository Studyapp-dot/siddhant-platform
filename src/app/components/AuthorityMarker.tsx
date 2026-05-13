'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AUTHORITY_TYPE_META } from '@/app/actions/authority-constants';
import type { AuthorityAnchor } from '@/app/actions/authority-anchors';

// ============================================================================
// AUTHORITY MARKER — Paragraph-grouped indicator
// Shows a subtle ◦ with count. Hover/click reveals authority popover.
// Designed for scalability: groups all authorities per paragraph.
// ============================================================================

// Helper: extract hostname from URL safely
function getHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

interface AuthorityMarkerProps {
  anchors: AuthorityAnchor[];
}

export default function AuthorityMarker({ anchors }: AuthorityMarkerProps) {
  const [showPopover, setShowPopover] = useState(false);
  const markerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        markerRef.current && !markerRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setShowPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  if (anchors.length === 0) return null;

  return (
    <span
      ref={markerRef}
      className="authority-paragraph-indicator"
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => {
        // Delay closing to allow mouse to move to popover
        setTimeout(() => {
          if (!popoverRef.current?.matches(':hover') && !markerRef.current?.matches(':hover')) {
            setShowPopover(false);
          }
        }, 150);
      }}
      onClick={() => setShowPopover(!showPopover)}
    >
      <span className="authority-indicator-dot" />
      {anchors.length > 1 && (
        <span className="authority-indicator-count">{anchors.length}</span>
      )}

      {/* Popover */}
      {showPopover && (
        <div ref={popoverRef} className="authority-popover" onMouseLeave={() => setShowPopover(false)}>
          <div className="authority-popover-header">
            <span>Authorities</span>
            <span style={{ fontWeight: 600 }}>{anchors.length}</span>
          </div>
          <div className="authority-popover-list">
            {anchors.map(anchor => {
              const meta = AUTHORITY_TYPE_META[anchor.authority_type];
              const hasInternalLink = !!anchor.authority_node_slug;
              const hasExternalUrl = !!anchor.authority_url;

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
                    {/* External source URL */}
                    {hasExternalUrl && (
                      <span className="authority-popover-item-source" title={anchor.authority_url!}>
                        <svg className="authority-external-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        <span className="authority-popover-external-hostname">{getHostname(anchor.authority_url!)}</span>
                      </span>
                    )}
                  </div>
                </>
              );

              // Internal link → Next.js Link, external URL → <a target=_blank>, else div
              if (hasInternalLink) {
                return (
                  <Link
                    key={anchor.id}
                    href={`/topic/${anchor.authority_node_slug}`}
                    className="authority-popover-item authority-internal"
                    onClick={() => setShowPopover(false)}
                  >
                    {content}
                  </Link>
                );
              }

              if (hasExternalUrl) {
                return (
                  <a
                    key={anchor.id}
                    href={anchor.authority_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="authority-popover-item authority-external"
                    onClick={() => setShowPopover(false)}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <div key={anchor.id} className="authority-popover-item">
                  {content}
                </div>
              );
            })}

            {/* Show the anchor text snippet */}
            {anchors.length === 1 && anchors[0].anchor_text && (
              <div className="authority-popover-anchor-text">
                &ldquo;{anchors[0].anchor_text.length > 80
                  ? anchors[0].anchor_text.slice(0, 80) + '…'
                  : anchors[0].anchor_text
                }&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
