-- ============================================================================
-- SIDDHANT: User Lifecycle & Google Profile Repair
-- ============================================================================
-- Fixes two production issues:
--   1. Google OAuth users can have auth metadata that does not match
--      public.profiles.username, causing /profile/<email-prefix> to 404.
--   2. Hard-deleting a user in Supabase Auth can be blocked by public-schema
--      foreign keys that reference profiles/users without ON DELETE CASCADE.
--
-- Operational note: this enables hard deletion. Deleting a Supabase Auth user
-- will also delete that user's public profile-linked activity rows.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.siddhant_profile_username(
  raw_username text,
  raw_email text,
  user_id uuid
)
RETURNS text AS $$
DECLARE
  base text;
  candidate text;
  suffix text := replace(substr(user_id::text, 1, 8), '-', '');
  counter integer := 0;
BEGIN
  base := lower(coalesce(
    nullif(trim(raw_username), ''),
    nullif(split_part(coalesce(raw_email, ''), '@', 1), ''),
    'user_' || suffix
  ));
  base := regexp_replace(base, '[^a-z0-9_]+', '_', 'g');
  base := regexp_replace(base, '_+', '_', 'g');
  base := trim(both '_' from base);

  IF base = '' THEN
    base := 'user_' || suffix;
  END IF;

  IF length(base) < 3 THEN
    base := base || '_' || substr(suffix, 1, 4);
  END IF;

  candidate := left(base, 32);

  WHILE EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE username = candidate
      AND id <> user_id
  ) LOOP
    counter := counter + 1;
    candidate := left(base, 25) || '_' || substr(suffix, 1, 4) || '_' || counter::text;
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    full_display_name,
    profile_photo
  )
  VALUES (
    new.id,
    public.siddhant_profile_username(new.raw_user_meta_data->>'username', new.email, new.id),
    NULLIF(COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), ''),
    NULLIF(COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(NULLIF(public.profiles.username, ''), EXCLUDED.username),
    full_display_name = COALESCE(public.profiles.full_display_name, EXCLUDED.full_display_name),
    profile_photo = COALESCE(public.profiles.profile_photo, EXCLUDED.profile_photo);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Repair existing Auth users whose profile row was never created.
INSERT INTO public.profiles (
  id,
  username,
  full_display_name,
  profile_photo
)
SELECT
  u.id,
  public.siddhant_profile_username(u.raw_user_meta_data->>'username', u.email, u.id),
  NULLIF(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), ''),
  NULLIF(COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'), '')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- Make Auth hard-delete work by cascading profile deletion from auth.users,
-- then cascading rows that directly reference public.profiles.
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT
      con.oid,
      con.conname,
      con.conrelid,
      con.confrelid,
      con.conrelid::regclass::text AS table_name,
      con.confrelid::regclass::text AS referenced_table_name,
      string_agg(quote_ident(child_att.attname), ', ' ORDER BY keys.ord) AS child_columns,
      string_agg(quote_ident(parent_att.attname), ', ' ORDER BY keys.ord) AS parent_columns
    FROM pg_constraint con
    JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS keys(child_attnum, parent_attnum, ord)
      ON true
    JOIN pg_attribute child_att
      ON child_att.attrelid = con.conrelid
     AND child_att.attnum = keys.child_attnum
    JOIN pg_attribute parent_att
      ON parent_att.attrelid = con.confrelid
     AND parent_att.attnum = keys.parent_attnum
    WHERE con.contype = 'f'
      AND con.confrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
      AND con.conrelid::regnamespace::text = 'public'
    GROUP BY con.oid, con.conname, con.conrelid, con.confrelid
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.table_name, fk.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %s (%s) ON DELETE CASCADE',
      fk.table_name,
      fk.conname,
      fk.child_columns,
      fk.referenced_table_name,
      fk.parent_columns
    );
  END LOOP;
END $$;
