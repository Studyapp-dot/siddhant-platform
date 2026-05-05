import React from 'react';
import Link from 'next/link';
import { getArticleEndorsementStats } from '@/app/actions/recognition-feed';

interface ArticleEndorsementBarProps {
  nodeId: string;
  slug: string;
}

/**
 * SIDDHANT: Article Endorsement Summary Bar
 * 
 * Displays aggregate trust signals for a node in a compact horizontal layout:
 *   ⭐ Stars · 💡 Insightful · 👏 Acknowledges
 * 
 * Design: Compact horizontal inline bar, not dominant but clearly visible.
 */
export default async function ArticleEndorsementBar({ nodeId, slug }: ArticleEndorsementBarProps) {
  const stats = await getArticleEndorsementStats(nodeId);

  // Don't show anything if there are no endorsements yet — keep it clean
  if (stats.acknowledges === 0 && stats.insightful === 0 && stats.scholar_stars === 0) {
    return null;
  }

  return (
    <div className="endorsement-bar">
      <div className="endorsement-stats">
        {stats.scholar_stars > 0 && (
          <span className="endorsement-pill" title={`${stats.scholar_stars} Scholar Stars awarded`}>
            <span className="endorsement-icon">⭐</span>
            <span className="endorsement-count">{stats.scholar_stars}</span>
          </span>
        )}
        
        {stats.insightful > 0 && (
          <span className="endorsement-pill" title={`${stats.insightful} Insightful endorsements`}>
            <span className="endorsement-icon">💡</span>
            <span className="endorsement-count">{stats.insightful}</span>
          </span>
        )}

        {stats.acknowledges > 0 && (
          <span className="endorsement-pill" title={`${stats.acknowledges} community acknowledgments`}>
            <span className="endorsement-icon">👏</span>
            <span className="endorsement-count">{stats.acknowledges}</span>
          </span>
        )}

        <span className="endorsement-divider" />

        <span className="endorsement-summary">
          Endorsed by <strong>{stats.unique_endorsers}</strong> {stats.unique_endorsers === 1 ? 'contributor' : 'contributors'}
        </span>

        <Link 
          href={`/topic/${slug}/history`} 
          className="endorsement-link"
        >
          View Full Record →
        </Link>
      </div>
    </div>
  );
}
