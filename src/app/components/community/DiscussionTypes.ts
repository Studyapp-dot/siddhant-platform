/* ========================================
   SIDDHANT — Discussion System Types & Constants
   Phase 3: Intelligence + Trust Layer
   ======================================== */

export const THREAD_TYPES = {
  question: { icon: '❓', label: 'Question', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)', placeholder: 'Clearly state the legal issue you need clarity on…', hasAnswers: true },
  interpretation: { icon: '⚖️', label: 'Interpretation / Debate', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', placeholder: 'State your interpretation and the reasoning behind it…', hasAnswers: true },
  improvement: { icon: '🛠', label: 'Improvement', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', placeholder: 'Explain what should change and why it matters…', hasAnswers: false },
  issue: { icon: '🚨', label: 'Error / Issue', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', placeholder: 'Describe the error with reference to a specific source…', hasAnswers: false },
  general: { icon: '💬', label: 'Discussion', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)', border: 'var(--border-subtle)', placeholder: 'What would you like to discuss?', hasAnswers: false },
} as const;

export type ThreadType = keyof typeof THREAD_TYPES;

/** Thread types that support answer/reply distinction */
export const ANSWER_THREAD_TYPES: ThreadType[] = ['question', 'interpretation'];

export const ROLE_LABELS: Record<string, string> = {
  registered: 'Contributor',
  recognized: 'Recognized Contributor',
  senior_scholar: 'Senior Scholar',
  senior_validator: 'Senior Contributor',
  steward: 'Steward',
  governance_council: 'Governance Council',
  admin: 'Administrator',
};

/** Reference type labels for citation display */
export const REFERENCE_TYPES: Record<string, { icon: string; label: string }> = {
  case: { icon: '⚖️', label: 'Case Reference' },
  section: { icon: '§', label: 'Section Reference' },
  article: { icon: '📄', label: 'Article Reference' },
  statute: { icon: '📜', label: 'Statute Reference' },
  commentary: { icon: '📖', label: 'Commentary Reference' },
};

export interface Author {
  id: string;
  name: string;
  role?: string;
  username?: string;
  reputation?: number;
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  author: Author;
  replies?: Message[];
  parent_id?: string | null;
  thread_type?: ThreadType;
  response_type?: 'answer' | 'reply';
  status?: 'open' | 'closed';
  closing_summary?: string | null;
  closed_by_name?: string | null;
  closed_at?: string | null;
  cited_participants?: string[];
  impact_summary?: string | null;
  vote_count?: number;
  user_voted?: boolean;
  reference_text?: string | null;
  reference_type?: string | null;
}

export interface ThreadCloseHandler {
  canClose: boolean;
  isParticipant: (threadParticipantIds: string[]) => boolean;
  onClose: (threadRootId: string, summary: string, citedUsers: string[], impactSummary?: string) => Promise<void>;
}

/** Derived reasoning quality signal — computed client-side from endorsement data */
export type ReasoningSignal = 'well_supported' | 'emerging' | 'contested' | null;

export type SortMode = 'recent' | 'useful' | 'active';
export type FilterMode = 'all' | 'question' | 'interpretation' | 'improvement' | 'issue' | 'resolved';
