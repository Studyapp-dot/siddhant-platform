-- ============================================================================
-- SIDDHANT: Hard Delete FK Cascade Fix
-- ============================================================================
-- Run this after 005 if Supabase Auth still reports:
--   "Failed to delete user: Database error deleting user"
--
-- 005 had the right intent, but its constraint discovery used a table oid as a
-- namespace oid. This migration uses pg_class/pg_namespace joins and rewrites
-- every public-schema FK that points at auth.users or public.profiles so Auth
-- hard-delete can cascade through the public profile/activity graph.
--
-- Operational note: hard-deleting an Auth user will delete that user's profile
-- and rows that directly reference that profile/user.
-- ============================================================================

DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT
      con.conname,
      quote_ident(child_ns.nspname) || '.' || quote_ident(child_cls.relname) AS child_table,
      quote_ident(parent_ns.nspname) || '.' || quote_ident(parent_cls.relname) AS parent_table,
      string_agg(quote_ident(child_att.attname), ', ' ORDER BY keys.ord) AS child_columns,
      string_agg(quote_ident(parent_att.attname), ', ' ORDER BY keys.ord) AS parent_columns
    FROM pg_constraint con
    JOIN pg_class child_cls
      ON child_cls.oid = con.conrelid
    JOIN pg_namespace child_ns
      ON child_ns.oid = child_cls.relnamespace
    JOIN pg_class parent_cls
      ON parent_cls.oid = con.confrelid
    JOIN pg_namespace parent_ns
      ON parent_ns.oid = parent_cls.relnamespace
    JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS keys(child_attnum, parent_attnum, ord)
      ON true
    JOIN pg_attribute child_att
      ON child_att.attrelid = con.conrelid
     AND child_att.attnum = keys.child_attnum
    JOIN pg_attribute parent_att
      ON parent_att.attrelid = con.confrelid
     AND parent_att.attnum = keys.parent_attnum
    WHERE con.contype = 'f'
      AND child_ns.nspname = 'public'
      AND (
        (parent_ns.nspname = 'auth' AND parent_cls.relname = 'users')
        OR (parent_ns.nspname = 'public' AND parent_cls.relname = 'profiles')
      )
    GROUP BY con.conname, child_ns.nspname, child_cls.relname, parent_ns.nspname, parent_cls.relname
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.child_table, fk.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %s (%s) ON DELETE CASCADE',
      fk.child_table,
      fk.conname,
      fk.child_columns,
      fk.parent_table,
      fk.parent_columns
    );
  END LOOP;
END $$;

-- Verification: this should return zero rows after the migration.
-- Any rows returned here are still blocking Auth hard-delete.
SELECT
  child_ns.nspname || '.' || child_cls.relname AS child_table,
  con.conname AS constraint_name,
  parent_ns.nspname || '.' || parent_cls.relname AS parent_table,
  con.confdeltype AS delete_action
FROM pg_constraint con
JOIN pg_class child_cls ON child_cls.oid = con.conrelid
JOIN pg_namespace child_ns ON child_ns.oid = child_cls.relnamespace
JOIN pg_class parent_cls ON parent_cls.oid = con.confrelid
JOIN pg_namespace parent_ns ON parent_ns.oid = parent_cls.relnamespace
WHERE con.contype = 'f'
  AND child_ns.nspname = 'public'
  AND con.confdeltype <> 'c'
  AND (
    (parent_ns.nspname = 'auth' AND parent_cls.relname = 'users')
    OR (parent_ns.nspname = 'public' AND parent_cls.relname = 'profiles')
  )
ORDER BY child_table, constraint_name;
