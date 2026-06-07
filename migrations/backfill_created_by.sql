-- Backfill created_by for existing nodes
-- This finds the very first revision for each node and sets the node's creator to that revision's author.

UPDATE public.nodes
SET created_by = first_revs.author_id
FROM (
  SELECT node_id, author_id
  FROM (
    SELECT node_id, author_id,
           ROW_NUMBER() OVER (PARTITION BY node_id ORDER BY created_at ASC) as rn
    FROM public.revisions
  ) AS ranked
  WHERE rn = 1
) AS first_revs
WHERE nodes.id = first_revs.node_id
  AND nodes.created_by IS NULL;
