'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { RecognitionFeedItem, getRevisionDiffContext } from '@/app/actions/recognition-feed';
import { toggleAcknowledge, toggleInsightful } from '@/app/actions/contributions';
import { computeWordDiff } from '@/utils/diff-logic';
import {
  actorIdentityFor,
  getRoleMeta, getReputationPoints, getImpactStatement,
  getContributionStatus, getContributionType,
  STATUS_META, TYPE_META,
} from './feedUtils';
import { displayNameFor, identityLineFor, initialFor, interestLineFor } from '@/app/utils/scholarlyIdentity';
import FeedComments from './FeedComments';

interface RevisionCardProps {
  item: RecognitionFeedItem;
  currentUser: any;
  initialAcknowledged?: boolean;
  initialEndorsed?: boolean;
}

function formatTaxonomyLabel(value?: string | null): string | null {
  if (!value) return null;
  return value
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatSignificance(value?: string | null): string | null {
  const label = formatTaxonomyLabel(value);
  return label ? `${label} significance` : null;
}

function formatEvidenceQuality(value?: string | null): string | null {
  const label = formatTaxonomyLabel(value);
  return label ? `${label} evidence` : null;
}

/**
 * SIDDHANT: Revision Card — Compact Contribution Card
 * 
 * Shows edits with impact signals: contribution type (substantive/minor/metadata),
 * acceptance status, reputation points, and author authority.
 * Compact layout — less visual weight than endorsement/star cards.
 */
export default function RevisionCard({
  item,
  currentUser,
  initialAcknowledged = false,
  initialEndorsed = false,
}: RevisionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [diffContext, setDiffContext] = useState<any>(null);
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [voted, setVoted] = useState(initialAcknowledged);
  const [endorsed, setEndorsed] = useState(initialEndorsed);
  const [isActionPending, startActionTransition] = useTransition();
  // Visual feedback state
  const [justActivatedAck, setJustActivatedAck] = useState(false);
  const [justActivatedEnd, setJustActivatedEnd] = useState(false);
  const [showAckRep, setShowAckRep] = useState(false);
  const [showEndRep, setShowEndRep] = useState(false);
  const [ackCreditText, setAckCreditText] = useState('Author credited');
  const [endCreditText, setEndCreditText] = useState('Author credited');
  const [actionError, setActionError] = useState<string | null>(null);

  const actorRole = getRoleMeta(item.actor_role);
  const status = getContributionStatus(item);
  const statusMeta = STATUS_META[status];
  const contribType = getContributionType(item.detail_size, item.detail_category);
  const typeMeta = TYPE_META[contribType];
  const points = getReputationPoints(item.activity_type, item.detail_size, item.detail_category);
  const impact = getImpactStatement(item);
  const actorIdentity = actorIdentityFor(item);
  const actorDisplayName = displayNameFor(actorIdentity);
  const actorIdentityLine = identityLineFor(actorIdentity);
  const actorInterestLine = interestLineFor(actorIdentity);
  const semanticThesis = item.contribution_thesis?.trim();
  const semanticType = formatTaxonomyLabel(item.contribution_type);
  const semanticScope = formatTaxonomyLabel(item.contribution_scope);
  const semanticSignificance = formatSignificance(item.scholarly_significance);
  const semanticEvidence = formatEvidenceQuality(item.evidence_quality);
  const concepts = (item.concepts_introduced || []).slice(0, 3);
  const claims = (item.claims_added || []).slice(0, 2);
  const hasCreditRecord = Boolean(
    semanticThesis ||
    semanticType ||
    semanticScope ||
    semanticSignificance ||
    semanticEvidence ||
    concepts.length > 0 ||
    claims.length > 0
  );
  const repLabel = status === 'accepted' ? `+${points} Rep` : `Eligible +${points} Rep`;

  const toggleDiff = async () => {
    if (isExpanded) { setIsExpanded(false); return; }
    setIsExpanded(true);
    if (!diffContext) {
      setIsLoadingDiff(true);
      const ctx = await getRevisionDiffContext(item.activity_id);
      setDiffContext(ctx);
      setIsLoadingDiff(false);
    }
  };

  const handleAcknowledge = () => {
    if (!currentUser || isActionPending) return;
    setActionError(null);
    startActionTransition(async () => {
      const res = await toggleAcknowledge(item.activity_id, item.node_slug || '');
      if (res.error) {
        setActionError(res.error);
        return;
      }
      if (res.action === 'added') {
        const awarded = typeof res.awardedPoints === 'number' ? res.awardedPoints : 0;
        setVoted(true);
        setJustActivatedAck(true);
        setAckCreditText(awarded > 0 ? `Author +${awarded}` : 'Already credited');
        setShowAckRep(true);
        setTimeout(() => setJustActivatedAck(false), 500);
        setTimeout(() => setShowAckRep(false), 2000);
      } else if (res.action === 'removed') {
        setVoted(false);
      }
    });
  };

  const handleInsightful = () => {
    if (!currentUser || isActionPending) return;
    setActionError(null);
    startActionTransition(async () => {
      const res = await toggleInsightful(item.activity_id, item.node_slug || '');
      if (res.error) {
        setActionError(res.error);
        return;
      }
      if (res.action === 'added') {
        const awarded = typeof res.awardedPoints === 'number' ? res.awardedPoints : 0;
        setEndorsed(true);
        setJustActivatedEnd(true);
        setEndCreditText(awarded > 0 ? `Author +${awarded}` : 'Already credited');
        setShowEndRep(true);
        setTimeout(() => setJustActivatedEnd(false), 500);
        setTimeout(() => setShowEndRep(false), 2000);
      } else if (res.action === 'removed') {
        setEndorsed(false);
      }
    });
  };

  const renderDiffMarkup = () => {
    if (!diffContext?.current) return <p className="rc-detail">{item.detail_text}</p>;
    const diffs = computeWordDiff(diffContext.previous?.content || '', diffContext.current.content);
    return (
      <div className="feed-diff-content">
        {diffs.map(([op, text], i) => (
          <span key={i} className={`diff-word ${op === 'insert' ? 'diff-plus' : op === 'delete' ? 'diff-minus' : ''}`}>
            {text}
          </span>
        ))}
      </div>
    );
  };

  // Status-based left border color
  const borderColor = statusMeta.color;

  return (
    <div className={`revision-card rc-status-${status}`} style={{ borderLeftColor: borderColor }}>
      {/* Header */}
      <div className="rc-header">
        <div
          className="rc-avatar"
          style={{ background: item.actor_profile_photo ? `url(${item.actor_profile_photo}) center / cover` : actorRole.color }}
        >
          {!item.actor_profile_photo && initialFor(actorIdentity)}
        </div>
        <div className="rc-info">
          <div className="rc-title">
            <Link href={`/profile/${item.actor_username}`} className="rc-actor-name">
              {actorDisplayName}
            </Link>
            <span className="rc-action-text"> ✍️ committed an edit</span>
          </div>
          {(actorIdentityLine || actorInterestLine) && (
            <div className="contributor-identity-line">
              {actorIdentityLine}
              {actorIdentityLine && actorInterestLine ? ' - ' : ''}
              {actorInterestLine}
            </div>
          )}
          <div className="rc-meta">
            <span className="role-badge-pill" style={{ color: actorRole.color, background: actorRole.bgTint }}>
              {actorRole.icon} {actorRole.label}
            </span>
            <span className="rc-meta-dot" />
            <span>{item.actor_reputation} Rep</span>
            <span className="rc-meta-dot" />
            <span>{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          </div>
        </div>
      </div>

      {/* Commit message */}
      <div className="rc-commit">
        {item.detail_text}
      </div>

      {hasCreditRecord && (
        <div className="rc-credit-record">
          <div className="rc-credit-kicker">Credited contribution</div>
          <p className="rc-credit-thesis">
            {semanticThesis || impact}
          </p>
          {(semanticType || semanticScope || semanticSignificance || semanticEvidence) && (
            <div className="rc-credit-taxonomy">
              {semanticType && <span>{semanticType}</span>}
              {semanticScope && <span>{semanticScope}</span>}
              {semanticSignificance && <span>{semanticSignificance}</span>}
              {semanticEvidence && <span>{semanticEvidence}</span>}
            </div>
          )}
          {(concepts.length > 0 || claims.length > 0) && (
            <div className="rc-credit-evidence">
              {concepts.length > 0 && (
                <div>
                  <strong>Concepts</strong>
                  <span>{concepts.join(', ')}</span>
                </div>
              )}
              {claims.length > 0 && (
                <div>
                  <strong>Claims</strong>
                  <span>{claims.join(' | ')}</span>
                </div>
              )}
            </div>
          )}
          <div className="rc-credit-ledger">
            Permanent revision record credited to {actorDisplayName}
            {item.activity_id ? ` #${item.activity_id.slice(0, 8)}` : ''}
          </div>
        </div>
      )}

      {/* Impact statement — ABOVE badges, prominent */}
      <div className="rc-impact">
        <span className="impact-statement-prominent">✦ {impact}</span>
      </div>

      {/* Status + Type + Impact Badges — hierarchical */}
      <div className="rc-badges">
        <span className="impact-badge" style={{ color: typeMeta.color, background: typeMeta.bgTint }}>
          {typeMeta.icon} {typeMeta.label}
        </span>
        <span className="impact-badge" style={{ color: statusMeta.color, background: statusMeta.bgTint }}>
          {statusMeta.icon} {statusMeta.label}
        </span>
        <span className={`impact-badge impact-badge-primary ${status === 'accepted' ? 'impact-badge-green' : 'impact-badge-muted'}`}>
          {repLabel}
        </span>
        {item.node_slug && (
          <Link href={`/topic/${item.node_slug}`} className="impact-badge impact-badge-link">
            § {item.node_title}
          </Link>
        )}
      </div>

      {/* Diff expansion */}
      {isExpanded && (
        <div className="feed-diff-container">
          {isLoadingDiff ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Loading diff context...
            </div>
          ) : (
            renderDiffMarkup()
          )}
        </div>
      )}

      {/* Footer actions — with visual feedback */}
      <div className="rc-footer">
        <div className="rc-actions">
          <button
            className={`action-pill ${voted ? 'active' : ''} ${justActivatedAck ? 'just-activated' : ''}`}
            onClick={handleAcknowledge}
            disabled={isActionPending}
          >
            {isActionPending && !endorsed ? '⏳' : '👏'} {voted ? 'Acknowledged' : 'Acknowledge'}
            {showAckRep && <span className="action-pill-rep">{ackCreditText}</span>}
          </button>
          <button
            className={`action-pill ${endorsed ? 'active' : ''} ${justActivatedEnd ? 'just-activated' : ''}`}
            onClick={handleInsightful}
            disabled={isActionPending}
          >
            {isActionPending && !voted ? '⏳' : '💡'} {endorsed ? 'Insightful' : 'Endorse'}
            {showEndRep && <span className="action-pill-rep">{endCreditText}</span>}
          </button>
        </div>
        <div className="rc-actions">
          <button onClick={toggleDiff} className="action-pill" style={{ color: 'var(--color-gold)' }}>
            {isExpanded ? 'Collapse' : 'Show Diff →'}
          </button>
          <button
            className={`action-pill ${showComments ? 'active' : ''}`}
            onClick={() => setShowComments(!showComments)}
          >
            💬 Discuss
          </button>
        </div>
      </div>

      {/* Error feedback — inline below buttons */}
      {actionError && (
        <div className="action-pill-error">
          ⚠ {actionError}
        </div>
      )}

      {showComments && (
        <div className="comments-drawer">
          <FeedComments
            targetType="revision"
            targetId={item.activity_id}
            currentUser={currentUser}
            nodeSlug={item.node_slug || undefined}
          />
        </div>
      )}
    </div>
  );
}
