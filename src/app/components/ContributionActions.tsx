'use client';

import React, { useState, useTransition } from 'react';
import { toggleAcknowledge, toggleInsightful } from '@/app/actions/contributions';

// ============================================================================
// SIDDHANT: Community Recognition Buttons
//
// 👏 Acknowledge — Quick professional nod (+1 rep)
// 💡 Insightful  — "This deepened my understanding" (+10 rep)
//
// Design philosophy: These must feel like LinkedIn endorsements, not Reddit
// upvotes. Every click should carry weight. The UI must communicate prestige.
// ============================================================================


/**
 * 👏 Acknowledge — A professional nod of recognition.
 * "I see your work, and it's good."
 */
export function AcknowledgeButton({
  revisionId, slug, initialCount, hasVoted
}: {
  revisionId: string; slug: string; initialCount: number; hasVoted: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [voted, setVoted] = useState(hasVoted);
  const [count, setCount] = useState(initialCount);
  const [showPulse, setShowPulse] = useState(false);

  const handleClick = () => {
    startTransition(async () => {
      const result = await toggleAcknowledge(revisionId, slug);
      if (result.action === 'added') {
        setVoted(true);
        setCount(c => c + 1);
        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 600);
      } else if (result.action === 'removed') {
        setVoted(false);
        setCount(c => Math.max(0, c - 1));
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`recognition-btn acknowledge-btn ${voted ? 'active' : ''} ${showPulse ? 'pulse' : ''}`}
      title={voted ? 'Remove acknowledgment' : 'Acknowledge this contribution'}
    >
      <span className="recognition-icon">{voted ? '👏' : '👏'}</span>
      <span className="recognition-label">Acknowledge</span>
      {count > 0 && <span className="recognition-count">{count}</span>}
    </button>
  );
}


/**
 * 💡 Insightful — "This contribution deepened my understanding."
 * Higher-weight recognition. More intentional than an acknowledgment.
 */
export function InsightfulButton({
  revisionId, slug, initialCount, hasEndorsed
}: {
  revisionId: string; slug: string; initialCount: number; hasEndorsed: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [endorsed, setEndorsed] = useState(hasEndorsed);
  const [count, setCount] = useState(initialCount);
  const [showPulse, setShowPulse] = useState(false);

  const handleClick = () => {
    startTransition(async () => {
      const result = await toggleInsightful(revisionId, slug);
      if (result.action === 'added') {
        setEndorsed(true);
        setCount(c => c + 1);
        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 600);
      } else if (result.action === 'removed') {
        setEndorsed(false);
        setCount(c => Math.max(0, c - 1));
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`recognition-btn insightful-btn ${endorsed ? 'active' : ''} ${showPulse ? 'pulse' : ''}`}
      title={endorsed ? 'Remove endorsement' : 'Mark this contribution as insightful'}
    >
      <span className="recognition-icon">{endorsed ? '💡' : '💡'}</span>
      <span className="recognition-label">Insightful</span>
      {count > 0 && <span className="recognition-count">{count}</span>}
    </button>
  );
}
