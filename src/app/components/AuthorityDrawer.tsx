'use client';

import React from 'react';
import Link from 'next/link';
import { AUTHORITY_TYPE_META } from '@/app/actions/authority-constants';
import type { AuthorityAnchor, AuthorityType } from '@/app/actions/authority-anchors';

// ============================================================================
// EVIDENCE DRAWER — "Sources informing this article"
// Rendered in the right sidebar of the topic page.
// Groups authorities by type with institutional styling.
// Internal vs external authorities are visually differentiated.
// ============================================================================

interface AuthorityDrawerProps {
  anchors: AuthorityAnchor[];
}

// Group order for display
const GROUP_ORDER: AuthorityType[] = [
  'case', 'statute', 'constitutional_provision',
  'doctrine', 'concept', 'external_source',
];

// Helper: extract hostname from URL safely
function getHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

// External link icon (SVG inline)
function ExternalLinkIcon() {
  return (
    <svg className="authority-external-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

export default function AuthorityDrawer({ anchors }: AuthorityDrawerProps) {
  if (anchors.length === 0) {
    return (
      <div className="authority-drawer">
        <div className="authority-drawer-header">
          <span className="authority-drawer-title">Primary Authorities</span>
        </div>
        <div className="authority-drawer-empty">
          No authorities have been attached to this article yet.
          <br />
          Contributors can anchor cases, statutes, and doctrines to specific claims.
        </div>
      </div>
    );
  }

  // Group by authority_type, deduplicating by title
  const grouped: Record<string, AuthorityAnchor[]> = {};
  const seen = new Set<string>();

  for (const anchor of anchors) {
    const key = `${anchor.authority_type}::${anchor.authority_title}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!grouped[anchor.authority_type]) {
      grouped[anchor.authority_type] = [];
    }
    grouped[anchor.authority_type].push(anchor);
  }

  return (
    <div className="authority-drawer">
      <div className="authority-drawer-header">
        <span className="authority-drawer-title">Primary Authorities</span>
        <span className="authority-drawer-count">{anchors.length}</span>
      </div>

      <div className="authority-drawer-groups">
        {GROUP_ORDER.map(type => {
          const items = grouped[type];
          if (!items || items.length === 0) return null;
          const meta = AUTHORITY_TYPE_META[type];

          return (
            <div key={type} className="authority-drawer-group">
              <div className="authority-drawer-group-header">
                <span
                  className="authority-drawer-group-dot"
                  style={{ background: meta.color }}
                />
                <span className="authority-drawer-group-label">{meta.label}s</span>
              </div>

              {items.map(anchor => {
                const hasInternalLink = !!anchor.authority_node_slug;
                const hasExternalUrl = !!anchor.authority_url;

                // Determine wrapper element: internal Link, external <a>, or plain div
                let Tag: any = 'div';
                let linkProps: any = {};

                if (hasInternalLink) {
                  Tag = Link;
                  linkProps = { href: `/topic/${anchor.authority_node_slug}` };
                } else if (hasExternalUrl) {
                  Tag = 'a';
                  linkProps = { href: anchor.authority_url, target: '_blank', rel: 'noopener noreferrer' };
                }

                const hostname = hasExternalUrl ? getHostname(anchor.authority_url!) : '';

                return (
                  <Tag
                    key={anchor.id}
                    className={`authority-drawer-item${hasInternalLink ? ' authority-internal' : ''}${hasExternalUrl ? ' authority-external' : ''}`}
                    {...linkProps}
                  >
                    <span className="authority-drawer-item-icon">{meta.icon}</span>
                    <div className="authority-drawer-item-info">
                      <span className="authority-drawer-item-title">
                        {anchor.authority_title}
                      </span>
                      {anchor.authority_citation && (
                        <span className="authority-drawer-item-citation">
                          {anchor.authority_citation}
                        </span>
                      )}
                      {/* External source URL — visible hostname + icon */}
                      {hasExternalUrl && hostname && (
                        <span className="authority-drawer-item-source" title={anchor.authority_url!}>
                          <ExternalLinkIcon />
                          <span className="authority-drawer-source-hostname">{hostname}</span>
                        </span>
                      )}
                      {/* Internal node indicator */}
                      {hasInternalLink && !hasExternalUrl && (
                        <span className="authority-drawer-item-internal-badge">
                          ↳ Siddhant Archive
                        </span>
                      )}
                      <span className="authority-drawer-item-excerpt">
                        &ldquo;{anchor.anchor_text.length > 50
                          ? anchor.anchor_text.slice(0, 50) + '…'
                          : anchor.anchor_text
                        }&rdquo;
                      </span>
                    </div>
                  </Tag>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
