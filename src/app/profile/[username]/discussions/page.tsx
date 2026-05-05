import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import UserDiscussionClient from './UserDiscussionClient';
import '@/app/community-core.css';

interface Props {
  params: Promise<{ username: string }>;
}

export default async function UserDiscussionPage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // Fetch target user profile and stats
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, username, role, reputation_score, created_at')
    .eq('username', username)
    .single();

  if (!targetProfile) notFound();

  // Fetch sidebar counts — individual queries instead of Promise.all for resilience
  const { count: edits } = await supabase.from('revisions').select('id', { count: 'exact', head: true }).eq('author_id', targetProfile.id);
  const { count: discussions } = await supabase.from('group_discussions').select('id', { count: 'exact', head: true }).eq('author_id', targetProfile.id);
  
  // Count actual mentorships (as mentee), not user_discussion messages
  let mentorshipCount = 0;
  try {
    const { count } = await supabase
      .from('mentorships')
      .select('id', { count: 'exact', head: true })
      .eq('mentee_id', targetProfile.id);
    mentorshipCount = count || 0;
  } catch {
    // mentorships table may not exist yet
  }
  const { data: messages } = await supabase.from('user_discussions').select(`
    id, content, created_at, parent_id, author_id,
    author:profiles!user_discussions_author_id_fkey ( username, role )
  `).eq('target_user_id', targetProfile.id).order('created_at', { ascending: true });

  // Fetch user's subject group memberships
  const { data: groupMemberships } = await supabase
    .from('subject_group_members')
    .select('group_id, role')
    .eq('user_id', targetProfile.id);

  // Fetch group details for the memberships
  const groupIds = (groupMemberships || []).map((m: any) => m.group_id);
  let groupDetails: any[] = [];
  if (groupIds.length > 0) {
    const { data } = await supabase
      .from('subject_groups')
      .select('id, slug, name, icon')
      .in('id', groupIds);
    groupDetails = data || [];
  }

  // Fetch active mentorships (as mentor) — graceful fallback if table doesn't exist yet
  let mentorCount = 0;
  try {
    const { count } = await supabase
      .from('mentorships')
      .select('id', { count: 'exact', head: true })
      .eq('mentor_id', targetProfile.id)
      .eq('status', 'active');
    mentorCount = count || 0;
  } catch {
    // mentorships table may not exist yet — migration not run
  }

  const targetUser = {
    id: targetProfile.id,
    username: targetProfile.username,
    role: targetProfile.role,
    reputation: targetProfile.reputation_score,
    memberSince: new Date(targetProfile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    stats: {
      edits: edits || 0,
      discussions: discussions || 0,
      mentorships: mentorshipCount || 0,
      activeMentoring: mentorCount || 0,
    },
    groups: (groupMemberships || []).map((m: any) => {
      const g = groupDetails.find((g: any) => g.id === m.group_id);
      return {
        slug: g?.slug,
        name: g?.name,
        icon: g?.icon,
        role: m.role,
      };
    }).filter((g: any) => g.slug),
  };

  return (
    <UserDiscussionClient 
      messages={messages || []}
      targetUser={targetUser}
      currentUser={currentUser ? { id: currentUser.id, name: currentUser.email?.split('@')[0] || 'You' } : null}
    />
  );
}
