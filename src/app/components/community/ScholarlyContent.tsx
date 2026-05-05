import React from 'react';
import Link from 'next/link';

// ============================================================================
// SIDDHANT: Scholarly Content Renderer — Phase 5
//
// Transforms raw forum post text into rich scholarly content:
//   1. [[wiki-links]] → clickable links to knowledge graph nodes
//   2. Preserves line breaks (pre-wrap handled by CSS)
//   3. Does NOT add markdown, bold, or other formatting
//      (scholarly discourse relies on prose, not formatting tricks)
//
// Design principle:
//   Wiki-links should feel like inline references in an academic paper,
//   not like hyperlinks on a social media post. Styled with understated
//   gold rather than bright blue underlines.
// ============================================================================

/**
 * Parse content and replace [[slug]] or [[slug|Display Text]] patterns
 * with clickable links to /topic/slug.
 *
 * Examples:
 *   [[digital-privacy]]           → link to /topic/digital-privacy, display "digital-privacy"
 *   [[digital-privacy|Digital Privacy]] → link to /topic/digital-privacy, display "Digital Privacy"
 */
export function ScholarlyContent({ content }: { content: string }) {
  // Regex: [[slug]] or [[slug|display text]]
  const WIKI_LINK = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WIKI_LINK.exec(content)) !== null) {
    // Push text before the match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const slug = match[1].trim();
    const displayText = match[2]?.trim() || slug.replace(/-/g, ' ');

    parts.push(
      <Link
        key={`wl-${match.index}`}
        href={`/topic/${slug}`}
        className="de-wiki-link"
        title={`View report: ${displayText}`}
      >
        {displayText}
      </Link>
    );

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  // If no wiki-links found, return plain text
  if (parts.length === 0) {
    return <>{content}</>;
  }

  return <>{parts}</>;
}
