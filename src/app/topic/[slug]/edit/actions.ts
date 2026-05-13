'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import MarkdownIt from 'markdown-it'
import { computeVisibleTextSize, normalizeForComparison } from '@/utils/content-size'

const NODE_TYPES = new Set([
  'topic',
  'statute',
  'chapter',
  'section',
  'constitutional_provision',
  'judgment',
  'doctrine',
  'concept',
]);

// Roles permitted to mutate node type (ontology governance — L3+)
const CAN_CHANGE_TYPE = ['recognized', 'senior_scholar', 'steward', 'governance_council'];

// ============================================================================
// BLOCKED SAVE REASONS — Telemetry categories for governance analysis
// ============================================================================
type BlockedReason = 'no_visible_change' | 'low_signal_change';

function logBlockedSave(reason: BlockedReason, nodeId: string, userId: string, visibleDelta: number) {
  // Structured telemetry log — enables future analysis of gate behavior
  console.log(JSON.stringify({
    event: 'revision_blocked',
    reason,
    node_id: nodeId,
    user_id: userId,
    visible_delta: visibleDelta,
    timestamp: new Date().toISOString(),
  }));
}

// ============================================================================
// REVISION SAVE RESULT — Returned to EditForm client component
// ============================================================================
export type RevisionResult = {
  success?: boolean;
  error?: string;
  blocked_reason?: BlockedReason;
};

function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('Node type updates require SUPABASE_SERVICE_ROLE_KEY on the server.');
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function getFormText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function buildStructuredCommitMessage(formData: FormData): string {
  const type = getFormText(formData, 'contribution_type');
  const summary = getFormText(formData, 'scholarly_summary');
  const legacyCommit = getFormText(formData, 'commit_message'); // fallback

  if (type && summary) {
    return `[${type}] ${summary}`;
  }
  
  if (legacyCommit) return legacyCommit;
  return 'Updated article content.';
}

function generateSectionId() {
  return 'sec_' + Math.random().toString(36).substring(2, 8);
}

// ============================================================================
// CITATION-SENSITIVE BYPASS — Indian legal reference patterns
// ============================================================================
// Scholarly grounding actions (citations, statutory references) are often
// textually small but institutionally significant. These patterns detect
// new legal references so the low-delta gate doesn't suppress them.
// This is a lightweight heuristic, not NLP.
const LEGAL_REFERENCE_PATTERNS = [
  /AIR\s+\d{4}/i,                      // AIR citations (e.g., AIR 1978 SC 597)
  /\(\d{4}\)\s+\d+\s+SCC/i,            // SCC citations (e.g., (1973) 4 SCC 225)
  /\d+\s+SCR\s+\d+/i,                  // SCR citations
  /Article\s+\d+/i,                     // Constitutional articles
  /Section\s+\d+/i,                     // Statutory sections
  /S\.\s*\d+/i,                         // Section shorthand (S. 302)
  /Rule\s+\d+/i,                        // Rules
  /Order\s+[IVXLC]+/i,                 // CPC Orders (Roman numerals)
  /\bv\.\s+(?:State|Union)/i,          // Case name patterns (X v. State)
];

function containsNewLegalReferences(oldContent: string, newContent: string): boolean {
  for (const pattern of LEGAL_REFERENCE_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, 'gi');
    const oldMatches = (oldContent.match(globalPattern) || []).length;
    const newMatches = (newContent.match(globalPattern) || []).length;
    if (newMatches > oldMatches) return true;
  }
  return false;
}

// ============================================================================
// SECTION SLUG PROCESSING — Position-based reattachment
// ============================================================================
// Section slugs ({#sec_xxxx}) are infrastructure identifiers hidden from the
// editor UI. Authors edit clean prose; slugs are reattached on save using
// position-based mapping from the original heading order.
//
// INVARIANT: Heading renames MUST preserve slug identity.
// Only genuinely NEW headings (inserted, not renamed) get new slugs.
// This protects cross-references, edge stability, and section history.

interface SectionSlugEntry {
  slug: string;
  title: string;
}

function processMarkdownSections(
  content: string,
  existingSectionSlugs: SectionSlugEntry[] = []
) {
  if (!content) return { updatedContent: '', sections: [] };

  const md = new MarkdownIt();
  const tokens = md.parse(content, {});
  const lines = content.split('\n');
  const sections: { slug: string, title: string, level: number, order_index: number }[] = [];
  let orderIndex = 0;

  // Track which existing slugs have been consumed (by position)
  let existingSlugIndex = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.substring(1), 10);
      const inlineToken = tokens[i + 1];
      if (inlineToken && inlineToken.type === 'inline') {
        const titleText = inlineToken.content;
        
        const map = token.map;
        if (map && map.length === 2) {
          const startLine = map[0];
          let line = lines[startLine];
          
          // Check if heading already has a slug in the content (shouldn't happen
          // since we strip slugs before editor, but handle gracefully)
          const inlineSlugMatch = line.match(/\{#(sec_[a-zA-Z0-9_-]+)\}\s*$/);
          let slug = '';
          
          if (inlineSlugMatch) {
            // Slug found inline — preserve it (legacy content or direct edit)
            slug = inlineSlugMatch[1];
          } else if (existingSlugIndex < existingSectionSlugs.length) {
            // Position-based reattachment: reuse slug from original position.
            // This preserves slug identity even when headings are renamed.
            slug = existingSectionSlugs[existingSlugIndex].slug;
            existingSlugIndex++;
          } else {
            // Genuinely new heading — generate fresh slug
            slug = generateSectionId();
          }
          
          // Append slug to the line for canonical storage
          if (!inlineSlugMatch) {
            line = `${line.trimEnd()} {#${slug}}`;
            lines[startLine] = line;
          }
          
          const cleanTitle = titleText.replace(/\{#(sec_[a-zA-Z0-9_-]+)\}\s*$/, '').trim();
          
          sections.push({
             slug,
             title: cleanTitle,
             level,
             order_index: orderIndex++
          });
        }
      }
    }
  }

  return {
    updatedContent: lines.join('\n'),
    sections
  };
}

export async function submitRevision(formData: FormData): Promise<RevisionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const slug = getFormText(formData, 'slug');
  const node_id = getFormText(formData, 'node_id');
  const raw_report_content = getFormText(formData, 'report_content');
  const new_node_type = getFormText(formData, 'node_type');
  const original_node_type = getFormText(formData, 'original_node_type');
  const commit = buildStructuredCommitMessage(formData);

  // Parse the hidden section slug map passed from EditForm
  // This enables position-based slug reattachment after slug stripping
  let existingSectionSlugs: SectionSlugEntry[] = [];
  try {
    const slugMapJson = getFormText(formData, 'section_slug_map');
    if (slugMapJson) existingSectionSlugs = JSON.parse(slugMapJson);
  } catch { /* If parsing fails, all headings get new slugs — safe fallback */ }

  const { updatedContent: report_content, sections } = processMarkdownSections(
    raw_report_content,
    existingSectionSlugs,
  );

  // ========================================================================
  // VISIBLE-TEXT CHARACTER COUNTING
  // Strips section slugs, markdown syntax, and infrastructure tokens
  // so that content_size reflects actual scholarly contribution.
  // ========================================================================
  const content_size = computeVisibleTextSize(report_content);

  // ========================================================================
  // NODE TYPE GOVERNANCE — L3+ required for ontology mutation
  // ========================================================================
  const typeChanged = new_node_type && original_node_type && new_node_type !== original_node_type;
  let finalCommit = commit;

  if (typeChanged) {
    if (!NODE_TYPES.has(new_node_type)) {
      return { error: `Unsupported node type: ${new_node_type}` };
    }

    // Permission gate: ontology mutations require L3+ (Recognized Contributor)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || !CAN_CHANGE_TYPE.includes(userProfile.role)) {
      return {
        error: 'Node type classification requires Recognized Contributor (Level 3) or higher. '
          + 'Continue contributing to advance your scholarly standing.',
      };
    }

    const { data: submittedNode, error: submittedNodeError } = await supabase
      .from('nodes')
      .select('id, slug')
      .eq('id', node_id)
      .eq('slug', slug)
      .maybeSingle();

    if (submittedNodeError || !submittedNode) {
      return { error: `Could not update node type: ${submittedNodeError?.message || 'Submitted topic identity did not match an existing node.'}` };
    }

    const admin = createAdminClient();
    const { error: nodeTypeUpdateError } = await admin
      .from('nodes')
      .update({ node_type: new_node_type })
      .eq('id', node_id);

    if (nodeTypeUpdateError) {
      return { error: `Could not update node type: ${nodeTypeUpdateError.message}` };
    }

    const { data: updatedNode, error: nodeTypeReadError } = await admin
      .from('nodes')
      .select('id, node_type')
      .eq('id', node_id)
      .maybeSingle();

    if (nodeTypeReadError || !updatedNode) {
      return { error: `Could not verify node type update: ${nodeTypeReadError?.message || 'No matching node was found.'}` };
    }

    if (updatedNode.node_type !== new_node_type) {
      return { error: `Could not verify node type update: expected ${new_node_type}, found ${updatedNode.node_type || 'empty'}.` };
    }

    finalCommit = `${commit} [Type changed: ${original_node_type} → ${new_node_type}]`;
  }

  // ========================================================================
  // NO-OP & LOW-SIGNAL GATES
  // Prevents revision creation for infrastructure-only or trivial mutations.
  // Node type changes bypass both gates (ontology mutation is always meaningful).
  // ========================================================================
  if (!typeChanged) {
    const { data: prevRevision } = await supabase
      .from('revisions')
      .select('report_content')
      .eq('node_id', node_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevRevision) {
      const prevNormalized = normalizeForComparison(prevRevision.report_content || '');
      const currNormalized = normalizeForComparison(report_content);

      // Gate 1: Identical visible content → no-op
      if (prevNormalized === currNormalized) {
        logBlockedSave('no_visible_change', node_id, user.id, 0);
        return {
          error: 'No meaningful visible-text changes detected. '
            + 'Only infrastructure or formatting changes were found. '
            + 'Revision not created.',
          blocked_reason: 'no_visible_change',
        };
      }

      // Gate 2: Low-signal heuristic — visible delta below threshold
      // NOTE: This is a temporary heuristic, not a semantic truth detector.
      // Small edits CAN be highly meaningful (e.g., "shall" → "may").
      // Long-term: semantic classification should replace this threshold.
      const prevVisibleSize = computeVisibleTextSize(prevRevision.report_content || '');
      const visibleDelta = Math.abs(content_size - prevVisibleSize);

      if (visibleDelta < 20) {
        // CITATION-SENSITIVE BYPASS: scholarly legal citations are often
        // textually small but institutionally significant. If new legal
        // references are detected, bypass the low-delta gate.
        const hasCitationBypass = containsNewLegalReferences(
          prevRevision.report_content || '',
          report_content,
        );

        if (!hasCitationBypass) {
          logBlockedSave('low_signal_change', node_id, user.id, visibleDelta);
          return {
            error: 'This edit contains very few visible-text changes (< 20 characters). '
              + 'If you believe this is a meaningful scholarly edit, please expand your contribution. '
              + 'Revision not created.',
            blocked_reason: 'low_signal_change',
          };
        }
        // Citation detected — allow revision despite low delta
      }
    }
  }

  // ========================================================================
  // REVISION INSERT
  // INVARIANT: Only meaningful visible scholarly mutations reach this point.
  // Infrastructure-only and formatting-only changes are blocked above.
  // AI extraction is dispatched AFTER this insert — never for blocked saves.
  // ========================================================================
  const revision_type = typeChanged ? 'type_change' : 'content_edit';

  // Snapshot the node type at the time of save for historical ontology reconstruction.
  // This enables future queries like "what type was this node when revision X was made?"
  const node_type_at_save = typeChanged ? new_node_type : (original_node_type || 'topic');

  const { data: insertedRevision, error } = await supabase.from('revisions').insert({
    node_id: node_id,
    author_id: user.id,
    report_content: report_content,
    commit_message: finalCommit,
    content_size: content_size,
    revision_type: revision_type,
    node_type_at_save: node_type_at_save,
  }).select('id').single();

  if (error) {
    return { error: error.message };
  }

  // ========================================================================
  // SECTION SYNC — Synchronize article_sections table
  // ========================================================================
  const admin = createAdminClient();
  try {
    const { data: existingSections } = await admin
      .from('article_sections')
      .select('id, slug, title, level, order_index')
      .eq('node_id', node_id)
      .is('deleted_at', null);
      
    const existingSlugs = new Set((existingSections || []).map(s => s.slug));
    const newSlugs = new Set(sections.map(s => s.slug));
    
    if (sections.length > 0) {
      const upsertData = sections.map(s => ({
        node_id,
        slug: s.slug,
        title: s.title,
        level: s.level,
        order_index: s.order_index,
        deleted_at: null,
        updated_at: new Date().toISOString()
      }));
      await admin.from('article_sections').upsert(upsertData, { onConflict: 'node_id,slug' });
    }
    
    const removedSlugs = [...existingSlugs].filter(s => !newSlugs.has(s));
    if (removedSlugs.length > 0) {
      await admin.from('article_sections')
        .update({ deleted_at: new Date().toISOString() })
        .eq('node_id', node_id)
        .in('slug', removedSlugs);
    }
  } catch (err) {
    console.error('[edit-node] Section sync failed:', err);
  }

  // ========================================================================
  // REPUTATION TRACKING — Increment total edits count (ATOMIC)
  // Uses the same RPC as acceptEdit to prevent race conditions.
  // The old non-atomic read→increment→write pattern caused counts like
  // "10 accepted of 7" when concurrent saves collided.
  // ========================================================================
  const { incrementEditCount } = await import('@/app/actions/reputation');
  await incrementEditCount(user.id);

  // ========================================================================
  // AI EXTRACTION — Non-blocking, fire-and-forget (TRANSITIONAL)
  // This pattern has no retry or durability guarantees on serverless.
  // Phase 3 should replace this with a durable job queue (Inngest/pg-boss).
  // ========================================================================
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  fetch(`${origin}/api/extract-metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId: node_id }),
  }).catch(err => console.error('[edit-node] Metadata extraction dispatch failed:', err));

  if (insertedRevision?.id) {
    fetch(`${origin}/api/extract-revision-semantics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionId: insertedRevision.id }),
    }).catch(err => console.error('[edit-node] Semantics extraction dispatch failed:', err));
  }

  // ========================================================================
  // CACHE INVALIDATION & REDIRECT
  // ========================================================================
  revalidatePath(`/topic/${slug}`, 'layout');
  if (typeChanged) {
    revalidatePath('/nodes');
    revalidatePath('/explore');
    revalidatePath('/dashboard');
    revalidatePath('/recognition');
    revalidatePath('/topic/[slug]', 'layout');
    revalidatePath('/', 'layout');
    revalidatePath('/api/nodes-list');
  }
  redirect(`/topic/${slug}`);
}
