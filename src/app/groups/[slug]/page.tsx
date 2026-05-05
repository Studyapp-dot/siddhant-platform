import React from 'react';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { joinGroup, leaveGroup } from './actions';
import ForumClient from './ForumClient';
import { getGroupEndorsementData } from '@/app/actions/group-endorsements';
import '@/app/community-core.css';
import '@/app/topic/[slug]/discussion/discussion.css';

export default async function GroupForumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch group details
  const { data: group } = await supabase
    .from('subject_groups')
    .select('id, slug, name, description, icon')
    .eq('slug', slug)
    .single();

  if (!group) notFound();

  // Check current user membership & role
  let isMember = false;
  let memberRole: string | null = null;
  if (user) {
    const { data: membership } = await supabase
      .from('subject_group_members')
      .select('user_id, role')
      .eq('user_id', user.id)
      .eq('group_id', group.id)
      .maybeSingle();
    isMember = !!membership;
    memberRole = membership?.role || null;
  }

  // Fetch group members with profiles and roles
  const { data: members } = await supabase
    .from('subject_group_members')
    .select(`
      user_id, role, joined_at,
      profile:profiles!subject_group_members_user_id_fkey ( username, reputation_score )
    `)
    .eq('group_id', group.id)
    .order('joined_at', { ascending: true });

  const memberCount = members?.length || 0;

  // Fetch all threads with author info
  const { data: rawThreads } = await supabase
    .from('group_discussions')
    .select(`
      id, content, created_at, thread_type, pinned, parent_id, author_id,
      author:profiles!group_discussions_author_id_fkey ( username, role, reputation_score )
    `)
    .eq('group_id', group.id)
    .order('created_at', { ascending: true });

  // Fetch domain Reports linked to this group
  const { data: domainReports } = await supabase
    .from('group_node_associations')
    .select(`
      id, node_id, created_at,
      node:nodes!group_node_associations_node_id_fkey ( id, title, slug, node_type, quality_tier )
    `)
    .eq('group_id', group.id)
    .order('created_at', { ascending: true });

  // Fetch open mentor requests for this group
  const { data: mentorRequests } = await supabase
    .from('mentor_requests')
    .select(`
      id, requester_id, message, created_at, status,
      requester:profiles!mentor_requests_requester_id_fkey ( username )
    `)
    .eq('group_id', group.id)
    .eq('status', 'open')
    .order('created_at', { ascending: true });

  // Fetch active mentorships for this group
  const { data: activeMentorships } = await supabase
    .from('mentorships')
    .select(`
      id, mentor_id, mentee_id, started_at,
      mentor:profiles!mentorships_mentor_id_fkey ( username ),
      mentee:profiles!mentorships_mentee_id_fkey ( username )
    `)
    .eq('group_id', group.id)
    .eq('status', 'active');

  // Check if current user has an open mentor request
  let userHasOpenRequest = false;
  let userHasActiveMentor = false;
  if (user) {
    userHasOpenRequest = !!(mentorRequests || []).find((r: any) => r.requester_id === user.id);
    userHasActiveMentor = !!(activeMentorships || []).find((m: any) => m.mentee_id === user.id);
  }

  // Fetch endorsement data for all threads (Phase 2)
  const allThreadIds = (rawThreads || []).map((t: any) => t.id);
  const endorsementData = await getGroupEndorsementData(allThreadIds, user?.id);

  // Format members for the sidebar
  const formattedMembers = (members || []).map((m: any) => ({
    userId: m.user_id,
    username: m.profile?.username || 'Unknown',
    role: m.role,
    reputation: m.profile?.reputation_score || 0,
  }));

  // Sort: coordinators first, then mentors, then members
  const roleOrder: Record<string, number> = { coordinator: 0, mentor: 1, member: 2 };
  formattedMembers.sort((a: any, b: any) => (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2));

  // Compute ambient scholarly signals
  const threadDates = (rawThreads || []).map((t: any) => new Date(t.created_at).getTime());
  const lastActivity = threadDates.length > 0 ? new Date(Math.max(...threadDates)) : null;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentContributors = new Set((rawThreads || []).filter((t: any) => new Date(t.created_at).getTime() > oneWeekAgo).map((t: any) => t.author_id));
  const linkedConcepts = (domainReports || []).length;

  const scholarlyPulse = {
    lastActivity: lastActivity ? lastActivity.toISOString() : null,
    contributorsThisWeek: recentContributors.size,
    linkedConcepts,
    totalThreads: (rawThreads || []).length,
  };

  return (
    <div className="community-layout">
      {/* Group Sidebar */}
      <aside className="community-sidebar" style={{ animation: 'slideRight 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="glass-card" style={{ padding: '1.5rem 1.25rem', border: '1px solid var(--border-subtle)' }}>
          <div className="scholar-avatar" style={{ 
            width: '40px', 
            height: '40px', 
            fontSize: '1rem', 
            margin: '0 auto 0.75rem', 
            background: 'var(--color-gold-gradient)', 
            color: 'var(--bg-app)',
            border: 'none',
            borderRadius: '12px',
          }}>
            {group.icon || group.name[0]}
          </div>
          <h2 className="scholar-name" style={{ fontSize: '1rem', textAlign: 'center', marginBottom: '1rem', letterSpacing: '-0.01em' }}>{group.name}</h2>
          
          {/* Ambient scholarly pulse — not stats, but signs of life */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6, borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>{memberCount} members</span>
              <span>{scholarlyPulse.linkedConcepts} linked topics</span>
            </div>
            {scholarlyPulse.lastActivity && (
              <div style={{ opacity: 0.7 }}>
                Last activity {(() => {
                  const diff = Date.now() - new Date(scholarlyPulse.lastActivity).getTime();
                  const hours = Math.floor(diff / (1000 * 60 * 60));
                  const days = Math.floor(hours / 24);
                  if (hours < 1) return 'just now';
                  if (hours < 24) return `${hours}h ago`;
                  if (days < 7) return `${days}d ago`;
                  return `${Math.floor(days/7)}w ago`;
                })()}
                {scholarlyPulse.contributorsThisWeek > 0 && (
                  <span> · {scholarlyPulse.contributorsThisWeek} active this week</span>
                )}
              </div>
            )}
          </div>

          {/* Join/Leave — infrastructural, not CTAs */}
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
            {user && (
              isMember ? (
                <form action={leaveGroup}>
                  <input type="hidden" name="group_slug" value={slug} />
                  <button type="submit" style={{ 
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600,
                    fontFamily: 'var(--font-sans)', padding: 0, opacity: 0.5
                  }}>Leave group</button>
                </form>
              ) : (
                <form action={joinGroup}>
                  <input type="hidden" name="group_slug" value={slug} />
                  <button type="submit" style={{ 
                    width: '100%', padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: 'var(--color-gold-gradient)', color: 'var(--bg-base)',
                    fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)'
                  }}>Join Group</button>
                </form>
              )
            )}
            {!user && (
              <Link href="/login" style={{ 
                display: 'block', width: '100%', padding: '8px 16px', borderRadius: '8px',
                background: 'var(--color-gold-gradient)', color: 'var(--bg-base)',
                fontWeight: 700, fontSize: '0.75rem', textAlign: 'center', textDecoration: 'none',
                fontFamily: 'var(--font-sans)'
              }}>Join Group</Link>
            )}
          </div>
        </div>

        {/* Member Roster */}
        <div style={{ padding: '1.25rem 1.25rem' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', opacity: 0.6, display: 'block', marginBottom: '0.75rem' }}>Members</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {formattedMembers.slice(0, 15).map((m: any) => (
              <Link key={m.userId} href={`/profile/${m.username}`} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                padding: '6px 8px', 
                borderRadius: '8px', 
                textDecoration: 'none', 
                color: 'inherit',
                transition: 'background 0.15s ease'
              }} className="hover-highlight">
                <div className="scholar-avatar" style={{ 
                  width: '28px', height: '28px', fontSize: '0.7rem', flexShrink: 0,
                  background: m.role === 'coordinator' ? 'var(--color-gold-gradient)' : m.role === 'mentor' ? 'linear-gradient(135deg, #34d399, #059669)' : 'var(--color-gold-soft)',
                  color: m.role !== 'member' ? 'var(--bg-base)' : 'var(--color-gold)',
                  border: 'none'
                }}>
                  {m.username[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{m.username}</div>
                </div>
                {m.role !== 'member' && (
                  <span style={{ 
                    fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                    padding: '2px 6px', borderRadius: '4px',
                    background: m.role === 'coordinator' ? 'var(--color-gold-soft)' : 'rgba(52, 211, 153, 0.1)',
                    color: m.role === 'coordinator' ? 'var(--color-gold)' : '#34d399'
                  }}>{m.role}</span>
                )}
              </Link>
            ))}
            {formattedMembers.length > 15 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px' }}>
                +{formattedMembers.length - 15} more
              </div>
            )}
            {formattedMembers.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No members yet.</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <Link href="/dashboard" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'none', padding: '4px 0', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
               <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>🏠</span> Scholar's Desk
            </Link>
            <Link href="/groups" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'none', padding: '4px 0', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
               <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>📜</span> All Communities
            </Link>
          </div>
        </div>
      </aside>

      <main className="scholarly-content" style={{ minWidth: 0 }}>
        <header className="scholarly-header" style={{ paddingBottom: '1rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', opacity: 0.5, marginBottom: '0.5rem', display: 'block' }}>Subject Workspace</span>
          <h1 className="scholarly-title" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>{group.name}</h1>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: '700px', margin: 0 }}>{group.description}</p>
        </header>

        <ForumClient
          threads={rawThreads || []}
          groupSlug={slug}
          groupName={group.name}
          currentUser={user ? { id: user.id, name: user.email?.split('@')[0] || 'You' } : null}
          isMember={isMember}
          memberRole={memberRole}
          domainReports={(domainReports || []).map((r: any) => ({
            id: r.node?.id,
            title: r.node?.title || 'Untitled',
            slug: r.node?.slug,
            type: r.node?.node_type,
            tier: r.node?.quality_tier,
          }))}
          mentorRequests={(mentorRequests || []).map((r: any) => ({
            id: r.id,
            requesterUsername: r.requester?.username || 'Unknown',
            requesterId: r.requester_id,
            message: r.message,
            createdAt: r.created_at,
          }))}
          activeMentorships={(activeMentorships || []).map((m: any) => ({
            id: m.id,
            mentorUsername: m.mentor?.username || 'Unknown',
            menteeUsername: m.mentee?.username || 'Unknown',
            mentorId: m.mentor_id,
            menteeId: m.mentee_id,
            startedAt: m.started_at,
          }))}
          userHasOpenRequest={userHasOpenRequest}
          userHasActiveMentor={userHasActiveMentor}
          endorsementData={endorsementData}
        />
      </main>
    </div>
  );
}
