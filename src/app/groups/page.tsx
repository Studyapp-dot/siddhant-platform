import React from 'react';
import { createClient } from '@/utils/supabase/server';
import GroupsDirectory, { type GroupData } from './GroupsDirectory';
import './groups.css';

// ============================================================================
// SIDDHANT: Subject Groups Directory — Phase 4 Discovery Layer
//
// Server component that fetches all group data + recommendation signals,
// then delegates rendering to GroupsDirectory (client component) for
// search, sort, and filter interactivity.
//
// Recommendation logic:
//   Users who have edited topics (nodes) that are associated with a group
//   via group_node_associations will see that group as "recommended."
//   This is lightweight domain matching, not algorithmic recommendation.
// ============================================================================

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all subject groups
  const { data: groups } = await supabase
    .from('subject_groups')
    .select('id, slug, name, description, icon')
    .order('name', { ascending: true });

  const groupIds = (groups ?? []).map(g => g.id);
  let memberCounts: Record<string, number> = {};
  let reportCounts: Record<string, number> = {};
  let lastActivity: Record<string, string> = {};
  let recentContributors: Record<string, { username: string }[]> = {};
  let userMemberships: Set<string> = new Set();
  let recommendedGroupIds: Set<string> = new Set();

  if (groupIds.length > 0) {
    // ── Member counts ──
    const { data: members } = await supabase
      .from('subject_group_members')
      .select('group_id, user_id')
      .in('group_id', groupIds);

    for (const m of (members ?? [])) {
      memberCounts[m.group_id] = (memberCounts[m.group_id] ?? 0) + 1;
    }

    if (user) {
      for (const m of (members ?? [])) {
        if (m.user_id === user.id) userMemberships.add(m.group_id);
      }
    }

    // ── Domain report counts ──
    const { data: associations } = await supabase
      .from('group_node_associations')
      .select('group_id, node_id')
      .in('group_id', groupIds);

    for (const a of (associations ?? [])) {
      reportCounts[a.group_id] = (reportCounts[a.group_id] ?? 0) + 1;
    }

    // ── Recommendations: match user's edited nodes to group domains ──
    if (user && (associations ?? []).length > 0) {
      // Find nodes the user has edited
      const { data: userNodes } = await supabase
        .from('node_revisions')
        .select('node_id')
        .eq('author_id', user.id)
        .limit(50);

      if (userNodes && userNodes.length > 0) {
        const editedNodeIds = new Set(userNodes.map(r => r.node_id));
        for (const a of (associations ?? [])) {
          if (editedNodeIds.has(a.node_id)) {
            recommendedGroupIds.add(a.group_id);
          }
        }
      }
    }

    // ── Last activity per group ──
    for (const gid of groupIds) {
      const { data: latest } = await supabase
        .from('group_discussions')
        .select('created_at')
        .eq('group_id', gid)
        .order('created_at', { ascending: false })
        .limit(1);

      if (latest && latest.length > 0) {
        lastActivity[gid] = latest[0].created_at;
      }
    }

    // ── Recent contributors per group (last 3 unique) ──
    for (const gid of groupIds) {
      const { data: recentPosts } = await supabase
        .from('group_discussions')
        .select('author_id, author:profiles!group_discussions_author_id_fkey ( username )')
        .eq('group_id', gid)
        .order('created_at', { ascending: false })
        .limit(10);

      const seen = new Set<string>();
      const contributors: { username: string }[] = [];
      for (const p of (recentPosts ?? [])) {
        if (!seen.has(p.author_id) && contributors.length < 3) {
          seen.add(p.author_id);
          const author = Array.isArray(p.author) ? p.author[0] : p.author;
          contributors.push({ username: author?.username || 'User' });
        }
      }
      recentContributors[gid] = contributors;
    }
  }

  // ── Build serializable data for client component ──
  const groupsData: GroupData[] = (groups ?? []).map(g => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    description: g.description || '',
    icon: g.icon || '📚',
    memberCount: memberCounts[g.id] ?? 0,
    reportCount: reportCounts[g.id] ?? 0,
    lastActivity: lastActivity[g.id] ?? null,
    recentContributors: recentContributors[g.id] ?? [],
    isMember: userMemberships.has(g.id),
    isRecommended: recommendedGroupIds.has(g.id),
  }));

  return (
    <div className="groups-layout">
      <header className="groups-header">
        <div className="groups-badge">Scholarly Communities</div>
        <h1>Scholarly Communities</h1>
        <p>
          Domain-specific spaces where contributors coordinate research, mentor new scholars, and build consensus on legal topics.
        </p>
      </header>

      <GroupsDirectory groups={groupsData} isLoggedIn={!!user} />
    </div>
  );
}
