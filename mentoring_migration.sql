-- ============================================================
-- SIDDHANT: MENTORING SYSTEM & GROUP-REPORT ASSOCIATIONS
-- Voluntary opt-in mentoring + domain Report tracking
-- ============================================================
-- Run this entire script in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times.
-- ============================================================


-- ============================================================
-- 1. MENTOR REQUESTS
--    Newcomer requests a mentor within a subject group.
--    (Research: Adopt-a-User model, voluntary opt-in)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mentor_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES public.subject_groups ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'withdrawn')),
  message text,  -- optional message from newcomer
  accepted_by uuid REFERENCES public.profiles ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at timestamptz,
  -- One open request per user per group
  UNIQUE (requester_id, group_id, status)
);

ALTER TABLE public.mentor_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Mentor requests are viewable by group members.' AND tablename = 'mentor_requests'
  ) THEN
    CREATE POLICY "Mentor requests are viewable by group members."
      ON public.mentor_requests FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can create mentor requests.' AND tablename = 'mentor_requests'
  ) THEN
    CREATE POLICY "Authenticated users can create mentor requests."
      ON public.mentor_requests FOR INSERT
      WITH CHECK (auth.uid() = requester_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Mentor requests can be updated by involved parties.' AND tablename = 'mentor_requests'
  ) THEN
    CREATE POLICY "Mentor requests can be updated by involved parties."
      ON public.mentor_requests FOR UPDATE
      USING (
        auth.uid() = requester_id
        OR EXISTS (
          SELECT 1 FROM subject_group_members
          WHERE user_id = auth.uid()
            AND group_id = mentor_requests.group_id
            AND role IN ('mentor', 'coordinator')
        )
      );
  END IF;
END $$;


-- ============================================================
-- 2. MENTORSHIPS
--    Active mentoring relationships, informal and time-unlimited.
--    (Research: relationship ends when both parties feel it has run its course)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mentorships (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  mentor_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  mentee_id uuid REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES public.subject_groups ON DELETE CASCADE NOT NULL,
  request_id uuid REFERENCES public.mentor_requests ON DELETE SET NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at timestamptz,
  ended_by uuid REFERENCES public.profiles ON DELETE SET NULL,
  UNIQUE (mentor_id, mentee_id, group_id)
);

ALTER TABLE public.mentorships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Mentorships are viewable by everyone.' AND tablename = 'mentorships'
  ) THEN
    CREATE POLICY "Mentorships are viewable by everyone."
      ON public.mentorships FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Mentors and mentees can create mentorships.' AND tablename = 'mentorships'
  ) THEN
    CREATE POLICY "Mentors and mentees can create mentorships."
      ON public.mentorships FOR INSERT
      WITH CHECK (auth.uid() = mentor_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Either party can update a mentorship.' AND tablename = 'mentorships'
  ) THEN
    CREATE POLICY "Either party can update a mentorship."
      ON public.mentorships FOR UPDATE
      USING (auth.uid() = mentor_id OR auth.uid() = mentee_id);
  END IF;
END $$;


-- ============================================================
-- 3. GROUP-NODE ASSOCIATIONS (Many-to-Many)
--    Links subject groups to Reports in their domain.
--    A Report can belong to multiple groups.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.group_node_associations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES public.subject_groups ON DELETE CASCADE NOT NULL,
  node_id uuid REFERENCES public.nodes ON DELETE CASCADE NOT NULL,
  added_by uuid REFERENCES public.profiles ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (group_id, node_id)
);

ALTER TABLE public.group_node_associations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Group-node associations are viewable by everyone.' AND tablename = 'group_node_associations'
  ) THEN
    CREATE POLICY "Group-node associations are viewable by everyone."
      ON public.group_node_associations FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Group members can associate nodes.' AND tablename = 'group_node_associations'
  ) THEN
    CREATE POLICY "Group members can associate nodes."
      ON public.group_node_associations FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM subject_group_members
          WHERE user_id = auth.uid()
            AND group_id = group_node_associations.group_id
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Coordinators can remove node associations.' AND tablename = 'group_node_associations'
  ) THEN
    CREATE POLICY "Coordinators can remove node associations."
      ON public.group_node_associations FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM subject_group_members
          WHERE user_id = auth.uid()
            AND group_id = group_node_associations.group_id
            AND role IN ('coordinator', 'mentor')
        )
        OR EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('senior_validator', 'admin')
        )
      );
  END IF;
END $$;


-- ============================================================
-- DONE. Verify by running:
--   SELECT * FROM public.mentor_requests LIMIT 0;
--   SELECT * FROM public.mentorships LIMIT 0;
--   SELECT * FROM public.group_node_associations LIMIT 0;
-- ============================================================
