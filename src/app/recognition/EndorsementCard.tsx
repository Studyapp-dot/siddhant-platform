'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { RecognitionFeedItem, getRevisionDiffContext } from '@/app/actions/recognition-feed';
import { toggleInsightful } from '@/app/actions/contributions';
import {
  buildScholarlyEvidenceRecord,
  getContributionThesisFromSummary,
  getImpactStatement,
  getReputationPoints,
  getRoleMeta,
} from './feedUtils';
import FeedComments from './FeedComments';

interface EndorsementCardProps {
  item: RecognitionFeedItem;
  currentUser: { id: string } | null;
  initialEndorsed?: boolean;
}

type RevisionDiffContext = Awaited<ReturnType<typeof getRevisionDiffContext>>;

export default function EndorsementCard({
  item,
  currentUser,
  initialEndorsed = false,
}: EndorsementCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [endorsed, setEndorsed] = useState(initialEndorsed);
  const [isActionPending, startActionTransition] = useTransition();
  const [diffResult, setDiffResult] = useState<{
    status: 'loading' | 'loaded';
    data: RevisionDiffContext | null;
  }>(() => ({
    status: item.source_revision_id ? 'loading' : 'loaded',
    data: null,
  }));
  const [diffExpanded, setDiffExpanded] = useState(false);

  const actorRole = getRoleMeta(item.actor_role);
  const points = getReputationPoints(item.activity_type);
  const impact = getImpactStatement(item);
  const fallbackThesis = item.contribution_thesis
    || getContributionThesisFromSummary(item.source_commit_message, item.node_title);

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

  const handleEndorse = () => {
    if (!currentUser || isActionPending || !item.source_revision_id) return;

    startActionTransition(async () => {
      const res = await toggleInsightful(item.source_revision_id!, item.node_slug || '');
      if (res.action === 'added') setEndorsed(true);
      else if (res.action === 'removed') setEndorsed(false);
    });
  };

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
      <section className="scholarly-evidence-record">
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
    <div className="endorsement-card">
      <div className="ec-header">
        <div className="ec-avatar" style={{ background: actorRole.color }}>
          {item.actor_username.charAt(0).toUpperCase()}
        </div>
        <div className="ec-info">
          <div className="ec-title">
            <Link href={`/profile/${item.actor_username}`} className="ec-actor-name">
              @{item.actor_username}
            </Link>
            <span className="ec-action-text">
              {' '}marked{' '}
              <Link href={`/profile/${item.recipient_username}`} className="ec-recipient-name">
                @{item.recipient_username}
              </Link>
              {"'s work as "}
              <b>Insightful</b>
            </span>
          </div>
          <div className="ec-meta">
            <span className="role-badge-pill" style={{ color: actorRole.color, background: actorRole.bgTint }}>
              {actorRole.icon} {actorRole.label}
            </span>
            <span className="ec-meta-dot" />
            <span className="ec-weight">{actorRole.multiplier}x Weight</span>
            <span className="ec-meta-dot" />
            <span>{item.actor_reputation} Rep</span>
          </div>
        </div>
      </div>

      {!diffResult.data && diffResult.status === 'loaded' && (
        <section className="scholarly-evidence-record">
          <div className="ser-label">
            Contribution thesis
            {item.contribution_thesis && <span className="ser-ai-label">AI extracted</span>}
          </div>
          <p className="ser-thesis">{fallbackThesis}</p>
          {item.source_commit_message && (
            <div className="ser-meta-row">
              <span className="ser-source-summary">
                Source edit summary: &quot;{item.source_commit_message}&quot;
              </span>
            </div>
          )}
        </section>
      )}

      {diffResult.status === 'loading' && (
        <div className="scholarly-evidence-record ser-loading">
          <span>Loading contribution evidence...</span>
        </div>
      )}

      {diffResult.status === 'loaded' && diffResult.data && renderScholarlyEvidence()}

      <div className="ec-impact">
        <span className="impact-statement-prominent">* {impact}</span>
      </div>

      <div className="ec-badges">
        <span className="impact-badge impact-badge-purple impact-badge-primary">
          +{points} Rep
        </span>
        <span
          className="impact-badge impact-badge-authority"
          style={{ color: actorRole.color, background: actorRole.bgTint, border: `1px solid ${actorRole.color}25` }}
        >
          {actorRole.icon} {actorRole.multiplier}x Authority
        </span>
        {item.node_slug && (
          <Link href={`/topic/${item.node_slug}`} className="impact-badge impact-badge-link">
            Section: {item.node_title}
          </Link>
        )}
      </div>

      <div className="ec-footer">
        <span className="ec-timestamp">
          {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </span>
        <div className="ec-actions">
          {item.source_revision_id && item.node_slug && (
            <Link href={`/topic/${item.node_slug}/compare?rev=${item.source_revision_id}`} className="action-pill">
              Full diff
            </Link>
          )}
          <button
            className={`action-pill ${endorsed ? 'active' : ''}`}
            onClick={handleEndorse}
            disabled={isActionPending || !item.source_revision_id}
          >
            {endorsed ? 'Endorsed' : 'Endorse'}
          </button>
          <button
            className={`action-pill ${showComments ? 'active' : ''}`}
            onClick={() => setShowComments(!showComments)}
          >
            Discuss record
          </button>
        </div>
      </div>

      {showComments && (
        <div className="comments-drawer">
          <FeedComments
            targetType="endorsement"
            targetId={item.activity_id}
            currentUser={currentUser}
            nodeSlug={item.node_slug || undefined}
          />
        </div>
      )}
    </div>
  );
}
