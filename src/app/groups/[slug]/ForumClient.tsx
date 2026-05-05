'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { postGroupMessage, pinThread, associateReport, removeReportAssociation } from './actions';
import { requestMentor, acceptMentorRequest } from '@/app/actions/mentor-actions';
import { toggleGroupEndorsement } from '@/app/actions/group-endorsements';
import Link from 'next/link';
import { DiscussionEngine, DiscussionForm } from '@/app/components/community/DiscussionEngine';
import '@/app/community-core.css';
import '@/app/topic/[slug]/discussion/discussion.css';

interface DomainReport {
  id: string;
  title: string;
  slug: string;
  type: string;
  tier: string;
}

interface MentorRequest {
  id: string;
  requesterUsername: string;
  requesterId: string;
  message: string | null;
  createdAt: string;
}

interface ActiveMentorship {
  id: string;
  mentorUsername: string;
  menteeUsername: string;
  mentorId: string;
  menteeId: string;
  startedAt: string;
}

interface ForumClientProps {
  threads: any[];
  groupSlug: string;
  groupName: string;
  currentUser: { id: string; name: string } | null;
  isMember: boolean;
  memberRole: string | null;
  domainReports: DomainReport[];
  mentorRequests: MentorRequest[];
  activeMentorships: ActiveMentorship[];
  userHasOpenRequest: boolean;
  userHasActiveMentor: boolean;
  endorsementData: Record<string, { count: number; userVoted: boolean }>;
}

const ROOMS = [
  { id: 'all', name: 'All Activity', icon: '🏛️', desc: 'All activity in this group.', memberOnly: false },
  { id: 'coordination', name: 'Coordination', icon: '🗂️', desc: 'Track Reports, assign tasks, and coordinate research across this domain.', memberOnly: true },
  { id: 'mentoring', name: 'Mentoring', icon: '🎓', desc: 'Ask questions, request guidance, and get help from experienced contributors.', memberOnly: false },
  { id: 'announcement', name: 'Announcements', icon: '📣', desc: 'New case law, legislative developments, and important updates.', memberOnly: true },
  { id: 'general', name: 'Open Discussion', icon: '💬', desc: 'Open conversation — anyone can participate.', memberOnly: false },
];

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  stub: { label: 'Stub', color: '#ef4444' },
  draft: { label: 'Draft', color: '#fb923c' },
  reviewed: { label: 'Reviewed', color: '#3b82f6' },
  quality: { label: 'Quality', color: '#34d399' },
  featured: { label: 'Featured', color: 'var(--color-gold)' },
};

export default function ForumClient({
  threads,
  groupSlug,
  groupName,
  currentUser,
  isMember,
  memberRole,
  domainReports,
  mentorRequests,
  activeMentorships,
  userHasOpenRequest,
  userHasActiveMentor,
  endorsementData,
}: ForumClientProps) {
  const [activeRoom, setActiveRoom] = useState('all');
  const [mentorMessage, setMentorMessage] = useState('');
  const [isRequestingMentor, setIsRequestingMentor] = useState(false);
  const [isAssociating, setIsAssociating] = useState(false);
  const [reportIdentifier, setReportIdentifier] = useState('');
  const router = useRouter();

  const currentRoom = ROOMS.find(r => r.id === activeRoom) || ROOMS[0];
  const canPost = currentUser && (isMember || !currentRoom.memberOnly);
  const isCoordinatorOrMentor = memberRole === 'coordinator' || memberRole === 'mentor';
  const isCoordinator = memberRole === 'coordinator';

  const handleReply = async (content: string, parentId: string, _threadType?: string) => {
    const fd = new FormData();
    fd.append('group_slug', groupSlug);
    fd.append('content', content);
    fd.append('thread_type', activeRoom === 'all' ? 'general' : activeRoom);
    if (parentId) fd.append('parent_id', parentId);

    await postGroupMessage(fd);
    router.refresh();
  };

  // Phase 2: Endorsement handler for DiscussionEngine
  const handleEndorse = async (messageId: string) => {
    await toggleGroupEndorsement(messageId, groupSlug);
    router.refresh();
  };

  const handleAssociateReport = async () => {
    if (!currentUser || !reportIdentifier.trim()) return;
    setIsAssociating(true);
    try {
      const fd = new FormData();
      fd.append('group_slug', groupSlug);
      fd.append('node_identifier', reportIdentifier);
      await associateReport(fd);
      setReportIdentifier('');
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsAssociating(false);
    }
  };

  const handleRemoveAssociation = async (nodeId: string) => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to remove this Report from the group?')) return;
    
    try {
      const fd = new FormData();
      fd.append('group_slug', groupSlug);
      fd.append('node_id', nodeId);
      await removeReportAssociation(fd);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleMentorRequest = async () => {
    if (!currentUser) return;
    setIsRequestingMentor(true);
    try {
      const fd = new FormData();
      fd.append('group_slug', groupSlug);
      if (mentorMessage.trim()) fd.append('message', mentorMessage);
      await requestMentor(fd);
      setMentorMessage('');
      router.refresh();
    } finally {
      setIsRequestingMentor(false);
    }
  };

  const handleAcceptMentor = async (requestId: string) => {
    const fd = new FormData();
    fd.append('request_id', requestId);
    fd.append('group_slug', groupSlug);
    await acceptMentorRequest(fd);
    router.refresh();
  };

  // Filter threads
  const filteredThreads = activeRoom === 'all'
    ? threads
    : threads.filter(t => t.thread_type === activeRoom);

  // Separate pinned from regular
  const pinnedThreads = filteredThreads.filter(t => t.pinned && !t.parent_id);
  const regularThreads = filteredThreads.filter(t => !t.pinned);

  // Format for DiscussionEngine — include endorsement data (Phase 2)
  const formattedMessages = regularThreads.map(msg => {
    const endorsement = endorsementData[msg.id];
    return {
      id: msg.id,
      content: msg.content,
      created_at: msg.created_at,
      parent_id: msg.parent_id,
      vote_count: endorsement?.count || 0,
      user_voted: endorsement?.userVoted || false,
      author: {
        id: msg.author_id,
        name: msg.author?.username || 'User',
        role: msg.author?.role || 'Contributor',
        reputation: msg.author?.reputation_score || 0,
      }
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Room Navigation — understated tab bar with clear active indicator */}
      <nav style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }}>
        {ROOMS.map(room => (
          <button 
            key={room.id}
            onClick={() => setActiveRoom(room.id)}
            style={{ 
              background: 'transparent',
              border: 'none',
              borderBottom: activeRoom === room.id ? '2px solid var(--color-gold)' : '2px solid transparent',
              padding: '0.65rem 1rem',
              marginBottom: '-1px',
              fontSize: '0.78rem',
              fontWeight: activeRoom === room.id ? 700 : 600,
              fontFamily: 'var(--font-sans)',
              color: activeRoom === room.id ? 'var(--text-primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              opacity: activeRoom === room.id ? 1 : 0.7,
            }}
          >
            <span style={{ fontSize: '0.85rem' }}>{room.icon}</span>
            <span>{room.name}</span>
          </button>
        ))}
      </nav>

      {/* Room Content Area */}
      <section>
        {/* Room Header — calm contextual framing, not a competing card */}
        <div style={{ marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ 
            fontFamily: 'var(--font-sans)', fontSize: '1.1rem', fontWeight: 700, 
            color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '0.25rem',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <span style={{ fontSize: '1rem', opacity: 0.7 }}>{currentRoom.icon}</span>
            {currentRoom.name}
          </h2>
          <p style={{ 
            fontFamily: 'var(--font-serif)', fontSize: '0.85rem', 
            color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 
          }}>{currentRoom.desc}</p>
            
            {/* Post form — visible to members, or non-members in open rooms */}
            {canPost && activeRoom !== 'all' && (
              <div style={{ marginTop: '2rem' }}>
                {!isMember && (
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    marginBottom: '1rem', padding: '8px 14px', borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.12)',
                    fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600
                  }}>
                    <span style={{ fontSize: '0.9rem' }}>💡</span>
                    Posting as a non-member. Your messages will be labeled accordingly. <Link href="#" style={{ color: 'var(--color-gold)', fontWeight: 700, textDecoration: 'none' }}>Join group</Link> for full access.
                  </div>
                )}
                <DiscussionForm 
                  placeholder={`Post a message in ${currentRoom.name}...`}
                  onSubmit={async (content) => handleReply(content, '')}
                />
              </div>
            )}
            
            {/* Non-member blocked from member-only rooms */}
            {currentUser && !isMember && currentRoom.memberOnly && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(197, 160, 89, 0.03)', borderRadius: '8px', textAlign: 'center' }}>
                 <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, margin: 0 }}>
                   This space is for group members. <Link href="#" style={{ color: 'var(--color-gold)', fontWeight: 700, textDecoration: 'none' }}>Join the {groupName} Group</Link> to participate here.
                 </p>
              </div>
            )}

            {/* Login prompt for unauthenticated users */}
            {!currentUser && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(197, 160, 89, 0.03)', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, margin: 0 }}>
                  <Link href="/login" style={{ color: 'var(--color-gold)', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link> to participate in discussions.
                </p>
              </div>
            )}
          </div>

        {/* =========================================== */}
        {/* COORDINATION ROOM — Domain Reports Tracker */}
        {/* =========================================== */}
        {activeRoom === 'coordination' && (
          <div className="glass-card" style={{ marginBottom: '2.5rem', borderLeft: '3px solid var(--color-gold)' }}>
            <div className="glass-card-content" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-gold)' }}>📌 Domain Reports Tracker</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Reports associated with <strong>{groupName}</strong>. Members coordinate here on what exists, what needs work, and who&apos;s working on what.
              </p>

              {domainReports.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {domainReports.map((report) => {
                    const tier = TIER_LABELS[report.tier] || { label: report.tier || 'Unrated', color: 'var(--text-muted)' };
                    return (
                      <div key={report.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{
                          flex: 1,
                          background: 'var(--bg-panel)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '10px',
                          overflow: 'hidden'
                        }}>
                          <Link href={`/topic/${report.slug}`} style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '10px 14px',
                            textDecoration: 'none', color: 'inherit',
                            transition: 'transform 0.15s ease, border-color 0.15s ease',
                          }} className="hover-highlight">
                            <div style={{ 
                              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                              background: tier.color
                            }} />
                            <span style={{ 
                              fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', 
                              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
                            }}>{report.title}</span>
                            <span style={{ 
                              fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', 
                              letterSpacing: '0.08em', color: tier.color,
                              padding: '2px 8px', borderRadius: '4px',
                              background: `${tier.color}15`
                            }}>{tier.label}</span>
                          </Link>
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '10px',
                            padding: '8px 14px 10px',
                            borderTop: '1px solid var(--border-subtle)',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)'
                          }}>
                            <Link href={`/topic/${report.slug}/history`} style={{ color: 'inherit', textDecoration: 'none' }}>
                              Revision history
                            </Link>
                            <Link href={`/topic/${report.slug}/edges`} style={{ color: 'inherit', textDecoration: 'none' }}>
                              Relationships
                            </Link>
                            <Link href={`/topic/${report.slug}/discussion`} style={{ color: 'inherit', textDecoration: 'none' }}>
                              Topic discussion
                            </Link>
                          </div>
                        </div>
                        {isCoordinator && (
                          <button
                            onClick={() => handleRemoveAssociation(report.id)}
                            title="Remove association"
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', padding: '8px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No Reports linked to this group yet.</p>
                </div>
              )}

              {/* Associate Report Form */}
              {isCoordinatorOrMentor && (
                <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1rem' }}>🔗</span>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Associate Report</h3>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Link an existing Report to this domain to track it here. You can paste the Report URL or its slug.
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value={reportIdentifier}
                      onChange={(e) => setReportIdentifier(e.target.value)}
                      placeholder="e.g., https://.../topic/digital-privacy or just 'digital-privacy'"
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: '8px',
                        border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
                        color: 'var(--text-primary)', fontSize: '0.85rem'
                      }}
                    />
                    <button
                      onClick={handleAssociateReport}
                      disabled={isAssociating || !reportIdentifier.trim()}
                      style={{
                        padding: '10px 20px', borderRadius: '8px', border: 'none',
                        background: 'var(--color-gold-gradient)', color: 'white',
                        fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
                        opacity: (isAssociating || !reportIdentifier.trim()) ? 0.6 : 1,
                      }}
                    >
                      {isAssociating ? 'Linking...' : 'Link'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================== */}
        {/* MENTORING ROOM — Mentor Requests & Pairs    */}
        {/* =========================================== */}
        {activeRoom === 'mentoring' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2.5rem' }}>
            {/* Active Mentorships */}
            {activeMentorships.length > 0 && (
              <div className="glass-card" style={{ borderLeft: '3px solid #34d399' }}>
                <div className="glass-card-content" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#34d399' }}>🤝 Active Mentoring Pairs</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {activeMentorships.map((m) => (
                      <div key={m.id} style={{ 
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 14px', borderRadius: '10px',
                        background: 'rgba(52, 211, 153, 0.04)', border: '1px solid rgba(52, 211, 153, 0.12)'
                      }}>
                        <div className="scholar-avatar" style={{ 
                          width: '28px', height: '28px', fontSize: '0.7rem', flexShrink: 0,
                          background: 'linear-gradient(135deg, #34d399, #059669)', color: 'var(--bg-base)', border: 'none'
                        }}>{m.mentorUsername[0].toUpperCase()}</div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>@{m.mentorUsername}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>mentoring</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>@{m.menteeUsername}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          since {new Date(m.startedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Open Mentor Requests */}
            {mentorRequests.length > 0 && (
              <div className="glass-card" style={{ borderLeft: '2px solid rgba(124, 141, 181, 0.3)' }}>
                <div className="glass-card-content" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Open Requests</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {mentorRequests.map((r) => (
                      <div key={r.id} style={{ 
                        padding: '14px', borderRadius: '10px',
                        background: 'rgba(124, 141, 181, 0.03)', border: '1px solid rgba(124, 141, 181, 0.1)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: r.message ? '8px' : 0 }}>
                          <div className="scholar-avatar" style={{ 
                            width: '28px', height: '28px', fontSize: '0.7rem', flexShrink: 0,
                            background: 'rgba(124, 141, 181, 0.1)', color: '#7c8db5', border: 'none'
                          }}>{r.requesterUsername[0].toUpperCase()}</div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>@{r.requesterUsername}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>is looking for a mentor</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            {new Date(r.createdAt).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                          </span>
                          {isMember && currentUser && currentUser.id !== r.requesterId && (
                            <button 
                              onClick={() => handleAcceptMentor(r.id)}
                              style={{
                                padding: '4px 12px', borderRadius: '6px', border: 'none',
                                background: 'linear-gradient(135deg, #34d399, #059669)', color: 'white',
                                fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer',
                                textTransform: 'uppercase', letterSpacing: '0.05em'
                              }}
                            >Accept</button>
                          )}
                        </div>
                        {r.message && (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '38px', lineHeight: 1.5, fontStyle: 'italic' }}>
                            &ldquo;{r.message}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Request a Mentor CTA */}
            {currentUser && !userHasActiveMentor && !userHasOpenRequest && (
              <div className="glass-card" style={{ borderLeft: '2px solid rgba(124, 141, 181, 0.3)' }}>
                <div className="glass-card-content" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>🎓</span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Request a Mentor</h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                    New to {groupName}? Request a mentor — an experienced contributor who can guide you through your first contributions. 
                    The relationship is informal and lasts as long as both of you find it helpful.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                      value={mentorMessage}
                      onChange={(e) => setMentorMessage(e.target.value)}
                      placeholder="Introduce yourself and what you'd like help with (optional)..."
                      style={{
                        width: '100%', minHeight: '80px', padding: '12px 16px',
                        borderRadius: '10px', border: '1px solid var(--border-medium)',
                        background: 'var(--bg-surface)', color: 'var(--text-primary)',
                        fontSize: '0.9rem', lineHeight: 1.5, resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                    <button
                      onClick={handleMentorRequest}
                      disabled={isRequestingMentor}
                      style={{
                        padding: '10px 24px', borderRadius: '10px', border: 'none',
                        background: 'var(--color-gold-gradient)', color: 'var(--bg-base)',
                        fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        alignSelf: 'flex-start', opacity: isRequestingMentor ? 0.6 : 1,
                        transition: 'opacity 0.2s ease, transform 0.15s ease'
                      }}
                    >
                      {isRequestingMentor ? 'Submitting...' : 'Request a Mentor'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {userHasOpenRequest && (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', background: 'rgba(124, 141, 181, 0.03)', borderRadius: '8px', border: '1px solid rgba(124, 141, 181, 0.08)' }}>
                ✓ Your mentor request is open. An experienced contributor will reach out soon.
              </div>
            )}

            {userHasActiveMentor && (
              <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: '#34d399', background: 'rgba(52, 211, 153, 0.04)', borderRadius: '12px', border: '1px solid rgba(52, 211, 153, 0.1)' }}>
                ✓ You have an active mentor in this group.
              </div>
            )}
          </div>
        )}

        {/* =========================================== */}
        {/* PINNED THREADS                              */}
        {/* =========================================== */}
        {pinnedThreads.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <span style={{ 
              fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', 
              letterSpacing: '0.12em', color: 'var(--color-gold)', 
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem'
            }}>
              📌 Pinned
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pinnedThreads.filter(t => !t.parent_id).map((thread) => (
                <div key={thread.id} className="glass-card" style={{ 
                  borderLeft: '3px solid var(--color-gold)',
                  padding: '1.25rem 1.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                    <div className="scholar-avatar" style={{ width: '26px', height: '26px', fontSize: '0.65rem' }}>
                      {(thread.author?.username || 'U')[0].toUpperCase()}
                    </div>
                    <Link href={`/profile/${thread.author?.username}`} style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>
                      @{thread.author?.username || 'User'}
                    </Link>
                    <span style={{ 
                      fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', 
                      padding: '2px 6px', borderRadius: '4px',
                      background: 'var(--color-gold-soft)', color: 'var(--color-gold)'
                    }}>Pinned</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {new Date(thread.created_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {thread.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================== */}
        {/* REGULAR DISCUSSION THREADS                  */}
        {/* =========================================== */}
        <DiscussionEngine
          messages={formattedMessages}
          space="group"
          currentUser={currentUser}
          onReply={canPost ? handleReply : undefined}
          onEndorse={currentUser ? handleEndorse : undefined}
          showBottomForm={false}
        />
        
        {filteredThreads.length === 0 && (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <p style={{ 
              fontFamily: 'var(--font-serif)', fontSize: '0.92rem', 
              color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '400px', margin: '0 auto'
            }}>
              {activeRoom === 'coordination' && 'No coordination threads yet. Start a discussion to organize research, identify gaps, or coordinate work.'}
              {activeRoom === 'mentoring' && 'No mentoring conversations yet. Experienced contributors can guide newcomers here.'}
              {activeRoom === 'announcement' && 'No announcements yet. Major developments and updates will appear here.'}
              {activeRoom === 'general' && 'No open discussions yet. Begin a scholarly conversation with the community.'}
              {activeRoom === 'all' && 'No activity in this group yet. Choose a room above to begin.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
