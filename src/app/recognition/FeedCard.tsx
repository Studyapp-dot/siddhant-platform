'use client';

import React from 'react';
import { RecognitionFeedItem } from '@/app/actions/recognition-feed';
import ScholarStarCard from './ScholarStarCard';
import EndorsementCard from './EndorsementCard';
import RevisionCard from './RevisionCard';
import GenericCard from './GenericCard';

interface FeedCardProps {
  item: RecognitionFeedItem;
  currentUser: any;
  initialAcknowledged?: boolean;
  initialEndorsed?: boolean;
}

/**
 * SIDDHANT: Feed Card Router
 * 
 * Delegates to specialized card components based on activity_type.
 * Each card type has its own visual weight, layout, and interaction model.
 *
 * Card hierarchy (by visual dominance):
 *   Scholar Star  → Large,   full-width, gold glow
 *   Endorsement   → Medium,  purple accent
 *   Revision      → Compact, status-colored border
 *   Generic       → Compact, minimal
 */
export default function FeedCard({
  item,
  currentUser,
  initialAcknowledged = false,
  initialEndorsed = false,
}: FeedCardProps) {
  switch (item.activity_type) {
    case 'scholar_star':
      return (
        <ScholarStarCard
          item={item}
          currentUser={currentUser}
        />
      );

    case 'endorsement':
      return (
        <EndorsementCard
          item={item}
          currentUser={currentUser}
          initialEndorsed={initialEndorsed}
        />
      );

    case 'revision':
      return (
        <RevisionCard
          item={item}
          currentUser={currentUser}
          initialAcknowledged={initialAcknowledged}
          initialEndorsed={initialEndorsed}
        />
      );

    case 'group_post':
    case 'mentorship_started':
      return (
        <GenericCard
          item={item}
          currentUser={currentUser}
        />
      );

    default:
      return (
        <GenericCard
          item={item}
          currentUser={currentUser}
        />
      );
  }
}
