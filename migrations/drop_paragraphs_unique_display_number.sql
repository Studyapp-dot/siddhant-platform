-- Drop the restrictive full-table unique constraint that causes UPDATE collisions and soft-delete conflicts.
-- The display_number uniqueness is enforced among active paragraphs at the application layer 
-- (specifically via the atomic insert/delete/save RPCs).

ALTER TABLE public.paragraphs DROP CONSTRAINT IF EXISTS paragraphs_unique_display_number;
