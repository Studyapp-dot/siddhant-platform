'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { RecognitionFeedItem, getRevisionDiffContext } from '@/app/actions/recognition-feed';
import { toggleAcknowledge, toggleInsightful } from '@/app/actions/contributions';
import { diff_match_patch } from 'diff-match-patch';
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

/**
 * SIDDHANT: Revision Card — Compact Contribution Card
 * 
 * Shows edits with impact signals: contribution type (substantive/minor),
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

  const actorRole = getRoleMeta(item.actor_role);
  const status = getContributionStatus(item);
  const statusMeta = STATUS_META[status];
  const contribType = getContributionType(item.detail_size);
  const typeMeta = TYPE_META[contribType];
  const points = getReputationPoints(item.activity_type, item.detail_size);
  const impact = getImpactStatement(item);
  const actorIdentity = actorIdentityFor(item);
  const actorDisplayName = displayNameFor(actorIdentity);
  const actorIdentityLine = identityLineFor(actorIdentity);
  const actorInterestLine = interestLineFor(actorIdentity);

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
    startActionTransition(async () => {
      const res = await toggleAcknowledge(item.activity_id, item.node_slug || '');
      if (res.action === 'added') setVoted(true);
      else if (res.action === 'removed') setVoted(false);
    });
  };

  const handleInsightful = () => {
    if (!currentUser || isActionPending) return;
    startActionTransition(async () => {
      const res = await toggleInsightful(item.activity_id, item.node_slug || '');
      if (res.action === 'added') setEndorsed(true);
      else if (res.action === 'removed') setEndorsed(false);
    });
  };

  const renderDiffMarkup = () => {
    if (!diffContext?.current) return <p className="rc-detail">{item.detail_text}</p>;
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(diffContext.previous?.content || '', diffContext.current.content);
    dmp.diff_cleanupSemantic(diffs);
    return (
      <div className="feed-diff-content">
        {diffs.map(([op, text], i) => (
          <span key={i} className={`diff-word ${op === 1 ? 'diff-plus' : op === -1 ? 'diff-minus' : ''}`}>
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
          +{points} Rep
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

      {/* Footer actions */}
      <div className="rc-footer">
        <div className="rc-actions">
          <button
            className={`action-pill ${voted ? 'active' : ''}`}
            onClick={handleAcknowledge}
            disabled={isActionPending}
          >
            👏 {voted ? 'Acknowledged' : 'Acknowledge'}
          </button>
          <button
            className={`action-pill ${endorsed ? 'active' : ''}`}
            onClick={handleInsightful}
            disabled={isActionPending}
          >
            💡 {endorsed ? 'Insightful' : 'Endorse'}
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
