'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { searchArchiveNodes } from '@/app/actions/authority-anchors';

// ============================================================================
// LINK INSERT MODAL — Search archive nodes or enter external URLs
// ============================================================================

const NODE_TYPE_ICONS: Record<string, string> = {
  topic: '📝', statute: '📜', chapter: '📖', section: '§',
  constitutional_provision: '🏛', judgment: '⚖️', doctrine: '💡', concept: '🧠',
};

interface LinkInsertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (markdownLink: string) => void;
  defaultLabel?: string;
}

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  node_type: string;
}

export default function LinkInsertModal({
  isOpen,
  onClose,
  onInsert,
  defaultLabel = '',
}: LinkInsertModalProps) {
  const [activeTab, setActiveTab] = useState<'archive' | 'external'>('archive');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalLabel, setExternalLabel] = useState(defaultLabel);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setExternalUrl('');
      setExternalLabel(defaultLabel);
      setActiveTab('archive');
      // Small delay to wait for modal animation
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultLabel]);

  // Debounced archive search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchArchiveNodes(value.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleArchiveSelect = useCallback(
    (node: SearchResult) => {
      onInsert(`[[${node.slug}|${node.title}]]`);
      onClose();
    },
    [onInsert, onClose]
  );

  const handleExternalInsert = useCallback(() => {
    const url = externalUrl.trim();
    const label = externalLabel.trim() || url;
    if (!url) return;
    onInsert(`[${label}](${url})`);
    onClose();
  }, [externalUrl, externalLabel, onInsert, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="link-modal-overlay" onClick={onClose}>
      <div className="link-modal" onClick={(e) => e.stopPropagation()}>
        <div className="link-modal-header">
          <span className="link-modal-title">Insert Link</span>
          <button
            type="button"
            className="link-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="link-modal-tabs">
          <button
            type="button"
            className={`link-tab ${activeTab === 'archive' ? 'active' : ''}`}
            onClick={() => setActiveTab('archive')}
          >
            Archive
          </button>
          <button
            type="button"
            className={`link-tab ${activeTab === 'external' ? 'active' : ''}`}
            onClick={() => setActiveTab('external')}
          >
            External
          </button>
        </div>

        {/* Archive Tab */}
        {activeTab === 'archive' && (
          <div className="link-modal-body">
            <input
              ref={searchInputRef}
              type="text"
              className="link-search-input"
              placeholder="Search topics by title..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              autoComplete="off"
            />

            <div className="link-search-results">
              {isSearching && (
                <div className="link-search-status">Searching...</div>
              )}
              {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="link-search-status">No topics found</div>
              )}
              {searchResults.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="link-search-result"
                  onClick={() => handleArchiveSelect(node)}
                >
                  <span className="link-result-icon">
                    {NODE_TYPE_ICONS[node.node_type] || '📝'}
                  </span>
                  <span className="link-result-info">
                    <span className="link-result-title">{node.title}</span>
                    <span className="link-result-slug">{node.slug}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* External Tab */}
        {activeTab === 'external' && (
          <div className="link-modal-body">
            <label className="link-field-label">URL</label>
            <input
              type="url"
              className="link-search-input"
              placeholder="https://..."
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              autoFocus
            />
            <label className="link-field-label" style={{ marginTop: '12px' }}>
              Label
            </label>
            <input
              type="text"
              className="link-search-input"
              placeholder="Display text"
              value={externalLabel}
              onChange={(e) => setExternalLabel(e.target.value)}
            />
            <button
              type="button"
              className="link-insert-btn"
              onClick={handleExternalInsert}
              disabled={!externalUrl.trim()}
            >
              Insert Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
