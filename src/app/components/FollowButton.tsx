'use client';

import React, { useTransition, useState } from 'react';
import { followNode, unfollowNode } from '@/app/actions/watchlist';

interface FollowButtonProps {
  nodeId: string;
  slug: string;
  isFollowing: boolean;
}

export default function FollowButton({ nodeId, slug, isFollowing }: FollowButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    startTransition(async () => {
      if (isFollowing) {
        await unfollowNode(nodeId, slug);
      } else {
        await followNode(nodeId, slug);
        // Show tooltip briefly after following
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 3000);
      }
    });
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="btn-wiki-follow"
        style={{
          opacity: isPending ? 0.6 : 1,
          transition: 'all 0.2s ease',
        }}
      >
        {isPending ? '...' : isFollowing ? '★ Watching' : '☆ Follow updates'}
      </button>
      {/* Subtle confirmation tooltip */}
      {showTooltip && !isPending && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 12px',
          borderRadius: '8px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-md)',
          animation: 'fadeIn 0.2s ease',
          zIndex: 10,
        }}>
          You'll be notified of revisions
        </div>
      )}
    </div>
  );
}
