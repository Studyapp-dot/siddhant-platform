'use client';

import React, { useState } from 'react';
import ContributionReviewDrawer from '@/app/components/ContributionReviewDrawer';

/**
 * Sidebar-compact Review & Endorse trigger.
 * Renders only the button + drawer — all metadata is handled by the server component sidebar.
 */
interface SidebarReviewTriggerProps {
  revision: any;
  previousRevision: any;
  authorName: string;
  slug: string;
  userId?: string;
  allRevisionIds?: string[];
  currentUserRole?: string | null;
  sizeDelta: number;
}

export default function SidebarReviewTrigger({
  revision,
  previousRevision,
  authorName,
  slug,
  userId,
  allRevisionIds,
  currentUserRole,
  sizeDelta,
}: SidebarReviewTriggerProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (!revision) return null;

  const isOwnEdit = userId === revision.author_id;

  return (
    <>
      {/* Size delta indicator */}
      {sizeDelta !== 0 && (
        <div className="sidebar-revision-delta" style={sizeDelta < 0 ? { color: '#ef4444' } : {}}>
          {sizeDelta > 0 ? '▲' : '▼'} {Math.abs(sizeDelta).toLocaleString()} chars
        </div>
      )}

      {/* Review & Endorse — only visible to logged-in users who aren't the author */}
      {userId && !isOwnEdit && (
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="sidebar-review-btn"
        >
          ⚖️ Review & Endorse
        </button>
      )}

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
    </>
  );
}
