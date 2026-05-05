'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import ContributionReviewDrawer from './ContributionReviewDrawer';
import './spotlight.css';

interface ContributorSpotlightProps {
  revision: any;
  previousRevision: any;
  slug: string;
  revisionCount: number;
  user: any;
  allRevisionIds?: string[];
  currentUserRole?: string | null;
}

export default function ContributorSpotlight({
  revision,
  previousRevision,
  slug,
  revisionCount,
  user,
  allRevisionIds,
  currentUserRole
}: ContributorSpotlightProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (!revision) return null;

  const profileData = Array.isArray(revision.profiles) ? revision.profiles[0] : revision.profiles;
  const authorName = profileData?.username || 'Unknown';
  const authorRole = profileData?.role || 'contributor';
  
  const date = new Date(revision.created_at);
  const dateFormatted = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  
  // Calculate size delta
  const sizeDelta = (revision.content_size ?? 0) - (previousRevision?.content_size ?? 0);
  const isFirst = revisionCount === 1;

  const isOwnEdit = user?.id === revision.author_id;

  return (
    <div className="spotlight-container">
      <div className="spotlight-banner-v2">
        <div className="spotlight-left">
          <div className="contributor-avatar-v2">
            {authorName.charAt(0).toUpperCase()}
          </div>
          <div className="spotlight-info">
            <h4>
              Last updated by <Link href={`/profile/${authorName}`} className="spotlight-author">@{authorName}</Link>
              {sizeDelta !== 0 && (
                <span className={`change-summary ${sizeDelta < 0 ? 'del' : ''}`} style={sizeDelta < 0 ? { background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444' } : {}}>
                  {sizeDelta > 0 ? '▲' : '▼'} {Math.abs(sizeDelta).toLocaleString()} chars
                </span>
              )}
            </h4>
            <div className="spotlight-meta-v2">
              {dateFormatted} · {revisionCount} total revisions recorded
            </div>
          </div>
        </div>

        <div className="spotlight-right-v2">
          {user && !isOwnEdit && (
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="review-trigger-btn-v2"
            >
              <span>⚖️ Review & Endorse</span>
            </button>
          )}
          <Link href={`/topic/${slug}/history`} className="spotlight-history-link">
            Full History →
          </Link>
        </div>
      </div>

      {isDrawerOpen && (
        <ContributionReviewDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          revision={revision}
          previousRevision={previousRevision}
          authorName={authorName}
          slug={slug}
          allRevisionIds={allRevisionIds}
          currentUserRole={currentUserRole}
        />
      )}
    </div>
  );
}
