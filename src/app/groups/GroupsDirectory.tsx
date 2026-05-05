'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

// ============================================================================
// SIDDHANT: Groups Directory Client — Phase 4 Discovery Layer
//
// Client-side interactivity for the groups listing page:
//   - Search: filter groups by name or description
//   - Sort: alphabetical, by activity, by member count
//   - Recommendations: surface groups related to user's editing activity
//
// Design principles:
//   - Controls are understated and typographic
//   - No flashy filter bars or social-media dropdown menus
//   - Search feels like an academic catalog, not a search engine
//   - Recommendations are quiet suggestions, not algorithmic urgency
// ============================================================================

export interface GroupData {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  memberCount: number;
  reportCount: number;
  lastActivity: string | null;
  recentContributors: { username: string }[];
  isMember: boolean;
  isRecommended: boolean;
}

type SortMode = 'alpha' | 'active' | 'members';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function recencyClass(iso?: string | null): string {
  if (!iso) return '';
  const hoursAgo = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) return 'group-card--recent';
  if (hoursAgo < 72) return 'group-card--warm';
  return '';
}

export default function GroupsDirectory({ groups, isLoggedIn }: { groups: GroupData[]; isLoggedIn: boolean }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('active');
  const [showMyGroups, setShowMyGroups] = useState(false);

  const hasRecommendations = groups.some(g => g.isRecommended && !g.isMember);
  const hasMyGroups = groups.some(g => g.isMember);

  // Filter
  const filtered = useMemo(() => {
    let result = groups;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)
      );
    }

    // My groups filter
    if (showMyGroups) {
      result = result.filter(g => g.isMember);
    }

    return result;
  }, [groups, search, showMyGroups]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case 'alpha':
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'active':
        arr.sort((a, b) => {
          if (!a.lastActivity && !b.lastActivity) return a.name.localeCompare(b.name);
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        });
        break;
      case 'members':
        arr.sort((a, b) => b.memberCount - a.memberCount);
        break;
    }
    return arr;
  }, [filtered, sort]);

  // Separate recommended (not yet member) from the rest
  const recommended = sorted.filter(g => g.isRecommended && !g.isMember);
  const main = sorted;

  return (
    <>
      {/* Search + Sort Controls — understated, academic catalog feel */}
      <div className="groups-controls">
        <div className="groups-search-wrap">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="groups-search"
            id="groups-search-input"
          />
        </div>
        <div className="groups-sort">
          {isLoggedIn && hasMyGroups && (
            <button
              className={`groups-sort-btn ${showMyGroups ? 'active' : ''}`}
              onClick={() => setShowMyGroups(!showMyGroups)}
            >
              My Groups
            </button>
          )}
          <span className="groups-sort-label">Sort</span>
          {([
            ['active', 'Recent'],
            ['members', 'Largest'],
            ['alpha', 'A–Z'],
          ] as [SortMode, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`groups-sort-btn ${sort === key ? 'active' : ''}`}
              onClick={() => setSort(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations — quiet suggestion, not algorithmic urgency */}
      {!showMyGroups && !search.trim() && hasRecommendations && recommended.length > 0 && (
        <div className="groups-recommendations">
          <span className="groups-rec-label">Related to your work</span>
          <div className="groups-rec-list">
            {recommended.slice(0, 3).map(g => (
              <Link key={g.id} href={`/groups/${g.slug}`} className="groups-rec-chip">
                <span className="groups-rec-icon">{g.icon || '📚'}</span>
                <span className="groups-rec-name">{g.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main Directory */}
      <div className="groups-grid">
        {sorted.map(group => (
          <Link
            key={group.id}
            href={`/groups/${group.slug}`}
            className={`group-card ${recencyClass(group.lastActivity)}`}
          >
            <div className="group-card-header">
              <span className="group-card-icon">{group.icon || '📚'}</span>
              <div className="group-card-identity">
                <span className="group-card-name">{group.name}</span>
                {group.isMember && (
                  <span className="group-card-membership">Member</span>
                )}
              </div>
            </div>

            <div className="group-card-desc">{group.description}</div>

            <div className="group-card-footer">
              <div className="group-card-scope">
                <span className="group-card-stat">
                  {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                </span>
                {group.reportCount > 0 && (
                  <>
                    <span className="group-card-dot">·</span>
                    <span className="group-card-stat">
                      {group.reportCount} {group.reportCount === 1 ? 'report' : 'reports'}
                    </span>
                  </>
                )}
              </div>

              {group.lastActivity && (
                <div className="group-card-liveness">
                  {group.recentContributors.length > 0 && (
                    <div className="group-card-contributors">
                      {group.recentContributors.map((c, i) => (
                        <span key={i} className="group-card-avatar" title={`@${c.username}`}>
                          {c.username[0].toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="group-card-recency">{relativeTime(group.lastActivity)}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="groups-empty">
          {search.trim() ? (
            <>
              <div className="groups-empty-icon">🔍</div>
              <p>No groups match &ldquo;{search}&rdquo;</p>
            </>
          ) : showMyGroups ? (
            <>
              <div className="groups-empty-icon">🏛️</div>
              <p>You haven&apos;t joined any groups yet.</p>
            </>
          ) : (
            <>
              <div className="groups-empty-icon">📜</div>
              <p>No groups available.</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
