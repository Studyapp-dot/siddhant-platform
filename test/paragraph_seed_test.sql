-- ============================================================================
-- TEST SEED: Article 14 — Right to Equality (Paragraph-Native)
-- ============================================================================
-- Run AFTER paragraph_schema.sql.
-- Creates a test node and 10 paragraphs to validate the reading experience.
--
-- Prerequisites:
--   1. paragraph_schema.sql has been run
--   2. A user exists in profiles (the script uses a placeholder author_id)
--
-- IMPORTANT: Replace 'YOUR_USER_ID_HERE' with an actual profiles.id UUID.
-- You can find yours with: SELECT id FROM profiles LIMIT 1;
-- ============================================================================

-- Step 1: Create the test node (if it doesn't already exist)
INSERT INTO public.nodes (id, slug, title, node_type)
VALUES (
  'a14a14a1-4a14-4a14-a14a-14a14a14a14a',
  'article-14-test',
  'Article 14 — Right to Equality',
  'constitutional_provision'
)
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Insert paragraphs
-- Replace YOUR_USER_ID_HERE with a real user UUID from your profiles table.
-- E.g.: SELECT id FROM profiles LIMIT 1;

DO $$
DECLARE
  v_node_id uuid := 'a14a14a1-4a14-4a14-a14a-14a14a14a14a';
  v_author_id uuid;
BEGIN
  -- Get first available user as author (fallback for seeding)
  SELECT id INTO v_author_id FROM public.profiles LIMIT 1;

  IF v_author_id IS NULL THEN
    RAISE NOTICE 'No profiles found. Skipping paragraph seeding. Create a user first.';
    RETURN;
  END IF;

  -- ¶1 — The guarantee stated
  INSERT INTO public.paragraphs (node_id, stable_id, display_number, marginal_note, content, group_label, order_index, created_by)
  VALUES (v_node_id, 'p_art141', 1, 'The guarantee stated',
  'Article 14 of the Constitution of India is placed first among the Fundamental Rights in Part III. Its position is deliberate. The framers considered equality the foundation upon which all other rights rest. Without equality, liberty becomes privilege and justice becomes discretion.

> The State shall not deny to any person equality before the law or the equal protection of the laws within the territory of India.', 
  'Text of the Provision', 1, v_author_id)
  ON CONFLICT (node_id, stable_id) DO NOTHING;

  -- ¶2 — Two expressions, one guarantee
  INSERT INTO public.paragraphs (node_id, stable_id, display_number, marginal_note, content, group_label, order_index, created_by)
  VALUES (v_node_id, 'p_art142', 2, 'Two expressions',
  'Article 14 uses two phrases: "equality before the law" and "equal protection of the laws." The first is borrowed from the English common law tradition, articulated by Dicey as a component of the rule of law — no person is above the law. The second is borrowed from the Fourteenth Amendment to the United States Constitution. In *Anwar Ali Sarkar v. State of West Bengal* (1952), the Supreme Court held that both phrases express the same constitutional idea and must be read together as a single integrated guarantee.',
  'Text of the Provision', 2, v_author_id)
  ON CONFLICT (node_id, stable_id) DO NOTHING;

  -- ¶3 — Constituent Assembly debates
  INSERT INTO public.paragraphs (node_id, stable_id, display_number, marginal_note, content, group_label, order_index, created_by)
  VALUES (v_node_id, 'p_art143', 3, 'Assembly debates',
  'The language of Article 14 was debated extensively in the Constituent Assembly. Dr. B.R. Ambedkar explained that equality was not a mathematical concept requiring identical treatment but a principle requiring the absence of arbitrary discrimination. The Assembly rejected a proposal to limit equality to citizens alone, deliberately choosing the word "person" to extend the guarantee to non-citizens within Indian territory.',
  'Historical Context', 3, v_author_id)
  ON CONFLICT (node_id, stable_id) DO NOTHING;

  -- ¶4 — Influence of American jurisprudence
  INSERT INTO public.paragraphs (node_id, stable_id, display_number, marginal_note, content, group_label, order_index, created_by)
  VALUES (v_node_id, 'p_art144', 4, 'American influence',
  'The phrase "equal protection of the laws" was directly borrowed from Section 1 of the Fourteenth Amendment. The framers were influenced by American case law, especially the "reasonable classification" doctrine developed in *Lindsley v. Natural Carbonic Gas Co.* (1911) and *F.S. Royster Guano Co. v. Virginia* (1920). These cases established that equality does not forbid classification, but requires that classification bear a reasonable relation to the object of the legislation.',
  'Historical Context', 4, v_author_id)
  ON CONFLICT (node_id, stable_id) DO NOTHING;

  -- ¶5 — Permissible classification
  INSERT INTO public.paragraphs (node_id, stable_id, display_number, marginal_note, content, group_label, order_index, created_by)
  VALUES (v_node_id, 'p_art145', 5, 'Permissible classification',
  'Article 14 does not forbid all classification. It forbids only "class legislation" — legislation which makes an arbitrary distinction between persons who are similarly situated. The State may classify persons into groups and treat different groups differently, provided the classification satisfies two conditions, articulated in *State of West Bengal v. Anwar Ali Sarkar* (1952):

1. The classification must be founded on an **intelligible differentia** — a real and substantial distinction that distinguishes persons grouped together from those left out.
2. The differentia must have a **rational nexus** with the object sought to be achieved by the legislation.',
  'Classification Doctrine', 5, v_author_id)
  ON CONFLICT (node_id, stable_id) DO NOTHING;

  -- ¶6 — Intelligible differentia
  INSERT INTO public.paragraphs (node_id, stable_id, display_number, marginal_note, content, group_label, order_index, created_by)
  VALUES (v_node_id, 'p_art146', 6, 'Intelligible differentia',
  'The first limb — intelligible differentia — requires that the basis of classification be understandable and not arbitrary. The differentia need not be scientifically perfect or logically flawless. It must merely be a distinction that a reasonable person can perceive. In *Ram Krishna Dalmia v. Justice Tendolkar* (1958), the Supreme Court laid down that classification can be based on geographical location, occupation, the nature of the trade, the nature of the right affected, or any other ground that is relevant and not arbitrary.',
  'Classification Doctrine', 6, v_author_id)
  ON CONFLICT (node_id, stable_id) DO NOTHING;

  -- ¶7 — Rational nexus
  INSERT INTO public.paragraphs (node_id, stable_id, display_number, marginal_note, content, group_label, order_index, created_by)
  VALUES (v_node_id, 'p_art147', 7, 'Rational nexus',
  'The second limb — rational nexus — requires that the basis of classification have a reasonable connection to the purpose of the legislation. The connection need not be direct or immediately obvious, but it must be real, not illusory. In *Budhan Choudhry v. State of Bihar* (1955), the Supreme Court explained: "The legislature is free to recognise degrees of harm and may confine its restrictions to those cases where the need is deemed to be the clearest."',
  'Classification Doctrine', 7, v_author_id)
  ON CONFLICT (node_id, stable_id) DO NOTHING;

  -- ¶8 — Royappa: equality as non-arbitrariness
  INSERT INTO public.paragraphs (node_id, stable_id, display_number, marginal_note, content, group_label, order_index, created_by)
  VALUES (v_node_id, 'p_art148', 8, 'Royappa — non-arbitrariness',
  'In *E.P. Royappa v. State of Tamil Nadu* (1974), Justice P.N. Bhagwati introduced a fundamentally new reading of Article 14:

> "Equality is a dynamic concept with many aspects and dimensions and it cannot be ''cribbed, cabined, and confined'' within traditional and doctrinaire limits. From a positivistic point of view, equality is antithetic to arbitrariness. In fact, equality and arbitrariness are sworn enemies."

This passage transformed Article 14 from a classification-testing mechanism to a general prohibition on arbitrary State action.',
  'Arbitrariness Doctrine', 8, v_author_id)
  ON CONFLICT (node_id, stable_id) DO NOTHING;

  -- ¶9 — Maneka Gandhi: consolidation
  INSERT INTO public.paragraphs (node_id, stable_id, display_number, marginal_note, content, group_label, order_index, created_by)
  VALUES (v_node_id, 'p_art149', 9, 'Maneka Gandhi',
  'In *Maneka Gandhi v. Union of India* (1978), the expanded understanding of Article 14 was consolidated. The Court held that Article 14 strikes at arbitrariness in State action and ensures fairness and equality of treatment. The impact extended beyond Article 14: it established that Articles 14, 19, and 21 are not mutually exclusive but form a "golden triangle" of rights, each illuminating the content of the others.',
  'Arbitrariness Doctrine', 9, v_author_id)
  ON CONFLICT (node_id, stable_id) DO NOTHING;

  -- ¶10 — Current position
  INSERT INTO public.paragraphs (node_id, stable_id, display_number, marginal_note, content, group_label, order_index, created_by)
  VALUES (v_node_id, 'p_art14a', 10, 'Current position',
  'The law under Article 14, as it stands today, can be summarised as follows. The State shall not deny equality to any person. Laws that classify persons into groups are permitted if the classification is founded on an intelligible differentia bearing a rational nexus to the object of the law. Beyond classification, any State action — whether legislative, executive, or administrative — that is manifestly arbitrary is unconstitutional under Article 14. The two tests (classification and arbitrariness) are complementary, not alternative.',
  'Current Position', 10, v_author_id)
  ON CONFLICT (node_id, stable_id) DO NOTHING;

  -- Create initial revision records for each paragraph
  INSERT INTO public.paragraph_revisions (paragraph_id, node_id, author_id, content, marginal_note, commit_message, revision_type, content_size)
  SELECT p.id, p.node_id, v_author_id, p.content, p.marginal_note, 'Initial paragraph-native authoring', 'creation', length(p.content)
  FROM public.paragraphs p
  WHERE p.node_id = v_node_id
  AND NOT EXISTS (
    SELECT 1 FROM public.paragraph_revisions pr WHERE pr.paragraph_id = p.id
  );

  RAISE NOTICE 'Seeded % paragraphs for article-14-test', (SELECT count(*) FROM public.paragraphs WHERE node_id = v_node_id);
END $$;
