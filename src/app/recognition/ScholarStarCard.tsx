'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { RecognitionFeedItem, getRevisionDiffContext } from '@/app/actions/recognition-feed';
import {
  actorIdentityFor,
  buildScholarlyEvidenceRecord,
  getContributionThesisFromSummary,
  getImpactStatement,
  getReputationPoints,
  getRoleMeta,
  recipientIdentityFor,
} from './feedUtils';
import { displayNameFor, identityLineFor, initialFor, interestLineFor } from '@/app/utils/scholarlyIdentity';
import { SCHOLAR_STAR_CATEGORIES } from '@/app/actions/reputation-constants';
import FeedComments from './FeedComments';

interface ScholarStarCardProps {
  item: RecognitionFeedItem;
  currentUser: { id: string } | null;
}

type RevisionDiffContext = Awaited<ReturnType<typeof getRevisionDiffContext>>;

export default function ScholarStarCard({ item, currentUser }: ScholarStarCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [diffResult, setDiffResult] = useState<{
    status: 'loading' | 'loaded';
    data: RevisionDiffContext | null;
  }>(() => ({
    status: item.source_revision_id ? 'loading' : 'loaded',
    data: null,
  }));
  const [diffExpanded, setDiffExpanded] = useState(false);

  const giverRole = getRoleMeta(item.actor_role);
  const points = getReputationPoints(item.activity_type);
  const impact = getImpactStatement(item);
  const fallbackThesis = item.contribution_thesis
    || getContributionThesisFromSummary(item.source_commit_message, item.node_title);
  const giverIdentity = actorIdentityFor(item);
  const recipientIdentity = recipientIdentityFor(item);
  const giverDisplayName = displayNameFor(giverIdentity);
  const recipientDisplayName = displayNameFor(recipientIdentity);
  const giverIdentityLine = identityLineFor(giverIdentity);
  const giverInterestLine = interestLineFor(giverIdentity);
  const recipientIdentityLine = identityLineFor(recipientIdentity);
  const recipientInterestLine = interestLineFor(recipientIdentity);

  const categoryKey = item.detail_category as keyof typeof SCHOLAR_STAR_CATEGORIES | null;
  const categoryInfo = categoryKey && SCHOLAR_STAR_CATEGORIES[categoryKey]
    ? SCHOLAR_STAR_CATEGORIES[categoryKey]
    : null;

  useEffect(() => {
    if (!item.source_revision_id || diffResult.data) return;

    let cancelled = false;
    getRevisionDiffContext(item.source_revision_id)
      .then(ctx => {
        if (!cancelled) setDiffResult({ status: 'loaded', data: ctx });
      })
      .catch(() => {
        if (!cancelled) setDiffResult({ status: 'loaded', data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [item.source_revision_id, diffResult.data]);

  const renderScholarlyEvidence = () => {
    if (!diffResult.data?.current) return null;

    const record = buildScholarlyEvidenceRecord({
      previousContent: diffResult.data.previous?.content,
      currentContent: diffResult.data.current.content,
      sourceSummary: item.source_commit_message,
      nodeTitle: item.node_title,
      aiThesis: item.contribution_thesis,
      expanded: diffExpanded,
    });
    const semanticBadges = [
      item.contribution_type,
      item.contribution_scope,
      item.scholarly_significance,
      item.evidence_quality,
    ].filter(Boolean);

    return (
      <section className="scholarly-evidence-record scholarly-evidence-record-star">
        <div className="ser-label">
          Contribution thesis
          {record.source === 'ai' && <span className="ser-ai-label">AI extracted</span>}
        </div>
        <p className="ser-thesis">{record.thesis}</p>

        {semanticBadges.length > 0 && (
          <div className="ser-semantic-badges">
            {semanticBadges.map(value => (
              <span key={value} className="ser-semantic-badge">
                {String(value).replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {(item.claims_added?.length || item.concepts_introduced?.length) ? (
          <div className="ser-claims-grid">
            {item.claims_added && item.claims_added.length > 0 && (
              <div>
                <span className="ser-mini-label">Claims added</span>
                <ul>
                  {item.claims_added.slice(0, 3).map(claim => (
                    <li key={claim}>{claim}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.concepts_introduced && item.concepts_introduced.length > 0 && (
              <div>
                <span className="ser-mini-label">Concepts introduced</span>
                <ul>
                  {item.concepts_introduced.slice(0, 3).map(concept => (
                    <li key={concept}>{concept}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {record.lines.length > 0 && (
          <div className="ser-lines" aria-label="Scholarly evidence">
            {record.lines.map((line, i) => (
              <div key={`${line.kind}-${i}`} className={`ser-line ser-line-${line.kind}`}>
                <span className="ser-line-label">{line.label}</span>
                <span className="ser-line-text">{line.text}</span>
              </div>
            ))}
          </div>
        )}

        <div className="ser-meta-row">
          {record.sourceSummary && (
            <span className={`ser-source-summary ${record.summaryIsWeak ? 'is-weak' : ''}`}>
              Source edit summary: &quot;{record.sourceSummary}&quot;
            </span>
          )}
          {record.summaryIsWeak && (
            <span className="ser-weak-note">Needs structured summary</span>
          )}
          {item.semantic_reasoning && (
            <span className="ser-source-summary">
              AI reasoning: {item.semantic_reasoning}
            </span>
          )}
        </div>

        {record.hiddenCount > 0 && !diffExpanded && (
          <button className="ser-expand" onClick={() => setDiffExpanded(true)}>
            Show {record.hiddenCount} more evidence lines
          </button>
        )}
      </section>
    );
  };

  return (
    <div className="scholar-star-card">
      <div className="ssc-accent-bar" />

      <div className="ssc-header">
        <span className="ssc-award-icon">Star</span>
        <span className="ssc-award-label">Scholar Star Awarded</span>
        {categoryInfo && (
          <span className="ssc-category-badge">
            {categoryInfo.icon} {categoryInfo.label}
          </span>
        )}
      </div>

      <div className="ssc-participants">
        <div className="ssc-person">
          <div
            className="ssc-avatar"
            style={{ background: item.actor_profile_photo ? `url(${item.actor_profile_photo}) center / cover` : giverRole.color }}
          >
            {!item.actor_profile_photo && initialFor(giverIdentity)}
          </div>
          <div className="ssc-person-info">
            <Link href={`/profile/${item.actor_username}`} className="ssc-person-name">
              {giverDisplayName}
            </Link>
            {(giverIdentityLine || giverInterestLine) && (
              <span className="contributor-identity-line compact">
                {giverIdentityLine}
                {giverIdentityLine && giverInterestLine ? ' - ' : ''}
                {giverInterestLine}
              </span>
            )}
            <span className="ssc-role-badge" style={{ color: giverRole.color, background: giverRole.bgTint }}>
              {giverRole.icon} {giverRole.label}
            </span>
          </div>
        </div>

        <div className="ssc-arrow">to</div>

        <div className="ssc-person">
          <div
            className="ssc-avatar ssc-avatar-recipient"
            style={item.recipient_profile_photo ? { background: `url(${item.recipient_profile_photo}) center / cover` } : undefined}
          >
            {!item.recipient_profile_photo && initialFor(recipientIdentity)}
          </div>
          <div className="ssc-person-info">
            <Link href={`/profile/${item.recipient_username}`} className="ssc-person-name">
              {recipientDisplayName}
            </Link>
            {(recipientIdentityLine || recipientInterestLine) && (
              <span className="contributor-identity-line compact">
                {recipientIdentityLine}
                {recipientIdentityLine && recipientInterestLine ? ' - ' : ''}
                {recipientInterestLine}
              </span>
            )}
            <span className="ssc-recipient-label">Recipient</span>
          </div>
        </div>
      </div>

      <div className="ssc-justification">
        <div className="ssc-quote-block">
          <p className="ssc-justification-text">{item.detail_text}</p>
        </div>
      </div>

      {!diffResult.data && diffResult.status === 'loaded' && (
        <section className="scholarly-evidence-record scholarly-evidence-record-star">
          <div className="ser-label">
            Contribution thesis
            {item.contribution_thesis && <span className="ser-ai-label">AI extracted</span>}
          </div>
          <p className="ser-thesis">{fallbackThesis}</p>
          {item.source_commit_message && item.source_commit_message.length > 1 && (
            <div className="ser-meta-row">
              <span className="ser-source-summary">
                Source edit summary: &quot;{item.source_commit_message}&quot;
              </span>
            </div>
          )}
        </section>
      )}

      {diffResult.status === 'loading' && item.source_revision_id && (
        <div className="scholarly-evidence-record scholarly-evidence-record-star ser-loading">
          <span>Loading contribution evidence...</span>
        </div>
      )}

      {diffResult.status === 'loaded' && diffResult.data && renderScholarlyEvidence()}

      <div className="ssc-impact">
        <span className="impact-statement-prominent">* {impact}</span>
      </div>

      <div className="ssc-badges">
        <div className="ssc-badge-row">
          <span className="impact-badge impact-badge-gold impact-badge-primary">
            +{points} Rep
          </span>
          <span
            className="impact-badge impact-badge-authority"
            style={{ color: giverRole.color, background: giverRole.bgTint, border: `1px solid ${giverRole.color}25` }}
          >
            {giverRole.icon} {giverRole.multiplier}x Authority
          </span>
          {item.node_slug && (
            <Link href={`/topic/${item.node_slug}`} className="impact-badge impact-badge-link">
              Section: {item.node_title}
            </Link>
          )}
        </div>
      </div>

      <div className="ssc-footer">
        <span className="ssc-timestamp">
          {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <div className="ssc-footer-actions">
          {item.source_revision_id && item.node_slug && (
            <Link href={`/topic/${item.node_slug}/compare?rev=${item.source_revision_id}`} className="action-pill">
              View full diff
            </Link>
          )}
          <button
            className={`action-pill ${showComments ? 'active' : ''}`}
            onClick={() => setShowComments(!showComments)}
          >
            Discuss award
          </button>
        </div>
      </div>

      {showComments && (
        <div className="comments-drawer">
          <FeedComments
            targetType="scholar_star"
            targetId={item.activity_id}
            currentUser={currentUser}
            nodeSlug={item.node_slug || undefined}
          />
        </div>
      )}
    </div>
  );
}
