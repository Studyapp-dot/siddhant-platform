'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { DiscussionEngine } from '@/app/components/community/DiscussionEngine';
import type { ThreadType } from '@/app/components/community/DiscussionTypes';
import { submitComment, closeDiscussion } from './actions';
import '@/app/community-core.css';
import './discussion.css';

interface DiscussionThreadProps {
  allComments: any[];
  isLoggedIn: boolean;
  nodeId: string;
  slug: string;
  currentUserRole: string | null;
  currentUserId: string | null;
  voteCounts?: Record<string, { count: number; voted: boolean }>;
  followedThreadIds?: string[];
}

export default function DiscussionThread({
  allComments,
  isLoggedIn,
  nodeId,
  slug,
  currentUserRole,
  currentUserId,
  voteCounts = {},
  followedThreadIds = [],
}: DiscussionThreadProps) {
  const router = useRouter();

  const canClose = ['senior_scholar', 'steward', 'governance_council'].includes(currentUserRole || '');

  const handleReply = async (content: string, parentId: string, threadType?: ThreadType, referenceText?: string, referenceType?: string) => {
    if (!isLoggedIn) return;

    const fd = new FormData();
    fd.append('slug', slug);
    fd.append('node_id', nodeId);
    fd.append('content', content);
    if (parentId) fd.append('parent_id', parentId);
    if (threadType) fd.append('thread_type', threadType);
    if (referenceText) fd.append('reference_text', referenceText);
    if (referenceType) fd.append('reference_type', referenceType);

    await submitComment(fd);
    router.refresh();
  };

  const handleClose = async (threadRootId: string, summary: string, citedUsers: string[], impactSummary?: string) => {
    const fd = new FormData();
    fd.append('slug', slug);
    fd.append('discussion_id', threadRootId);
    fd.append('closing_summary', summary);
    fd.append('cited_users', JSON.stringify(citedUsers));
    if (impactSummary) fd.append('impact_summary', impactSummary);

    await closeDiscussion(fd);
    router.refresh();
  };

  const handleEndorse = async (messageId: string) => {
    const res = await fetch('/api/consensus-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discussion_id: messageId }),
    });
    if (res.ok) router.refresh();
  };

  const handleFollow = async (threadId: string) => {
    const res = await fetch('/api/thread-follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discussion_id: threadId }),
    });
    if (res.ok) router.refresh();
  };

  // Format comments for DiscussionEngine
  const formattedMessages = allComments.map(msg => ({
    id: msg.id,
    content: msg.content,
    created_at: msg.created_at,
    parent_id: msg.parent_id,
    thread_type: msg.thread_type || 'general',
    response_type: msg.response_type || 'reply',
    status: msg.status || 'open',
    closing_summary: msg.closing_summary || null,
    closed_by_name: msg.closed_by_username || null,
    closed_at: msg.closed_at || null,
    cited_participants: msg.cited_participants || [],
    impact_summary: msg.impact_summary || null,
    vote_count: voteCounts[msg.id]?.count || 0,
    user_voted: voteCounts[msg.id]?.voted || false,
    reference_text: msg.reference_text || null,
    reference_type: msg.reference_type || null,
    author: {
      id: msg.profiles?.id || '',
      name: msg.profiles?.username || 'User',
      role: msg.profiles?.role || 'registered',
      reputation: msg.profiles?.reputation_score,
    },
  }));

  const threadCloseHandler = canClose ? {
    canClose: true,
    isParticipant: (threadParticipantIds: string[]) => {
      return currentUserId ? threadParticipantIds.includes(currentUserId) : false;
    },
    onClose: handleClose,
  } : null;

  return (
    <DiscussionEngine
      messages={formattedMessages}
      space="report"
      currentUser={currentUserId ? { id: currentUserId, name: 'You' } : null}
      onReply={isLoggedIn ? handleReply : undefined}
      onEndorse={isLoggedIn ? handleEndorse : undefined}
      onFollow={isLoggedIn ? handleFollow : undefined}
      threadCloseHandler={threadCloseHandler}
      showBottomForm={isLoggedIn}
      followedThreadIds={new Set(followedThreadIds)}
    />
  );
}
