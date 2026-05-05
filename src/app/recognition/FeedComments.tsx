'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { 
  postActivityComment, 
  getActivityComments, 
  deleteActivityComment,
  ActivityComment,
  ActivityCommentTargetType
} from '@/app/actions/activity-comments';

interface FeedCommentsProps {
  targetType: ActivityCommentTargetType;
  targetId: string;
  currentUser: any;
  nodeSlug?: string;
}

/**
 * SIDDHANT: Feed Item Comments
 * 
 * A lightweight comment system for activities in the recognition feed.
 * Allows users to discuss specific edits, endorsements, and awards.
 */
export default function FeedComments({ targetType, targetId, currentUser, nodeSlug }: FeedCommentsProps) {
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch comments on mount
  useEffect(() => {
    async function loadComments() {
      const { comments: fetched, error: fetchError } = await getActivityComments(targetType, targetId);
      if (fetchError) {
        setError(fetchError);
      } else {
        setComments(fetched);
      }
      setIsLoading(false);
    }
    loadComments();
  }, [targetType, targetId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isPending) return;

    setError(null);
    startTransition(async () => {
      const res = await postActivityComment(targetType, targetId, newComment, nodeSlug);
      
      if (res.success) {
        setNewComment('');
        // Refresh comments list
        const { comments: updated } = await getActivityComments(targetType, targetId);
        setComments(updated);
      } else {
        setError(res.error || 'Failed to post comment');
      }
    });
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    const res = await deleteActivityComment(commentId, nodeSlug);
    if (res.success) {
      setComments(comments.filter(c => c.id !== commentId));
    } else {
      alert(res.error || 'Failed to delete comment');
    }
  };

  if (isLoading) {
    return <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '10px 0' }}>Loading discussion...</div>;
  }

  return (
    <div className="comments-container">
      <div className="comment-list">
        {comments.map((comment) => (
          <div key={comment.id} className="comment-entry">
            <div className="comment-avatar-sm">
              {comment.profiles?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="comment-bubble">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="comment-author-name">@{comment.profiles?.username}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="comment-body">{comment.content}</div>
              {currentUser?.id === comment.author_id && (
                <button 
                  onClick={() => handleDelete(comment.id)} 
                  style={{ 
                    background: 'none', border: 'none', color: '#ef4444', 
                    cursor: 'pointer', fontSize: '0.65rem', padding: '4px 0 0' 
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}

        {comments.length === 0 && !isPending && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px' }}>
            No scholarly discourse here yet. Start the conversation?
          </p>
        )}
      </div>

      {currentUser && (
        <form onSubmit={handleSubmit} className="comment-input-wrap">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add to the reasoning..."
            disabled={isPending}
          />
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={isPending || !newComment.trim()}
            style={{ padding: '8px 20px', fontSize: '0.75rem' }}
          >
            {isPending ? '...' : 'Post'}
          </button>
        </form>
      )}

      {error && (
        <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '10px', textAlign: 'center' }}>
          {error}
        </div>
      )}
    </div>
  );
}

