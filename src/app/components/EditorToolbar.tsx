'use client';

import React, { useCallback } from 'react';
import { wrapSelection, prefixLine, insertBlock } from '@/app/utils/textareaCommands';

// ============================================================================
// EDITOR TOOLBAR — Compact formatting buttons for the markdown textarea
// ============================================================================

interface EditorToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  onContentChange: (content: string, cursorStart?: number, cursorEnd?: number) => void;
  onOpenLinkModal: () => void;
}

export default function EditorToolbar({
  textareaRef,
  content,
  onContentChange,
  onOpenLinkModal,
}: EditorToolbarProps) {
  const applyEdit = useCallback(
    (result: { content: string; cursorStart: number; cursorEnd: number }) => {
      onContentChange(result.content, result.cursorStart, result.cursorEnd);
    },
    [onContentChange]
  );

  const getSelection = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return { start: 0, end: 0 };
    return { start: ta.selectionStart, end: ta.selectionEnd };
  }, [textareaRef]);

  const handleHeading = useCallback(
    (level: number) => {
      const { start } = getSelection();
      const prefix = '#'.repeat(level) + ' ';
      applyEdit(prefixLine(content, start, prefix));
    },
    [content, getSelection, applyEdit]
  );

  const handleBold = useCallback(() => {
    const { start, end } = getSelection();
    applyEdit(wrapSelection(content, start, end, '**', '**'));
  }, [content, getSelection, applyEdit]);

  const handleItalic = useCallback(() => {
    const { start, end } = getSelection();
    applyEdit(wrapSelection(content, start, end, '*', '*'));
  }, [content, getSelection, applyEdit]);

  const handleBullet = useCallback(() => {
    const { start } = getSelection();
    applyEdit(prefixLine(content, start, '- '));
  }, [content, getSelection, applyEdit]);

  const handleNumbered = useCallback(() => {
    const { start } = getSelection();
    applyEdit(prefixLine(content, start, '1. '));
  }, [content, getSelection, applyEdit]);

  const handleQuote = useCallback(() => {
    const { start } = getSelection();
    applyEdit(prefixLine(content, start, '> '));
  }, [content, getSelection, applyEdit]);

  const handleLegalText = useCallback(() => {
    const { start } = getSelection();
    const block = ':::legal\n\n:::';
    // Place cursor inside the block (after :::legal\n)
    applyEdit(insertBlock(content, start, block, ':::legal\n'.length));
  }, [content, getSelection, applyEdit]);

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Formatting toolbar">
      {/* Heading group */}
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => handleHeading(2)}
          title="Section Heading (H2)"
          aria-label="Insert section heading"
        >
          H2
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => handleHeading(3)}
          title="Sub-heading (H3)"
          aria-label="Insert sub-heading"
        >
          H3
        </button>
      </div>

      <span className="toolbar-separator" />

      {/* Inline formatting */}
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn toolbar-btn-bold"
          onClick={handleBold}
          title="Bold"
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-italic"
          onClick={handleItalic}
          title="Italic"
          aria-label="Italic"
        >
          I
        </button>
      </div>

      <span className="toolbar-separator" />

      {/* Lists */}
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          onClick={handleBullet}
          title="Bullet List"
          aria-label="Bullet list"
        >
          •
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={handleNumbered}
          title="Numbered List"
          aria-label="Numbered list"
        >
          1.
        </button>
      </div>

      <span className="toolbar-separator" />

      {/* Blocks */}
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          onClick={handleQuote}
          title="Blockquote"
          aria-label="Blockquote"
        >
          &ldquo;
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-legal"
          onClick={handleLegalText}
          title="Legal Text Block"
          aria-label="Insert legal text block"
        >
          §
        </button>
      </div>

      <span className="toolbar-separator" />

      {/* Link */}
      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn"
          onClick={onOpenLinkModal}
          title="Insert Link"
          aria-label="Insert link"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
      </div>
    </div>
  );
}
