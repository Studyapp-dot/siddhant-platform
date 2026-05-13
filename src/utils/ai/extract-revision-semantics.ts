import { createClient } from '@supabase/supabase-js';
import { diff_match_patch } from 'diff-match-patch';
import { normalizePublicRevisionText, toPublicRevisionText } from '@/utils/revision-presentation';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

type ContributionType =
  | 'citation_addition'
  | 'doctrinal_expansion'
  | 'conceptual_clarification'
  | 'precedent_synthesis'
  | 'contradiction_resolution'
  | 'structural_reorganization'
  | 'historical_context'
  | 'analytical_improvement'
  | 'terminology_standardization'
  | 'evidence_strengthening'
  | 'mixed';

type ContributionScope = 'local' | 'section_wide' | 'article_wide' | 'doctrinal' | 'cross_node';
type ScholarlySignificance = 'minor' | 'meaningful' | 'substantial' | 'foundational';
type EvidenceQuality = 'citation_backed' | 'reasoning_backed' | 'assertion_only' | 'incomplete' | 'mixed';

interface RevisionSemantics {
  contribution_thesis: string;
  contribution_type: ContributionType;
  contribution_scope: ContributionScope;
  significance: ScholarlySignificance;
  claims_added: string[];
  concepts_introduced: string[];
  evidence_quality: EvidenceQuality;
  reasoning: string;
}

interface NodeRelation {
  title?: string | null;
  node_type?: string | null;
}

interface RevisionRow {
  id: string;
  node_id: string;
  report_content?: string | null;
  tier1_content?: string | null;
  commit_message?: string | null;
  created_at: string;
  nodes?: NodeRelation | NodeRelation[] | null;
}

const CONTRIBUTION_TYPES = new Set<string>([
  'citation_addition',
  'doctrinal_expansion',
  'conceptual_clarification',
  'precedent_synthesis',
  'contradiction_resolution',
  'structural_reorganization',
  'historical_context',
  'analytical_improvement',
  'terminology_standardization',
  'evidence_strengthening',
  'mixed',
]);

const CONTRIBUTION_SCOPES = new Set<string>(['local', 'section_wide', 'article_wide', 'doctrinal', 'cross_node']);
const SIGNIFICANCE_LEVELS = new Set<string>(['minor', 'meaningful', 'substantial', 'foundational']);
const EVIDENCE_QUALITIES = new Set<string>(['citation_backed', 'reasoning_backed', 'assertion_only', 'incomplete', 'mixed']);

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

function getModel(): string {
  return process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
}

function normalizeContent(revision: { report_content?: string | null; tier1_content?: string | null } | null): string {
  return toPublicRevisionText(revision?.report_content || revision?.tier1_content || '');
}

function compactDiff(previous: string, current: string): string {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(previous, current);
  dmp.diff_cleanupSemantic(diffs);

  const lines: string[] = [];
  for (const [op, text] of diffs) {
    if (op === 0) continue;

    const prefix = op === 1 ? '+ ' : '- ';
    const fragments = text
      .split('\n')
      .map(fragment => fragment.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 12);

    for (const fragment of fragments) {
      lines.push(`${prefix}${fragment.slice(0, 500)}`);
      if (lines.length >= 24) return lines.join('\n');
    }
  }

  return lines.join('\n');
}

function trimForPrompt(text: string, maxLength = 12000): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength / 2)}\n\n[...middle omitted for length...]\n\n${text.slice(-maxLength / 2)}`;
}

function buildPrompt(params: {
  nodeTitle: string;
  nodeType: string;
  commitMessage: string;
  previousContent: string;
  currentContent: string;
  diff: string;
}): string {
  return `You are a revision-level contribution intelligence extractor for Siddhant, an Indian law scholarship platform.

Your task is to compare OLD VERSION and NEW VERSION and describe what scholarly contribution the revision made.

Important boundaries:
- Describe the intellectual change.
- Do NOT assign reputation, quality scores, authority, or rewards.
- Do NOT praise the contributor.
- Do NOT hallucinate. If the contribution is unclear, be conservative.
- The thesis must be one short academic headline sentence, ideally under 22 words.

NODE TITLE: ${params.nodeTitle}
NODE TYPE: ${params.nodeType}
USER EDIT SUMMARY: ${params.commitMessage || 'None'}

COMPACT DIFF:
${params.diff || '[No textual diff available]'}

OLD VERSION:
${trimForPrompt(params.previousContent)}

NEW VERSION:
${trimForPrompt(params.currentContent)}

Return ONLY valid JSON with this exact shape:
{
  "contribution_thesis": "single short sentence stating the core intellectual improvement",
  "contribution_type": "one of: citation_addition, doctrinal_expansion, conceptual_clarification, precedent_synthesis, contradiction_resolution, structural_reorganization, historical_context, analytical_improvement, terminology_standardization, evidence_strengthening, mixed",
  "contribution_scope": "one of: local, section_wide, article_wide, doctrinal, cross_node",
  "significance": "one of: minor, meaningful, substantial, foundational",
  "claims_added": ["specific legal or analytical claims added by this revision"],
  "concepts_introduced": ["legal concepts, cases, doctrines, statutory ideas, or analytical categories introduced"],
  "evidence_quality": "one of: citation_backed, reasoning_backed, assertion_only, incomplete, mixed",
  "reasoning": "one concise sentence explaining why this extraction follows from the diff"
}`;
}

function sanitizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => toPublicRevisionText(item).trim())
    .filter(Boolean)
    .slice(0, 8);
}

function sanitizeSemantics(value: Record<string, unknown>, fallbackThesis: string): RevisionSemantics {
  const contributionType = typeof value.contribution_type === 'string' && CONTRIBUTION_TYPES.has(value.contribution_type)
    ? value.contribution_type as ContributionType
    : 'mixed';
  const contributionScope = typeof value.contribution_scope === 'string' && CONTRIBUTION_SCOPES.has(value.contribution_scope)
    ? value.contribution_scope as ContributionScope
    : 'local';
  const significance = typeof value.significance === 'string' && SIGNIFICANCE_LEVELS.has(value.significance)
    ? value.significance as ScholarlySignificance
    : 'meaningful';
  const evidenceQuality = typeof value.evidence_quality === 'string' && EVIDENCE_QUALITIES.has(value.evidence_quality)
    ? value.evidence_quality as EvidenceQuality
    : 'mixed';

  return {
    contribution_thesis: typeof value.contribution_thesis === 'string' && value.contribution_thesis.trim()
      ? toPublicRevisionText(value.contribution_thesis).slice(0, 220)
      : fallbackThesis,
    contribution_type: contributionType,
    contribution_scope: contributionScope,
    significance,
    claims_added: sanitizeArray(value.claims_added),
    concepts_introduced: sanitizeArray(value.concepts_introduced),
    evidence_quality: evidenceQuality,
    reasoning: typeof value.reasoning === 'string'
      ? toPublicRevisionText(value.reasoning).slice(0, 500)
      : 'Derived from the textual difference between the previous and current revision.',
  };
}

export async function extractRevisionSemantics(revisionId: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[revision-semantics] OPENROUTER_API_KEY not configured');
    return { success: false, error: 'OPENROUTER_API_KEY not configured' };
  }

  const model = getModel();

  try {
    const supabase = getSupabaseClient();

    const { data: revision, error: revisionError } = await supabase
      .from('revisions')
      .select(`
        id, node_id, report_content, tier1_content, commit_message, created_at,
        nodes!revisions_node_id_fkey ( title, node_type )
      `)
      .eq('id', revisionId)
      .single();

    if (revisionError || !revision) {
      return { success: false, error: `Revision not found: ${revisionError?.message}` };
    }

    const revisionRow = revision as unknown as RevisionRow;
    const nodeData = Array.isArray(revisionRow.nodes) ? revisionRow.nodes[0] : revisionRow.nodes;
    const currentContent = normalizeContent(revisionRow);

    if (currentContent.trim().length < 20) {
      return { success: false, error: 'Revision content too short for semantic extraction' };
    }

    const { data: previousRevision } = await supabase
      .from('revisions')
      .select('report_content, tier1_content')
      .eq('node_id', revisionRow.node_id)
      .lt('created_at', revisionRow.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousContent = normalizeContent(previousRevision);

    // ── MINIMUM DELTA GATE (Low-signal heuristic) ──
    // Skip AI for trivial changes after translating storage/editor Markdown
    // into public scholarly text.
    // NOTE: This is a temporary heuristic, not semantic truth.
    // Small edits CAN be highly meaningful (e.g., "shall" → "may").
    const visiblePrev = normalizePublicRevisionText(previousContent);
    const visibleCurr = normalizePublicRevisionText(currentContent);
    const visibleDelta = Math.abs(visibleCurr.length - visiblePrev.length);

    if (visibleDelta < 20 && previousContent.length > 0) {
      console.log(`[revision-semantics] Low-signal change (${visibleDelta} chars) — auto-classifying as minor`);
      const fallbackThesis = toPublicRevisionText(revisionRow.commit_message || 'Minor formatting or whitespace adjustment');
      const autoSemantics = {
        revision_id: revisionId,
        contribution_thesis: fallbackThesis,
        contribution_type: 'mixed' as const,
        contribution_scope: 'local' as const,
        significance: 'minor' as const,
        claims_added: [] as string[],
        concepts_introduced: [] as string[],
        evidence_quality: 'mixed' as const,
        reasoning: `Change below minimum threshold for AI analysis (${visibleDelta} visible chars).`,
        extraction_model: 'auto-minor',
        extracted_at: new Date().toISOString(),
      };
      await supabase.from('revision_semantics').upsert(autoSemantics, { onConflict: 'revision_id' });
      return { success: true };
    }

    const diff = compactDiff(previousContent, currentContent);
    const fallbackThesis = toPublicRevisionText(revisionRow.commit_message || `Updated ${nodeData?.title || 'article'}`);

    const prompt = buildPrompt({
      nodeTitle: nodeData?.title || 'Untitled node',
      nodeType: nodeData?.node_type || 'topic',
      commitMessage: revisionRow.commit_message || '',
      previousContent,
      currentContent,
      diff,
    });

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://thesiddhant.in',
        'X-Title': 'Siddhant Legal Platform',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `OpenRouter API error: ${response.status} - ${errText}` };
    }

    const data = await response.json();
    let rawOutput = data.choices?.[0]?.message?.content;

    if (!rawOutput && typeof data.choices?.[0]?.message?.reasoning === 'string') {
      const jsonMatch = data.choices[0].message.reasoning.match(/\{[\s\S]*\}/);
      rawOutput = jsonMatch?.[0];
    }

    if (!rawOutput) {
      return { success: false, error: 'Empty response from revision semantics model' };
    }

    let cleaned = rawOutput.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { success: false, error: 'Failed to parse revision semantics JSON' };
    }

    const semantics = sanitizeSemantics(parsed, fallbackThesis);

    const { error: upsertError } = await supabase
      .from('revision_semantics')
      .upsert({
        revision_id: revisionId,
        contribution_thesis: semantics.contribution_thesis,
        contribution_type: semantics.contribution_type,
        contribution_scope: semantics.contribution_scope,
        significance: semantics.significance,
        claims_added: semantics.claims_added,
        concepts_introduced: semantics.concepts_introduced,
        evidence_quality: semantics.evidence_quality,
        reasoning: semantics.reasoning,
        extraction_model: model,
        extracted_at: new Date().toISOString(),
      }, { onConflict: 'revision_id' });

    if (upsertError) {
      return { success: false, error: `Supabase upsert failed: ${upsertError.message}` };
    }

    return { success: true };
  } catch (err) {
    console.error('[revision-semantics] Unexpected error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown extraction error' };
  }
}
