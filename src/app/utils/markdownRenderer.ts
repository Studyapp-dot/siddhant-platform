// ============================================================================
// SIDDHANT: Shared Markdown Renderer
//
// Single canonical renderer for all content surfaces:
//   - Published topic pages
//   - Preview mode (new + edit)
//   - Contribution review panel
//   - History/revision views
//
// Built on markdown-it for proper AST parsing, extensibility,
// and future support for legal citations, footnotes, authority embeds.
// ============================================================================

import MarkdownIt from 'markdown-it';

// Plugin to extract {#slug} and set id on headings
function sectionAnchorPlugin(md: MarkdownIt) {
  md.core.ruler.push('section_anchor', (state) => {
    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i];
      if (token.type === 'heading_open') {
        const inlineToken = state.tokens[i + 1];
        if (inlineToken && inlineToken.type === 'inline') {
          const match = inlineToken.content.match(/\{#(sec_[a-zA-Z0-9_-]+)\}\s*$/);
          if (match) {
            const slug = match[1];
            inlineToken.content = inlineToken.content.replace(/\{#(sec_[a-zA-Z0-9_-]+)\}\s*$/, '').trim();
            if (inlineToken.children) {
              for (let j = inlineToken.children.length - 1; j >= 0; j--) {
                const child = inlineToken.children[j];
                if (child.type === 'text') {
                  if (child.content.match(/\{#(sec_[a-zA-Z0-9_-]+)\}\s*$/)) {
                    child.content = child.content.replace(/\{#(sec_[a-zA-Z0-9_-]+)\}\s*$/, '').trim();
                    break;
                  }
                }
              }
            }
            token.attrSet('id', slug);
          }
        }
      }
    }
  });
}

// Plugin to intercept internal node links and style them semantically
function internalLinkPlugin(md: MarkdownIt) {
  const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex('href');
    if (hrefIndex >= 0 && token.attrs) {
      const href = token.attrs[hrefIndex][1];
      if (href.startsWith('/topic/') || href.startsWith('/node/')) {
        const slug = href.replace(/^\/(topic|node)\//, '');
        token.attrPush(['class', 'inline-node-link']);
        token.attrPush(['data-node-slug', slug]);
      }
    }
    return defaultRender(tokens, idx, options, env, self);
  };
}

// Initialize markdown-it with safe defaults
const md = new MarkdownIt({
  html: false,        // Disable raw HTML for security
  breaks: true,       // Convert \n to <br> (matches textarea behavior)
  linkify: true,      // Auto-detect URLs
  typographer: true,  // Smart quotes, dashes
})
.use(sectionAnchorPlugin)
.use(internalLinkPlugin);

// Disable indented code blocks — legal writers frequently indent for structure,
// not to write code. Fenced code blocks (```) still work if needed.
md.disable('code');

// ── Custom Rules ──


/**
 * Pre-processes text to expand custom syntaxes before parsing.
 */
function preprocessMarkdown(content: string): string {
  return content
    // Web citation placeholders
    .replace(/\[web_(\d+)\]\((https?:\/\/[^\s)]+)\)/g, '[Source $1]($2)')
    .replace(/\[web_(\d+)\]/g, '[Source $1]')
    // Wiki links: [[slug|Display Text]]
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '[$2](/topic/$1)')
    // Wiki links: [[slug]]
    .replace(/\[\[([^\]]+)\]\]/g, '[$1](/topic/$1)');
}

/**
 * Render markdown content to HTML.
 * Used by all content surfaces for consistent rendering.
 *
 * @param content - Raw markdown string
 * @param options - Optional rendering flags
 * @returns Sanitized HTML string
 */
export function renderMarkdown(content: string): string {
  if (!content || !content.trim()) {
    return '<p class="preview-empty">No content written yet.</p>';
  }

  const processed = preprocessMarkdown(content);
  return md.render(processed);
}

/**
 * Render markdown content split into paragraph blocks.
 * Used by ReportContent for authority marker overlay at paragraph boundaries.
 *
 * @param content - Raw markdown string
 * @returns Array of { html, originalIndex } for each paragraph
 */
export function renderMarkdownParagraphs(
  content: string
): { html: string; originalIndex: number }[] {
  if (!content || !content.trim()) {
    return [{ html: '<p class="preview-empty">No content written yet.</p>', originalIndex: 0 }];
  }

  // Split by double newlines to identify paragraph boundaries
  const paragraphs = content.split(/\n\n+/);

  return paragraphs.map((para, index) => {
    const processed = preprocessMarkdown(para);
    let html = md.render(processed);


    return { html, originalIndex: index };
  });
}
