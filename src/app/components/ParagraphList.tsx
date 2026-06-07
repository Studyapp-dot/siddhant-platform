'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ParagraphView from './ParagraphView';
import ParagraphEditor from './ParagraphEditor';
import './paragraph-view.css';
import './paragraph-editor.css';

// ============================================================================
// PARAGRAPH LIST — Renders the full paragraph-native reading experience
//
// Receives pre-fetched paragraphs from the server component.
// Handles: group separators, ?pid= scroll, "+ Add paragraph" insertion,
// and routing back after edits.
// ============================================================================

export interface ParagraphData {
  id: string;
  stable_id: string;
  display_number: number;
  marginal_note: string | null;
  content: string;
  group_label: string | null;
  order_index: number;
  node_id: string;
}

interface ParagraphListProps {
  paragraphs: ParagraphData[];
  slug: string;
  scrollToNumber?: number | null;
}

export default function ParagraphList({ paragraphs, slug, scrollToNumber }: ParagraphListProps) {
  const router = useRouter();
  const [insertingAfter, setInsertingAfter] = useState<number | null>(null);

  // Handle ?pid= scroll resolution on mount
  useEffect(() => {
    if (scrollToNumber) {
      const target = document.getElementById(`p-${scrollToNumber}`);
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [scrollToNumber]);

  const handleEdited = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleInsertClose = useCallback(() => {
    setInsertingAfter(null);
  }, []);

  const handleInsertSaved = useCallback(() => {
    setInsertingAfter(null);
    router.refresh();
  }, [router]);

  if (paragraphs.length === 0) return null;

  const nodeId = paragraphs[0].node_id;
  let currentGroup: string | null = null;

  return (
    <div className="paragraph-list report-body rendered-markdown">
      {/* Insert at top */}
      <button
        type="button"
        className="para-insert-btn"
        title="Add paragraph at the beginning"
        onClick={() => setInsertingAfter(0)}
      >
        <span className="para-insert-line">+ Add paragraph</span>
      </button>

      {paragraphs.map((para) => {
        const elements: React.ReactNode[] = [];

        // Group separator
        if (para.group_label && para.group_label !== currentGroup) {
          currentGroup = para.group_label;
          elements.push(
            <div
              key={`group-${para.display_number}`}
              className="paragraph-group-separator"
              role="separator"
              aria-label={para.group_label}
            >
              <span className="paragraph-group-label">{para.group_label}</span>
              <span className="paragraph-group-line" aria-hidden="true" />
            </div>
          );
        } else if (!para.group_label && currentGroup !== null) {
          currentGroup = null;
        }

        // Paragraph
        elements.push(
          <ParagraphView
            key={para.id}
            id={para.id}
            stableId={para.stable_id}
            displayNumber={para.display_number}
            marginalNote={para.marginal_note}
            content={para.content}
            groupLabel={para.group_label}
            nodeId={nodeId}
            slug={slug}
            onEdited={handleEdited}
          />
        );

        // Insert button after each paragraph
        elements.push(
          <button
            key={`insert-${para.display_number}`}
            type="button"
            className="para-insert-btn"
            title={`Add paragraph after ¶${para.display_number}`}
            onClick={() => setInsertingAfter(para.order_index)}
          >
            <span className="para-insert-line">+ Add paragraph</span>
          </button>
        );

        return elements;
      })}

      {/* Insert modal */}
      {insertingAfter !== null && (
        <ParagraphEditor
          paragraphId={null}
          nodeId={nodeId}
          slug={slug}
          displayNumber={0}
          initialContent=""
          initialMarginalNote=""
          initialGroupLabel=""
          insertAfterOrder={insertingAfter}
          onClose={handleInsertClose}
          onSaved={handleInsertSaved}
        />
      )}
    </div>
  );
}
