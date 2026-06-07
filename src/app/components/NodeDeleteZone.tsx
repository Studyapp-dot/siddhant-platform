'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { softDeleteNode } from '@/app/actions/node-delete';
import './node-delete-zone.css';

// ============================================================================
// NODE DELETE ZONE — Owner-only danger zone for soft-deleting a node.
//
// Hidden by default. Only visible when the logged-in user is the node creator.
// Requires typing the node title to confirm deletion.
// ============================================================================

interface NodeDeleteZoneProps {
  nodeId: string;
  nodeTitle: string;
}

export default function NodeDeleteZone({ nodeId, nodeTitle }: NodeDeleteZoneProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setError(null);
    const result = await softDeleteNode(nodeId);
    if (result.error) {
      setError(result.error);
      setDeleting(false);
    } else {
      router.push('/nodes');
    }
  }, [nodeId, router]);

  const titleMatch = confirmText.trim().toLowerCase() === nodeTitle.trim().toLowerCase();

  return (
    <div className="node-delete-zone">
      {!expanded ? (
        <button
          type="button"
          className="node-delete-trigger"
          onClick={() => setExpanded(true)}
        >
          🗑️ Delete this node
        </button>
      ) : (
        <div className="node-delete-panel">
          <h4 className="node-delete-title">⚠️ Delete Node</h4>
          <p className="node-delete-desc">
            This will soft-delete the node and all its paragraphs.
            The data is preserved and can be restored later.
          </p>
          <p className="node-delete-desc">
            Type <strong>{nodeTitle}</strong> to confirm:
          </p>
          <input
            type="text"
            className="node-delete-input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={nodeTitle}
            autoFocus
          />
          {error && <p className="node-delete-error">{error}</p>}
          <div className="node-delete-actions">
            <button
              type="button"
              className="para-editor-btn-cancel"
              onClick={() => { setExpanded(false); setConfirmText(''); setError(null); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="node-delete-btn-confirm"
              disabled={!titleMatch || deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting...' : 'Permanently delete node'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
