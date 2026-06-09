-- Paragraph-native stabilization:
-- 1. paragraph-scoped authority anchors
-- 2. atomic paragraph save/insert/delete + revision creation

ALTER TABLE public.authority_anchors
  ADD COLUMN IF NOT EXISTS paragraph_id uuid REFERENCES public.paragraphs(id) ON DELETE CASCADE;

ALTER TABLE public.authority_anchors
  ADD COLUMN IF NOT EXISTS paragraph_revision_id uuid REFERENCES public.paragraph_revisions(id) ON DELETE SET NULL;

ALTER TABLE public.authority_anchors
  ALTER COLUMN revision_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_authority_anchors_paragraph_active
  ON public.authority_anchors (paragraph_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_authority_anchors_paragraph_revision
  ON public.authority_anchors (paragraph_revision_id);

CREATE OR REPLACE FUNCTION public.insert_paragraph_authority_anchors(
  p_node_id uuid,
  p_paragraph_id uuid,
  p_paragraph_revision_id uuid,
  p_author_id uuid,
  p_anchors jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anchor jsonb;
  v_authority_node_id uuid;
  v_authority_node_id_text text;
BEGIN
  IF p_anchors IS NULL OR jsonb_typeof(p_anchors) <> 'array' THEN
    RETURN;
  END IF;

  FOR v_anchor IN SELECT * FROM jsonb_array_elements(p_anchors)
  LOOP
    IF nullif(trim(v_anchor->>'anchor_text'), '') IS NULL
       OR nullif(trim(v_anchor->>'authority_type'), '') IS NULL
       OR nullif(trim(v_anchor->>'authority_title'), '') IS NULL THEN
      CONTINUE;
    END IF;

    v_authority_node_id_text := nullif(trim(v_anchor->>'authority_node_id'), '');
    v_authority_node_id := NULL;

    IF v_authority_node_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_authority_node_id := v_authority_node_id_text::uuid;
    END IF;

    INSERT INTO public.authority_anchors (
      node_id,
      revision_id,
      paragraph_id,
      paragraph_revision_id,
      author_id,
      anchor_text,
      context_before,
      context_after,
      paragraph_index,
      authority_type,
      authority_title,
      authority_citation,
      authority_url,
      authority_node_id,
      source_tier
    )
    VALUES (
      p_node_id,
      NULL,
      p_paragraph_id,
      p_paragraph_revision_id,
      p_author_id,
      trim(v_anchor->>'anchor_text'),
      coalesce(v_anchor->>'context_before', ''),
      coalesce(v_anchor->>'context_after', ''),
      coalesce(nullif(v_anchor->>'paragraph_index', '')::integer, 0),
      trim(v_anchor->>'authority_type'),
      trim(v_anchor->>'authority_title'),
      nullif(trim(v_anchor->>'authority_citation'), ''),
      nullif(trim(v_anchor->>'authority_url'), ''),
      v_authority_node_id,
      coalesce(nullif(trim(v_anchor->>'source_tier'), ''), 'primary')
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.renumber_active_paragraphs(p_node_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY order_index, created_at, id) AS rn
    FROM public.paragraphs
    WHERE node_id = p_node_id
      AND deleted_at IS NULL
  )
  UPDATE public.paragraphs p
  SET display_number = -ordered.rn
  FROM ordered
  WHERE p.id = ordered.id;

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY order_index, created_at, id) AS rn
    FROM public.paragraphs
    WHERE node_id = p_node_id
      AND deleted_at IS NULL
  )
  UPDATE public.paragraphs p
  SET display_number = ordered.rn,
      order_index = ordered.rn,
      updated_at = now()
  FROM ordered
  WHERE p.id = ordered.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_paragraph_with_revision(
  p_paragraph_id uuid,
  p_content text,
  p_marginal_note text,
  p_commit_message text,
  p_revision_type text,
  p_content_size integer,
  p_author_id uuid,
  p_authority_anchors jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paragraph public.paragraphs%rowtype;
  v_revision_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_author_id THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_paragraph
  FROM public.paragraphs
  WHERE id = p_paragraph_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paragraph not found';
  END IF;

  INSERT INTO public.paragraph_revisions (
    paragraph_id,
    node_id,
    author_id,
    content,
    marginal_note,
    commit_message,
    revision_type,
    content_size
  )
  VALUES (
    p_paragraph_id,
    v_paragraph.node_id,
    p_author_id,
    p_content,
    p_marginal_note,
    p_commit_message,
    p_revision_type,
    p_content_size
  )
  RETURNING id INTO v_revision_id;

  UPDATE public.paragraphs
  SET content = p_content,
      marginal_note = p_marginal_note,
      updated_at = now()
  WHERE id = p_paragraph_id;

  PERFORM public.insert_paragraph_authority_anchors(
    v_paragraph.node_id,
    p_paragraph_id,
    v_revision_id,
    p_author_id,
    p_authority_anchors
  );

  RETURN jsonb_build_object('paragraph_id', p_paragraph_id, 'revision_id', v_revision_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_paragraph_with_revision(
  p_node_id uuid,
  p_after_order integer,
  p_content text,
  p_marginal_note text,
  p_group_label text,
  p_stable_id text,
  p_author_id uuid,
  p_content_size integer,
  p_authority_anchors jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paragraph_id uuid;
  v_revision_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_author_id THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM id
  FROM public.paragraphs
  WHERE node_id = p_node_id
  FOR UPDATE;

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY order_index, created_at, id) AS rn
    FROM public.paragraphs
    WHERE node_id = p_node_id
      AND deleted_at IS NULL
  )
  UPDATE public.paragraphs p
  SET display_number = -ordered.rn
  FROM ordered
  WHERE p.id = ordered.id;

  UPDATE public.paragraphs
  SET order_index = order_index + 1
  WHERE node_id = p_node_id
    AND deleted_at IS NULL
    AND order_index > p_after_order;

  INSERT INTO public.paragraphs (
    node_id,
    stable_id,
    display_number,
    marginal_note,
    content,
    group_label,
    order_index,
    created_by
  )
  VALUES (
    p_node_id,
    p_stable_id,
    -999999,
    p_marginal_note,
    p_content,
    p_group_label,
    p_after_order + 1,
    p_author_id
  )
  RETURNING id INTO v_paragraph_id;

  PERFORM public.renumber_active_paragraphs(p_node_id);

  INSERT INTO public.paragraph_revisions (
    paragraph_id,
    node_id,
    author_id,
    content,
    marginal_note,
    commit_message,
    revision_type,
    content_size
  )
  VALUES (
    v_paragraph_id,
    p_node_id,
    p_author_id,
    p_content,
    p_marginal_note,
    'New paragraph created',
    'creation',
    p_content_size
  )
  RETURNING id INTO v_revision_id;

  PERFORM public.insert_paragraph_authority_anchors(
    p_node_id,
    v_paragraph_id,
    v_revision_id,
    p_author_id,
    p_authority_anchors
  );

  RETURN jsonb_build_object('paragraph_id', v_paragraph_id, 'revision_id', v_revision_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_paragraph_with_revision(
  p_paragraph_id uuid,
  p_author_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paragraph public.paragraphs%rowtype;
  v_revision_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_author_id THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_paragraph
  FROM public.paragraphs
  WHERE id = p_paragraph_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paragraph not found';
  END IF;

  INSERT INTO public.paragraph_revisions (
    paragraph_id,
    node_id,
    author_id,
    content,
    marginal_note,
    commit_message,
    revision_type,
    content_size
  )
  VALUES (
    p_paragraph_id,
    v_paragraph.node_id,
    p_author_id,
    v_paragraph.content,
    v_paragraph.marginal_note,
    'Paragraph deleted',
    'deletion',
    0
  )
  RETURNING id INTO v_revision_id;

  UPDATE public.paragraphs
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = p_paragraph_id;

  PERFORM public.renumber_active_paragraphs(v_paragraph.node_id);

  RETURN jsonb_build_object('paragraph_id', p_paragraph_id, 'revision_id', v_revision_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_paragraph_with_revision(uuid, text, text, text, text, integer, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_paragraph_with_revision(uuid, integer, text, text, text, text, uuid, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_paragraph_with_revision(uuid, uuid) TO authenticated;
