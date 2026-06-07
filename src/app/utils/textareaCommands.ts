// ============================================================================
// TEXTAREA COMMANDS — Pure content manipulation utilities
//
// Each function takes the current content and cursor positions,
// returns new content and cursor positions. The caller is responsible
// for applying state updates and restoring cursor via setSelectionRange.
// ============================================================================

export interface EditResult {
  content: string;
  cursorStart: number;
  cursorEnd: number;
}

/**
 * Wrap the selected text with prefix/suffix.
 * If no text is selected, inserts prefix+suffix and places cursor between them.
 */
export function wrapSelection(
  content: string,
  selStart: number,
  selEnd: number,
  prefix: string,
  suffix: string
): EditResult {
  const selected = content.slice(selStart, selEnd);

  if (selStart === selEnd) {
    // No selection — insert prefix+suffix, cursor between
    const newContent = content.slice(0, selStart) + prefix + suffix + content.slice(selEnd);
    return {
      content: newContent,
      cursorStart: selStart + prefix.length,
      cursorEnd: selStart + prefix.length,
    };
  }

  // Wrap selection
  const newContent = content.slice(0, selStart) + prefix + selected + suffix + content.slice(selEnd);
  return {
    content: newContent,
    cursorStart: selStart + prefix.length,
    cursorEnd: selStart + prefix.length + selected.length,
  };
}

/**
 * Add a prefix at the start of the current line.
 * If the line already starts with that prefix, it is removed (toggle behavior).
 */
export function prefixLine(
  content: string,
  selStart: number,
  prefix: string
): EditResult {
  // Find line start
  const lineStart = content.lastIndexOf('\n', selStart - 1) + 1;
  const lineEnd = content.indexOf('\n', selStart);
  const lineContent = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);

  if (lineContent.startsWith(prefix)) {
    // Toggle off — remove prefix
    const newContent = content.slice(0, lineStart) + lineContent.slice(prefix.length) + content.slice(lineEnd === -1 ? content.length : lineEnd);
    return {
      content: newContent,
      cursorStart: Math.max(lineStart, selStart - prefix.length),
      cursorEnd: Math.max(lineStart, selStart - prefix.length),
    };
  }

  // Add prefix
  const newContent = content.slice(0, lineStart) + prefix + content.slice(lineStart);
  return {
    content: newContent,
    cursorStart: selStart + prefix.length,
    cursorEnd: selStart + prefix.length,
  };
}

/**
 * Insert a multi-line block at the cursor position.
 * Ensures blank lines before and after the block for clean separation.
 * Returns cursor positioned inside the block (after the first line).
 */
export function insertBlock(
  content: string,
  selStart: number,
  block: string,
  cursorOffsetFromStart?: number
): EditResult {
  const before = content.slice(0, selStart);
  const after = content.slice(selStart);

  // Ensure blank line before block (if not at start of content)
  let separator = '';
  if (before.length > 0 && !before.endsWith('\n\n')) {
    separator = before.endsWith('\n') ? '\n' : '\n\n';
  }

  // Ensure blank line after block
  let trailingSeparator = '';
  if (after.length > 0 && !after.startsWith('\n\n')) {
    trailingSeparator = after.startsWith('\n') ? '\n' : '\n\n';
  }

  const newContent = before + separator + block + trailingSeparator + after;
  const cursorPos = cursorOffsetFromStart !== undefined
    ? before.length + separator.length + cursorOffsetFromStart
    : before.length + separator.length + block.indexOf('\n') + 1;

  return {
    content: newContent,
    cursorStart: cursorPos,
    cursorEnd: cursorPos,
  };
}

/**
 * Replace a range of text with new content.
 * Used for slash command replacement and template insertion.
 */
export function replaceRange(
  content: string,
  start: number,
  end: number,
  replacement: string
): EditResult {
  const newContent = content.slice(0, start) + replacement + content.slice(end);
  const cursorPos = start + replacement.length;
  return {
    content: newContent,
    cursorStart: cursorPos,
    cursorEnd: cursorPos,
  };
}
