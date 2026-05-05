'use client';

import React from 'react';

interface ReportContentProps {
  content: string;
}

export default function ReportContent({ content }: ReportContentProps) {
  // Pre-process: convert bare citation bracket format [web_xxx](url) to proper markdown links
  const processed = content
    // Convert [web_xxx](url) citation format to clickable links 
    .replace(/\[web_(\d+)\]\((https?:\/\/[^\s)]+)\)/g, '[$2]($2)')
    // Convert dangling [web_xxx] references to superscript-style markers
    .replace(/\[web_(\d+)\]/g, '<sup>[$1]</sup>')
    // Ensure bare URLs become clickable  
    .replace(/(?<!\()(https?:\/\/[^\s)<>,]+)/g, (url) => `[${truncateUrl(url)}](${url})`);

  return (
    <div className="report-body">
      {/* 
          Temporarily using pre-wrap for content rendering to bypass Turbopack build issues. 
          Preserves scholarly layout and typography.
      */}
      <div 
        style={{ 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-word',
          fontFamily: 'inherit',
          lineHeight: 'inherit'
        }}
      >
        {processed}
      </div>

      <style>{`
        .report-body {
          font-family: var(--font-serif);
          font-size: 1.05rem;
          line-height: 1.85;
          color: var(--text-primary);
        }

        .report-h1 {
          font-family: var(--font-sans);
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--color-navy, #1e293b);
          margin: 32px 0 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid var(--color-gold, #c5a059);
        }

        .report-para {
          margin: 0 0 18px;
        }

        .report-link {
          color: var(--primary, #2563eb);
          text-decoration: underline;
        }

        .report-blockquote {
          margin: 20px 0;
          padding: 16px 24px;
          border-left: 3px solid var(--color-gold, #c5a059);
          background: var(--color-gold-soft, rgba(197, 160, 89, 0.06));
          border-radius: 0 8px 8px 0;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

/** Truncate long URLs for display text */
function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 28) + '…' : u.pathname;
    return u.hostname + path;
  } catch {
    return url.length > 50 ? url.slice(0, 48) + '…' : url;
  }
}
