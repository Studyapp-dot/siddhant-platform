// ============================================================================
// SIDDHANT: Recognition Feed — Shared Utilities
//
// Single source of truth for role metadata, importance scoring, contribution
// status derivation, impact statements, and reputation point mapping.
// Used by all card components and the feed page.
// ============================================================================

import { RecognitionFeedItem } from '@/app/actions/recognition-feed';
import { diff_match_patch } from 'diff-match-patch';

// ─── Role Metadata ───────────────────────────────────────────────────────────

export interface RoleMeta {
  label: string;
  level: number;
  color: string;
  icon: string;
  multiplier: number;
  bgTint: string;
}

export const ROLE_META: Record<string, RoleMeta> = {
  reader:             { label: 'Reader',                 level: 1, color: '#94a3b8', icon: '👁',  multiplier: 0.5, bgTint: 'rgba(148,163,184,0.08)' },
  contributor:        { label: 'Contributor',            level: 2, color: '#c5a04f', icon: '✍️', multiplier: 1.0, bgTint: 'rgba(197,160,79,0.08)'  },
  recognized:         { label: 'Recognized Contributor', level: 3, color: '#22c55e', icon: '✅', multiplier: 1.5, bgTint: 'rgba(34,197,94,0.08)'   },
  senior_scholar:     { label: 'Senior Scholar',         level: 4, color: '#8b5cf6', icon: '🏛', multiplier: 2.0, bgTint: 'rgba(139,92,246,0.08)'  },
  steward:            { label: 'Steward',                level: 5, color: '#ef4444', icon: '🛡️', multiplier: 2.5, bgTint: 'rgba(239,68,68,0.08)'   },
  governance_council: { label: 'Governance Council',     level: 6, color: '#f59e0b', icon: '⚖️', multiplier: 2.5, bgTint: 'rgba(245,158,11,0.08)'  },
};

export function getRoleMeta(role: string): RoleMeta {
  return ROLE_META[role] || ROLE_META.contributor;
}

export function getRoleColor(role: string): string {
  return getRoleMeta(role).color;
}


// ─── Importance Scoring ──────────────────────────────────────────────────────

export const IMPORTANCE_MAP: Record<string, number> = {
  scholar_star: 5,
  endorsement: 4,
  coordinator_promoted: 4,
  mentorship_started: 3,
  quality_assessment: 3,
  revision_substantive: 3,
  revision_minor: 2,
  group_post: 1,
  quality_vote: 1,
  acknowledge: 1,
};

export function getImportanceScore(item: RecognitionFeedItem): number {
  if (item.activity_type === 'revision') {
    return item.detail_size >= 50 ? IMPORTANCE_MAP.revision_substantive : IMPORTANCE_MAP.revision_minor;
  }
  return IMPORTANCE_MAP[item.activity_type] ?? 1;
}


// ─── Contribution Status ─────────────────────────────────────────────────────

export type ContributionStatus = 'accepted' | 'pending' | 'rejected' | 'flagged';

export interface StatusMeta {
  label: string;
  color: string;
  icon: string;
  bgTint: string;
}

export const STATUS_META: Record<ContributionStatus, StatusMeta> = {
  accepted: { label: 'Accepted',  color: '#22c55e', icon: '✔', bgTint: 'rgba(34,197,94,0.10)' },
  pending:  { label: 'Pending',   color: '#f59e0b', icon: '⏳', bgTint: 'rgba(245,158,11,0.10)' },
  rejected: { label: 'Rejected',  color: '#ef4444', icon: '✗', bgTint: 'rgba(239,68,68,0.10)' },
  flagged:  { label: 'Flagged',   color: '#fb923c', icon: '⚑', bgTint: 'rgba(251,146,60,0.10)' },
};

export function getContributionStatus(item: RecognitionFeedItem): ContributionStatus {
  if (item.is_reverted) return 'rejected';
  if (item.is_flagged) return 'flagged';
  // If older than 72 hours and not reverted/flagged → accepted
  const ageMs = Date.now() - new Date(item.created_at).getTime();
  const seventyTwoHours = 72 * 60 * 60 * 1000;
  if (ageMs >= seventyTwoHours) return 'accepted';
  return 'pending';
}


// ─── Contribution Type ───────────────────────────────────────────────────────

export type ContributionType = 'substantive' | 'minor';

export interface TypeMeta {
  label: string;
  icon: string;
  color: string;
  bgTint: string;
}

export const TYPE_META: Record<ContributionType, TypeMeta> = {
  substantive: { label: 'Substantive', icon: '🔥', color: '#22c55e', bgTint: 'rgba(34,197,94,0.10)' },
  minor:       { label: 'Minor Edit',  icon: '·',  color: '#94a3b8', bgTint: 'rgba(148,163,184,0.08)' },
};

export function getContributionType(detailSize: number): ContributionType {
  return detailSize >= 50 ? 'substantive' : 'minor';
}


// ─── Reputation Points ───────────────────────────────────────────────────────

export function getReputationPoints(activityType: string, detailSize: number = 0): number {
  switch (activityType) {
    case 'scholar_star':       return 15;
    case 'endorsement':        return 10;
    case 'revision':           return detailSize >= 50 ? 5 : 2;
    case 'mentorship_started': return 5;
    case 'quality_assessment': return 3;
    case 'group_post':         return 1;
    case 'acknowledge':        return 1;
    case 'quality_vote':       return 1;
    default:                   return 0;
  }
}


// ─── Impact Statements ───────────────────────────────────────────────────────

export function getImpactStatement(item: RecognitionFeedItem): string {
  const title = item.node_title || 'the platform';
  const groupName = item.group_name || 'a subject group';

  switch (item.activity_type) {
    case 'scholar_star':
      return `Recognized exceptional scholarship on ${title}`;
    case 'endorsement':
      return `Validated analytical depth on ${title}`;
    case 'revision':
      if (item.detail_size >= 50) {
        return `Expanded coverage of ${title}`;
      }
      return `Refined accuracy of ${title}`;
    case 'quality_assessment':
      return `Advanced quality tier of ${title}`;
    case 'quality_vote':
      return `Assessed quality of ${title}`;
    case 'acknowledge':
      return `Affirmed contribution to ${title}`;
    case 'group_post':
      return `Contributed to the ${groupName} forum`;
    case 'mentorship_started':
      return `Began mentoring in ${groupName}`;
    default:
      return `Contributed to ${title}`;
  }
}


// --- Scholarly evidence rendering -----------------------------------------

export type ScholarlyEvidenceKind = 'added' | 'removed';

export interface ScholarlyEvidenceLine {
  kind: ScholarlyEvidenceKind;
  label: string;
  text: string;
}

export interface ScholarlyEvidenceRecord {
  thesis: string;
  sourceSummary: string | null;
  summaryIsWeak: boolean;
  lines: ScholarlyEvidenceLine[];
  hiddenCount: number;
  source: 'ai' | 'summary' | 'diff';
}

const WEAK_SUMMARY_PATTERNS = [
  /^added more detail\.?$/i,
  /^initial node creation\.?$/i,
  /^good addition thanks\.?$/i,
  /^ai mode content\.?$/i,
  /^removed links?\.?$/i,
  /^update\.?$/i,
  /^updated\.?$/i,
  /^edit\.?$/i,
  /^changes?\.?$/i,
  /^minor changes?\.?$/i,
];

function cleanEvidenceText(text: string, maxLength = 170): string {
  const cleaned = text
    .replace(/^[+\-*>#\s]+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}...`;
}

export function isWeakContributionSummary(summary?: string | null): boolean {
  const cleaned = summary?.trim();
  if (!cleaned) return true;
  if (cleaned.length < 16) return true;
  return WEAK_SUMMARY_PATTERNS.some(pattern => pattern.test(cleaned));
}

function normalizeSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const withCapital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(withCapital) ? withCapital : `${withCapital}.`;
}

function thesisFromEvidence(lines: ScholarlyEvidenceLine[], nodeTitle?: string | null): string {
  const firstAddition = lines.find(line => line.kind === 'added');
  if (firstAddition) {
    const target = nodeTitle ? ` in ${nodeTitle}` : '';
    return normalizeSentence(`Introduced ${firstAddition.text}${target}`);
  }

  const firstRemoval = lines.find(line => line.kind === 'removed');
  if (firstRemoval) {
    return normalizeSentence(`Removed weaker or outdated wording: ${firstRemoval.text}`);
  }

  return nodeTitle
    ? `Clarified the scholarly treatment of ${nodeTitle}.`
    : 'Clarified the scholarly treatment of the article.';
}

export function buildScholarlyEvidenceRecord(params: {
  previousContent?: string | null;
  currentContent?: string | null;
  sourceSummary?: string | null;
  nodeTitle?: string | null;
  aiThesis?: string | null;
  expanded?: boolean;
}): ScholarlyEvidenceRecord {
  const dmp = new diff_match_patch();
  const previous = params.previousContent || '';
  const current = params.currentContent || '';
  const diffs = dmp.diff_main(previous, current);
  dmp.diff_cleanupSemantic(diffs);

  const maxLines = params.expanded ? 10 : 4;
  const allLines: ScholarlyEvidenceLine[] = [];

  for (const [op, text] of diffs) {
    if (op === 0) continue;

    const kind: ScholarlyEvidenceKind = op === 1 ? 'added' : 'removed';
    const label = kind === 'added' ? 'Added contribution' : 'Removed wording';
    const fragments = text
      .split('\n')
      .map(fragment => cleanEvidenceText(fragment))
      .filter(fragment => fragment.length > 1 && !/^[.,;:()[\]{}]+$/.test(fragment));

    for (const fragment of fragments) {
      allLines.push({ kind, label, text: fragment });
    }
  }

  const sourceSummary = params.sourceSummary?.trim() || null;
  const summaryIsWeak = isWeakContributionSummary(sourceSummary);
  const lines = allLines.slice(0, maxLines);
  const aiThesis = params.aiThesis?.trim();
  const source = aiThesis ? 'ai' : summaryIsWeak ? 'diff' : 'summary';
  const thesis = aiThesis
    ? normalizeSentence(aiThesis)
    : summaryIsWeak
      ? thesisFromEvidence(lines, params.nodeTitle)
      : normalizeSentence(sourceSummary || '');

  return {
    thesis,
    sourceSummary,
    summaryIsWeak,
    lines,
    hiddenCount: Math.max(0, allLines.length - lines.length),
    source,
  };
}

export function getContributionThesisFromSummary(
  sourceSummary?: string | null,
  nodeTitle?: string | null,
): string {
  if (!isWeakContributionSummary(sourceSummary)) {
    return normalizeSentence(sourceSummary || '');
  }

  return nodeTitle
    ? `Recognized a substantive improvement to ${nodeTitle}.`
    : 'Recognized a substantive scholarly improvement.';
}


// ─── Endorsement Aggregation ─────────────────────────────────────────────────

export interface AggregatedEndorsement {
  targetRevisionId: string;
  nodeTitle: string | null;
  nodeSlug: string | null;
  recipientUsername: string | null;
  recipientId: string | null;
  endorsers: { username: string; role: string; reputation: number; createdAt: string }[];
  latestCreatedAt: string;
  // ── Evidence fields ──
  sourceRevisionId: string | null;
  sourceCommitMessage: string | null;
  contributionThesis: string | null;
  contributionType: string | null;
  scholarlySignificance: string | null;
  conceptsIntroduced: string[];
  claimsAdded: string[];
}

/**
 * Group endorsement + acknowledge items by their target revision (activity_id).
 * Returns aggregated groups (2+ items) and leftover singles.
 */
export function aggregateEndorsements(items: RecognitionFeedItem[]): {
  aggregated: AggregatedEndorsement[];
  remaining: RecognitionFeedItem[];
} {
  const endorseTypes = new Set(['endorsement', 'acknowledge']);
  const endorseItems = items.filter(i => endorseTypes.has(i.activity_type));
  const otherItems = items.filter(i => !endorseTypes.has(i.activity_type));

  // Group by the revision being endorsed (activity_id for endorsements points to the endorsement record,
  // but node_id + recipient_id is the actual grouping key)
  const groups = new Map<string, RecognitionFeedItem[]>();
  for (const item of endorseItems) {
    // Group by recipient + node — endorsements on the same person's work on the same article
    const key = `${item.recipient_id || 'none'}::${item.node_id || 'none'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const aggregated: AggregatedEndorsement[] = [];
  const singleEndorsements: RecognitionFeedItem[] = [];

  for (const [, group] of groups) {
    // Sort by reputation descending to show highest authority first
    const sorted = [...group].sort((a, b) => b.actor_reputation - a.actor_reputation);

    const uniqueEndorsersMap = new Map();
    for (const item of sorted) {
      if (!uniqueEndorsersMap.has(item.actor_username)) {
        uniqueEndorsersMap.set(item.actor_username, {
          username: item.actor_username,
          role: item.actor_role,
          reputation: item.actor_reputation,
          createdAt: item.created_at,
        });
      }
    }
    const uniqueEndorsers = Array.from(uniqueEndorsersMap.values());

    if (uniqueEndorsers.length >= 2) {
      aggregated.push({
        targetRevisionId: sorted[0].activity_id,
        nodeTitle: sorted[0].node_title,
        nodeSlug: sorted[0].node_slug,
        recipientUsername: sorted[0].recipient_username,
        recipientId: sorted[0].recipient_id,
        endorsers: uniqueEndorsers,
        latestCreatedAt: sorted[0].created_at,
        sourceRevisionId: sorted[0].source_revision_id || null,
        sourceCommitMessage: sorted[0].source_commit_message || null,
        contributionThesis: sorted[0].contribution_thesis || null,
        contributionType: sorted[0].contribution_type || null,
        scholarlySignificance: sorted[0].scholarly_significance || null,
        conceptsIntroduced: sorted[0].concepts_introduced || [],
        claimsAdded: sorted[0].claims_added || [],
      });
    } else {
      singleEndorsements.push(...group);
    }
  }

  return {
    aggregated,
    remaining: [...otherItems, ...singleEndorsements],
  };
}


// ─── Render Action Text ──────────────────────────────────────────────────────

export function renderActionText(item: RecognitionFeedItem): string {
  switch (item.activity_type) {
    case 'revision':
      return `committed an edit: ${item.detail_text}`;
    case 'scholar_star':
      return `awarded a ⭐ Scholar Star to @${item.recipient_username}`;
    case 'endorsement':
      return `marked @${item.recipient_username}'s work as 💡 Insightful`;
    case 'acknowledge':
      return `acknowledged @${item.recipient_username}'s contribution`;
    case 'quality_vote':
      return `voted for ${item.detail_category} tier assessment`;
    case 'quality_assessment':
      return `formally assessed quality as ${item.detail_category}`;
    case 'group_post':
      return `posted in ${item.group_name || 'a subject forum'} · ${item.detail_category || 'general'}`;
    case 'mentorship_started':
      return `began mentoring @${item.recipient_username} in ${item.group_name || 'a subject group'}`;
    default:
      return 'performed an action';
  }
}
