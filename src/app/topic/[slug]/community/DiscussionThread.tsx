'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { DiscussionEngine } from '@/app/components/community/DiscussionEngine';
import { submitComment, closeDiscussion } from '../discussion/actions';
import '@/app/community-core.css';

interface DiscussionThreadProps {
  allComments: any[];
  isLoggedIn: boolean;
  nodeId: string;
  slug: string;
  currentUserRole: string | null;
  currentUserId: string | null;
}

export default function DiscussionThread({
  allComments,
  isLoggedIn,
  nodeId,
  slug,
  currentUserRole,
  currentUserId,
}: DiscussionThreadProps) {
  const router = useRouter();

  const canClose = ['senior_scholar', 'steward', 'governance_council'].includes(currentUserRole || '');

  const handleReply = async (content: string, parentId: string) => {
    if (!isLoggedIn) return;
    
    const fd = new FormData();
    fd.append('slug', slug);
    fd.append('node_id', nodeId);
    fd.append('content', content);
    if (parentId) fd.append('parent_id', parentId);

    await submitComment(fd);
    router.refresh();
  };

  const handleClose = async (threadRootId: string, summary: string, citedUsers: string[]) => {
    const fd = new FormData();
    fd.append('slug', slug);
    fd.append('discussion_id', threadRootId);
    fd.append('closing_summary', summary);
    fd.append('cited_users', JSON.stringify(citedUsers));

    await closeDiscussion(fd);
    router.refresh();
  };

  // Format all comments for DiscussionEngine (flat list — buildTree will reconstruct)
  const formattedMessages = allComments.map(msg => ({
    id: msg.id,
    content: msg.content,
    created_at: msg.created_at,
    parent_id: msg.parent_id,
    status: msg.status || 'open',
    closing_summary: msg.closing_summary || null,
    closed_by_name: msg.closed_by_username || null,
    closed_at: msg.closed_at || null,
    author: {
      id: msg.profiles?.id || '',
      name: msg.profiles?.username || 'User',
      role: msg.profiles?.role || 'Contributor'
    }
  }));

  // Build the thread close handler — only for eligible users
  const threadCloseHandler = canClose ? {
    canClose: true,
    isParticipant: (threadParticipantIds: string[]) => {
      return currentUserId ? threadParticipantIds.includes(currentUserId) : false;
    },
    onClose: handleClose,
  } : null;

  return (
    <div>
      <DiscussionEngine
        messages={formattedMessages}
        space="report"
        currentUser={currentUserId ? { id: currentUserId, name: 'You' } : null}
        onReply={handleReply}
        threadCloseHandler={threadCloseHandler}
        showBottomForm={isLoggedIn}
      />
    </div>
  );
}
