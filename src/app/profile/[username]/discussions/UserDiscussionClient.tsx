'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { postUserMessage } from './actions';
import { DiscussionEngine, DiscussionForm } from '@/app/components/community/DiscussionEngine';
import '@/app/community-core.css';

interface UserGroup {
  slug: string;
  name: string;
  icon: string;
  role: string;
}

interface TargetUser {
  id: string;
  username: string;
  role: string;
  reputation: number;
  memberSince: string;
  stats: {
    edits: number;
    discussions: number;
    mentorships: number;
    activeMentoring: number;
  };
  groups: UserGroup[];
}

interface Props {
  messages: any[];
  targetUser: TargetUser;
  currentUser: { id: string; name: string } | null;
}

export default function UserDiscussionClient({ messages, targetUser, currentUser }: Props) {
  const router = useRouter();
  const isSelf = currentUser?.id === targetUser.id;

  const handleReply = async (content: string, parentId: string, _threadType?: string) => {
    const fd = new FormData();
    fd.append('target_username', targetUser.username);
    fd.append('content', content);
    if (parentId) fd.append('parent_id', parentId);
    await postUserMessage(fd);
    router.refresh();
  };

  /* ---------- format messages for DiscussionEngine ---------- */
  const formattedMessages = (messages || []).map((msg: any) => ({
    id: msg.id,
    content: msg.content,
    created_at: msg.created_at,
    parent_id: msg.parent_id,
    author: {
      id: msg.author_id,
      name: msg.author?.username || 'User',
      role: msg.author?.role || 'Contributor',
    },
  }));

  const roleLabel = (() => {
    // Use canonical role labels from reputation-constants.ts
    const labels: Record<string, string> = {
      reader: 'Reader',
      contributor: 'Contributor',
      recognized: 'Recognized Contributor',
      senior_scholar: 'Senior Scholar',
      steward: 'Steward',
      governance_council: 'Governance Council',
      admin: 'Administrator',
    };
    return labels[targetUser.role] || 'Contributor';
  })();

  return (
    <div className="community-layout">
      {/* --- Sidebar --- */}
      <aside className="community-sidebar" style={{ animation: 'slideRight 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="glass-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
          <div className="scholar-avatar" style={{ 
            width: '80px', height: '80px', fontSize: '1.8rem', 
            margin: '0 auto 1.2rem',
            background: isSelf ? 'var(--color-gold-gradient)' : 'linear-gradient(135deg, var(--color-gold-soft), rgba(197, 160, 89, 0.25))',
            color: isSelf ? 'var(--bg-app)' : 'var(--color-gold)',
            border: isSelf ? 'none' : '2px solid var(--color-gold)',
            boxShadow: isSelf ? 'var(--color-gold-glow)' : 'none',
            borderRadius: '20px',
          }}>
            {targetUser.username[0].toUpperCase()}
          </div>
          <h2 className="scholar-name" style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>@{targetUser.username}</h2>
          <span style={{ 
            fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', 
            letterSpacing: '0.1em', color: 'var(--color-gold)',
            background: 'var(--color-gold-soft)', padding: '3px 10px', borderRadius: '5px'
          }}>{roleLabel}</span>
          
          <div className="stats-ledger" style={{ marginTop: '2rem', gap: '1rem' }}>
            <div className="stats-item">
              <span className="stats-label">Reputation</span>
              <span className="stats-value" style={{ fontSize: '1.2rem' }}>{targetUser.reputation}</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Edits</span>
              <span className="stats-value">{targetUser.stats.edits}</span>
            </div>
            <div className="stats-item">
              <span className="stats-label">Discussions</span>
              <span className="stats-value">{targetUser.stats.discussions}</span>
            </div>
            <div className="stats-item" style={{ border: 'none' }}>
              <span className="stats-label">Mentorships</span>
              <span className="stats-value">{targetUser.stats.mentorships}</span>
            </div>
            {targetUser.stats.activeMentoring > 0 && (
              <div className="stats-item" style={{ border: 'none', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <span className="stats-label" style={{ color: '#34d399' }}>Active Mentoring</span>
                <span className="stats-value" style={{ color: '#34d399' }}>{targetUser.stats.activeMentoring}</span>
              </div>
            )}
          </div>
        </div>

        {/* Subject Group Memberships */}
        {targetUser.groups.length > 0 && (
          <div className="glass-card" style={{ padding: '1.5rem' }}>
              <span className="nav-heading" style={{ paddingLeft: 0, marginBottom: '0.75rem', display: 'block', color: 'var(--color-gold)' }}>Scholarly Communities</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {targetUser.groups.map((g) => (
                <Link key={g.slug} href={`/groups/${g.slug}`} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: '8px',
                  textDecoration: 'none', color: 'inherit',
                  transition: 'background 0.15s ease'
                }} className="hover-highlight">
                  <span style={{ fontSize: '1rem' }}>{g.icon || '📜'}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  {g.role !== 'member' && (
                    <span style={{ 
                      fontSize: '0.5rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                      padding: '2px 6px', borderRadius: '4px',
                      background: g.role === 'coordinator' ? 'var(--color-gold-soft)' : 'rgba(52, 211, 153, 0.1)',
                      color: g.role === 'coordinator' ? 'var(--color-gold)' : '#34d399'
                    }}>{g.role}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="nav-group" style={{ marginTop: '0.5rem' }}>
          <span className="nav-heading">Links</span>
          <Link href={`/profile/${targetUser.username}`} className="nav-link">
            <span className="nav-link-icon">👤</span> View Profile
          </Link>
          <Link href="/groups" className="nav-link">
            <span className="nav-link-icon">📜</span> Communities Directory
          </Link>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="scholarly-content" style={{ minWidth: 0 }}>
        <header className="scholarly-header">
          <span className="context-label">Discussion Page</span>
          <h1 className="scholarly-title" style={{ fontSize: '2.5rem' }}>
            {isSelf ? 'Your Discussion Page' : `@${targetUser.username}'s Discussion Page`}
          </h1>
          <p className="scholarly-subtitle" style={{ textTransform: 'none', fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '700px', letterSpacing: 'normal' }}>
            {isSelf
              ? 'This is where other community members leave you messages — mentoring feedback, contribution questions, coordination requests, or dispute resolution.'
              : `Leave a message for @${targetUser.username} — mentoring feedback, questions about a contribution, coordination on a Report, or any other community communication.`
            }
          </p>
        </header>

        {/* Compose Form — scholarly messaging interface */}
        {currentUser && (
          <div style={{ marginBottom: '3rem' }}>
            <div className="glass-card" style={{ padding: '2rem 2.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-gold)' }}>
                  {isSelf ? '✏️ Post to your own discussion page' : `✉️ Message @${targetUser.username}`}
                </span>
                <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Public · Permanent Record
                </span>
              </div>
              <DiscussionForm
                mode="reply"
                placeholder={isSelf
                  ? 'Post a public note — this becomes part of your permanent scholarly record...'
                  : `Write a message for @${targetUser.username} — mentoring, coordination, or scholarly inquiry...`}
                onSubmit={async (content) => handleReply(content, '')}
              />
            </div>
          </div>
        )}

        {!currentUser && (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
              <Link href="/login" style={{ color: 'var(--color-gold)', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link> to leave a message on this discussion page.
            </p>
          </div>
        )}

        {/* Messages */}
        {formattedMessages.length > 0 ? (
          <DiscussionEngine
            messages={formattedMessages}
            space="user"
            currentUser={currentUser}
            onReply={currentUser ? handleReply : undefined}
            showBottomForm={false}
          />
        ) : (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1.25rem', opacity: 0.6 }}>📜</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              {isSelf ? 'Your discussion page awaits' : 'No messages yet'}
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto', lineHeight: 1.6 }}>
              {isSelf
                ? 'This is where other scholars reach you — mentoring feedback, questions about your contributions, coordination on Reports, or dispute resolution.'
                : `Be the first to leave a message for @${targetUser.username}. You can ask about their contributions, coordinate on a shared topic, or provide mentoring feedback.`
              }
            </p>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '1rem', display: 'block', marginBottom: '4px' }}>❓</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Questions</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '1rem', display: 'block', marginBottom: '4px' }}>🤝</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Coordination</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '1rem', display: 'block', marginBottom: '4px' }}>🎓</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mentoring</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '1rem', display: 'block', marginBottom: '4px' }}>⚖️</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Dispute Resolution</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
