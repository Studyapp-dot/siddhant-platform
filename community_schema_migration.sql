-- ============================================================
-- SIDDHANT: COMMUNITY COMMUNICATION INFRASTRUCTURE
-- Three-Space Architecture: Report Discussions, User Pages, Group Forums
-- ============================================================
-- Run this entire script in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. ENHANCE EXISTING DISCUSSIONS TABLE
--    Add formal closing mechanism (Research.md: Report Discussion Pages)
--    Level 4+ non-participants can close and record consensus
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.discussions
      ADD COLUMN status text DEFAULT 'open' CHECK (status IN ('open', 'closed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE public.discussions
      ADD COLUMN closed_by uuid REFERENCES public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE public.discussions
      ADD COLUMN closed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discussions' AND column_name = 'closing_summary'
  ) THEN
    ALTER TABLE public.discussions
      ADD COLUMN closing_summary text;
  END IF;
END $$;

-- Allow senior_validators and admins to update discussions (for closing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Senior users can close discussions.' AND tablename = 'discussions'
  ) THEN
    CREATE POLICY "Senior users can close discussions."
      ON public.discussions FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role IN ('senior_validator', 'admin')
        )
      );
  END IF;
END $$;


-- ============================================================
-- 2. USER DISCUSSION PAGES
--    Every registered user has a personal discussion page
--    (Research.md: User Discussion Pages)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_discussions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  target_user_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,  -- whose page
  author_id uuid REFERENCES public.profiles NOT NULL,                          -- who wrote it
  content text NOT NULL,
  parent_id uuid REFERENCES public.user_discussions ON DELETE CASCADE,        -- threading
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_discussions ENABLE ROW LEVEL SECURITY;

-- Everyone can read user discussion pages (they are public per research spec)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'User discussions are viewable by everyone.' AND tablename = 'user_discussions'
  ) THEN
    CREATE POLICY "User discussions are viewable by everyone."
      ON public.user_discussions FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Registered users can post on user discussion pages.' AND tablename = 'user_discussions'
  ) THEN
    CREATE POLICY "Registered users can post on user discussion pages."
      ON public.user_discussions FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;


-- ============================================================
-- 3. SUBJECT-AREA CONTRIBUTOR GROUPS
--    (Research.md: Subject-Area Group Forums)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subject_groups (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug text UNIQUE NOT NULL,             -- e.g., 'constitutional-law'
  name text NOT NULL,                    -- e.g., 'Constitutional Law'
  description text,
  icon text,                             -- emoji or icon identifier
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subject_groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Subject groups are viewable by everyone.' AND tablename = 'subject_groups'
  ) THEN
    CREATE POLICY "Subject groups are viewable by everyone."
      ON public.subject_groups FOR SELECT USING (true);
  END IF;
END $$;


-- ============================================================
-- 4. SUBJECT GROUP MEMBERSHIP
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subject_group_members (
  user_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES public.subject_groups ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('member', 'mentor', 'coordinator')),
  joined_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, group_id)
);

ALTER TABLE public.subject_group_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Group memberships are viewable by everyone.' AND tablename = 'subject_group_members'
  ) THEN
    CREATE POLICY "Group memberships are viewable by everyone."
      ON public.subject_group_members FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Registered users can join groups.' AND tablename = 'subject_group_members'
  ) THEN
    CREATE POLICY "Registered users can join groups."
      ON public.subject_group_members FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can leave groups.' AND tablename = 'subject_group_members'
  ) THEN
    CREATE POLICY "Users can leave groups."
      ON public.subject_group_members FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================
-- 5. GROUP FORUM DISCUSSIONS
--    Threads within subject-area groups with typed categories
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_discussions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES public.subject_groups ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES public.profiles NOT NULL,
  content text NOT NULL,
  thread_type text DEFAULT 'general' CHECK (thread_type IN ('general', 'coordination', 'mentoring', 'announcement')),
  parent_id uuid REFERENCES public.group_discussions ON DELETE CASCADE,
  pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.group_discussions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Group discussions are viewable by everyone.' AND tablename = 'group_discussions'
  ) THEN
    CREATE POLICY "Group discussions are viewable by everyone."
      ON public.group_discussions FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Registered users can post in group forums.' AND tablename = 'group_discussions'
  ) THEN
    CREATE POLICY "Registered users can post in group forums."
      ON public.group_discussions FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Coordinators and admins can pin group threads.' AND tablename = 'group_discussions'
  ) THEN
    CREATE POLICY "Coordinators and admins can pin group threads."
      ON public.group_discussions FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('senior_validator', 'admin')
        )
        OR
        EXISTS (
          SELECT 1 FROM subject_group_members
          WHERE user_id = auth.uid()
            AND group_id = group_discussions.group_id
            AND role = 'coordinator'
        )
      );
  END IF;
END $$;


-- ============================================================
-- 6. SEED INITIAL SUBJECT-AREA GROUPS
--    (Research.md: seed with 3-4 students who actively care)
--    Groups seeded empty — real members join organically
-- ============================================================

INSERT INTO public.subject_groups (slug, name, description, icon) VALUES
  ('constitutional-law', 'Constitutional Law',
   'Fundamental rights, directive principles, constitutional interpretation, landmark Supreme Court judgments, and the evolving architecture of Indian constitutional governance.',
   '⚖️'),
  ('criminal-law', 'Criminal Law',
   'BNS/IPC offences, criminal procedure (BNSS/CrPC), evidence law (BSA), criminal jurisprudence, and landmark criminal justice decisions.',
   '🔒'),
  ('labour-industrial-law', 'Labour & Industrial Law',
   'Industrial relations, labour codes, trade union law, social security legislation, and worker protection jurisprudence.',
   '🏭'),
  ('family-personal-law', 'Family Law & Personal Laws',
   'Marriage, divorce, maintenance, succession, adoption, and guardianship under Hindu, Muslim, Christian, and secular personal law frameworks.',
   '👨‍👩‍👧'),
  ('contract-commercial-law', 'Contract & Commercial Law',
   'Indian Contract Act, Sale of Goods, Negotiable Instruments, Partnership, Company Law, and commercial dispute principles.',
   '📜'),
  ('administrative-service-law', 'Administrative & Service Law',
   'Judicial review, administrative tribunals, natural justice, delegated legislation, and service jurisprudence.',
   '🏛️')
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- DONE. Verify by running:
--   SELECT * FROM public.subject_groups;
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'discussions';
-- ============================================================
