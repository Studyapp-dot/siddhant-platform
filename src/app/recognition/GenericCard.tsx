'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RecognitionFeedItem } from '@/app/actions/recognition-feed';
import { actorIdentityFor, getRoleMeta, getReputationPoints, getImpactStatement, renderActionText } from './feedUtils';
import { displayNameFor, identityLineFor, initialFor, interestLineFor } from '@/app/utils/scholarlyIdentity';
import FeedComments from './FeedComments';
import type { ActivityCommentTargetType } from '@/app/actions/activity-comments';

interface GenericCardProps {
  item: RecognitionFeedItem;
  currentUser: { id: string } | null;
}

/**
 * SIDDHANT: Generic Card — Compact Fallback
 * 
 * Used for quality_vote, quality_assessment, acknowledge events.
 * Compact, information-dense, minimal visual weight.
 */
export default function GenericCard({ item, currentUser }: GenericCardProps) {
  const [showComments, setShowComments] = useState(false);

  const actorRole = getRoleMeta(item.actor_role);
  const points = getReputationPoints(item.activity_type, item.detail_size);
  const impact = getImpactStatement(item);
  const actionText = renderActionText(item);
  const actorIdentity = actorIdentityFor(item);
  const actorDisplayName = displayNameFor(actorIdentity);
  const actorIdentityLine = identityLineFor(actorIdentity);
  const actorInterestLine = interestLineFor(actorIdentity);
  const isQualityReport = item.activity_type === 'quality_assessment' || item.activity_type === 'quality_vote';
  const commentTargetType: ActivityCommentTargetType =
    item.activity_type === 'acknowledge' ? 'endorsement' : item.activity_type;

  return (
    <div className={`generic-card ${isQualityReport ? 'quality-report-card' : ''}`}>
      {/* Header */}
      <div className="gc-header">
        <div
          className="gc-avatar"
          style={{ background: item.actor_profile_photo ? `url(${item.actor_profile_photo}) center / cover` : actorRole.color }}
        >
          {!item.actor_profile_photo && initialFor(actorIdentity)}
        </div>
        <div className="gc-info">
          <div className="gc-title">
            <Link href={`/profile/${item.actor_username}`} className="gc-actor-name">
              {actorDisplayName}
            </Link>
            <span className="gc-action-text"> {actionText}</span>
          </div>
          {(actorIdentityLine || actorInterestLine) && (
            <div className="contributor-identity-line">
              {actorIdentityLine}
              {actorIdentityLine && actorInterestLine ? ' - ' : ''}
              {actorInterestLine}
            </div>
          )}
          <div className="gc-meta">
            <span className="role-badge-pill" style={{ color: actorRole.color, background: actorRole.bgTint }}>
              {actorRole.icon} {actorRole.label}
            </span>
            <span className="gc-meta-dot" />
            <span>{new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          </div>
        </div>
      </div>

      {isQualityReport ? (
        <section className="quality-report-body">
          <div className="quality-report-label">Scholarly review report</div>
          <p className="quality-report-title">
            {item.activity_type === 'quality_assessment'
              ? `Quality tier recorded as ${item.detail_category || 'under review'}`
              : `Quality vote submitted for ${item.detail_category || 'the current tier'}`}
          </p>
          {item.detail_text && (
            <p className="quality-report-rationale">{item.detail_text}</p>
          )}
          <div className="quality-report-criteria">
            <span>Rationale</span>
            <span>Tier movement</span>
            <span>Review trace</span>
          </div>
        </section>
      ) : item.detail_text && (
        <div className="gc-content">{item.detail_text}</div>
      )}

      {/* Badges */}
      <div className="gc-badges">
        {points > 0 && (
          <span className="impact-badge impact-badge-muted">+{points} Rep</span>
        )}
        {item.node_slug && (
          <Link href={`/topic/${item.node_slug}`} className="impact-badge impact-badge-link">
            § {item.node_title}
          </Link>
        )}
        {item.group_slug && (
          <Link href={`/groups/${item.group_slug}`} className="impact-badge impact-badge-link" style={{ borderColor: 'rgba(139, 92, 246, 0.25)', color: '#8b5cf6' }}>
            🏛 {item.group_name}
          </Link>
        )}
      </div>

      {/* Impact */}
      <div className="gc-impact">
        <span className="impact-statement-text">✦ {impact}</span>
      </div>

      {/* Footer */}
      <div className="gc-footer">
        <button
          className={`action-pill ${showComments ? 'active' : ''}`}
          onClick={() => setShowComments(!showComments)}
          style={{ marginLeft: 'auto' }}
        >
          💬 Discuss
        </button>
      </div>

      {showComments && (
        <div className="comments-drawer">
          <FeedComments
            targetType={commentTargetType}
            targetId={item.activity_id}
            currentUser={currentUser}
            nodeSlug={item.node_slug || undefined}
          />
        </div>
      )}
    </div>
  );
}
