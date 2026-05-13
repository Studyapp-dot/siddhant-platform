import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getAuthorityAnchors } from '@/app/actions/authority-anchors';
import EditForm from './EditForm';

function getReportContent(rev: { report_content?: string | null; tier1_content?: string | null } | null): string {
  if (!rev) return '';
  return rev.report_content || rev.tier1_content || '';
}

// ============================================================================
// SECTION SLUG SEPARATION — Editorial prose / Infrastructure identity
// ============================================================================
// Infrastructure tokens ({#sec_xxxx}) are excluded from the editor UI
// because revisions should reflect scholarly prose, not persistence metadata.
// The slug map preserves heading→slug associations for position-based
// reattachment on save, so heading renames preserve slug identity.

interface SectionSlugEntry {
  slug: string;
  title: string;
}

/**
 * Parse headings and their slugs from canonical markdown.
 * Returns the slug map for position-based reattachment.
 */
function parseSectionSlugMap(markdown: string): SectionSlugEntry[] {
  const entries: SectionSlugEntry[] = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*\{#(sec_[a-zA-Z0-9_-]+)\}\s*$/);
    if (match) {
      const title = match[2].trim();
      const slug = match[3];
      entries.push({ slug, title });
    }
  }
  return entries;
}

/**
 * Strip section slugs from markdown for clean editorial display.
 * Authors should never see infrastructure identifiers.
 */
function stripSectionSlugsForEditor(markdown: string): string {
  return markdown.replace(/\s*\{#sec_[a-zA-Z0-9_-]+\}/g, '');
}

export default async function EditPageContent({ slug }: { slug: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=You must be logged in to edit.');
  }

  const { data: node } = await supabase
    .from('nodes')
    .select('id, title, node_type')
    .eq('slug', slug)
    .maybeSingle();

  if (!node) {
    redirect('/');
  }

  const { data: revisionRows } = await supabase
    .from('revisions')
    .select('id, report_content, tier1_content')
    .eq('node_id', node.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const revision = revisionRows?.[0] ?? null;
  const canonicalContent = getReportContent(revision);
  const revisionId = revision?.id || '';
  const existingAnchors = await getAuthorityAnchors(node.id);

  // Parse slug map BEFORE stripping — preserves heading→slug associations
  const sectionSlugMap = parseSectionSlugMap(canonicalContent);
  // Strip slugs for clean editorial display
  const currentReport = stripSectionSlugsForEditor(canonicalContent);

  // Determine if user has L3+ permission to change node type
  const CAN_CHANGE_TYPE_ROLES = ['recognized', 'senior_scholar', 'steward', 'governance_council'];
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const canChangeType = CAN_CHANGE_TYPE_ROLES.includes(userProfile?.role || '');

  return (
    <div className="edit-layout">
      <EditForm
        nodeId={node.id}
        slug={slug}
        nodeTitle={node.title}
        nodeType={node.node_type || 'topic'}
        currentReport={currentReport}
        revisionId={revisionId}
        existingAnchors={existingAnchors}
        canChangeType={canChangeType}
        sectionSlugMap={sectionSlugMap}
      />
    </div>
  );
}
