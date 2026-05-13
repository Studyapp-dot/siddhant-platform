// ============================================================================
// Revision presentation boundaries
// ============================================================================
//
// Stored article content is Markdown plus platform infrastructure tokens
// such as stable section anchors. Public contributor surfaces must compare and
// explain the scholarly text, not the editor/storage representation.

export function humanizeSlug(slug: string): string {
  return slug
    .replace(/^\/?(topic|node)\//, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function toPublicRevisionText(content?: string | null): string {
  if (!content) return '';

  let text = content.replace(/\r\n?/g, '\n');

  // Remove platform-owned section anchors before any Markdown processing.
  text = text.replace(/\s*\{#sec_[a-zA-Z0-9_-]+\}/g, '');

  // Custom authoring syntaxes.
  text = text.replace(/\[web_(\d+)\]\((https?:\/\/[^\s)]+)\)/g, 'Source $1');
  text = text.replace(/\[web_(\d+)\]/g, 'Source $1');
  text = text.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_, slug: string) => humanizeSlug(slug));

  // Markdown blocks.
  text = text.replace(/```[\w-]*\n?([\s\S]*?)```/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/^>\s?/gm, '');
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');
  text = text.replace(/^[\t ]{0,3}[-*+]\s+/gm, '');
  text = text.replace(/^[\t ]{0,3}\d+\.\s+/gm, '');
  text = text.replace(/^[\t ]{0,3}\|?(.*\|.*)\|?\s*$/gm, (_, row: string) =>
    row.split('|').map((cell: string) => cell.trim()).filter(Boolean).join(' ')
  );

  // Markdown inline syntax. Images are handled before links.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
  text = text.replace(/\[([^\]]+)\]:\s+\S+/g, '$1');
  text = text.replace(/\[\^([^\]]+)\]/g, 'Note $1');
  text = text.replace(/`([^`]*)`/g, '$1');
  text = text.replace(/~~([^~]*)~~/g, '$1');
  text = text.replace(/(\*\*\*|___)(.*?)\1/g, '$2');
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(^|[\s([{])([*_])([^*_\n]+)\2(?=$|[\s.,;:!?)}\]])/g, '$1$3');

  // Raw HTML is disabled by the renderer, but old content may still contain
  // escaped or pasted tags. Public diffs should not expose tag syntax.
  text = text.replace(/<[^>]+>/g, '');

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function normalizePublicRevisionText(content?: string | null): string {
  return toPublicRevisionText(content)
    .replace(/\s+/g, ' ')
    .trim();
}
