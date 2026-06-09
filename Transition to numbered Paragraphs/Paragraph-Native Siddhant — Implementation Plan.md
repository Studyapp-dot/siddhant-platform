# Paragraph-Native Siddhant — Implementation Plan

> **Status**: Architecture approved with modifications. This is the final build specification.

---

## Finalized Architecture Decisions

These are locked. They incorporate all feedback from the three audits, the prototype, the example document, and the manager's reviews.

| Decision | Resolution |
|----------|-----------|
| Node structure | **Flat**: Node → Paragraphs. No intermediate section table. |
| Grouping | `group_label` field on paragraphs (denormalized string, no FK). |
| Display numbering | **Auto-renumbered** sequential integers (`1, 2, 3...`). Renumber on insert/reorder/delete. |
| Permanent identity | `stable_id` (e.g. `p_k7m2x9`). Never changes. Used for URL resolution, edge FKs, discussion FKs. |
| Marginal notes | **Author-provided** text field. Not auto-extracted. |
| Paragraph content | Markdown. One idea per paragraph. |
| Revision model | **Paragraph-level** revisions as the primary authoring unit. Node-level snapshots deferred to Phase 2. |
| Edge targeting | `target_paragraph_id` added to `cross_references`. Nullable. **Deferred to Phase 1.5.** |
| Section table | `article_sections` **retained** in Phase 1. Stop using it. Decide on removal in Phase 2. |

---

## MVP Scope (Phase 1)

Build only what creates the new experience:

```
✓ Paragraph table + schema
✓ Content migration script
✓ Paragraph rendering (reader view)
✓ Paragraph editing (focused single-paragraph editor)
✓ Paragraph revisions (creation + history)
✓ Editorial guidance visible in-editor

✗ Paragraph-targeted edges     (Phase 1.5 — after core is validated)
✗ Edge migration               (Phase 1.5)
✗ article_sections removal     (Phase 2 — decide after Phase 1 is stable)
✗ Paragraph discussions        (Phase 2)
✗ Node snapshots               (Phase 2)
✗ Advanced citation features   (Phase 2)
✗ Paragraph search             (Phase 2)
✗ Paragraph reordering UI      (Phase 2)
```

---

## Schema

### New table: `paragraphs`

```sql
-- ============================================================================
-- SIDDHANT: Paragraph-Native Knowledge Model
-- ============================================================================
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.paragraphs (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id        uuid REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  stable_id      text NOT NULL,               -- Permanent opaque ID (e.g. 'p_k7m2x9')
  display_number integer NOT NULL,            -- Reading-order position (renumbered on insert/delete)
  marginal_note  text,                        -- Author-provided topical label
  content        text NOT NULL DEFAULT '',    -- Markdown content
  group_label    text,                        -- Visual grouping label (e.g. 'Classification Doctrine')
  order_index    integer NOT NULL,            -- Rendering order (== display_number in steady state)
  created_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz DEFAULT NOW(),
  updated_at     timestamptz DEFAULT NOW(),
  deleted_at     timestamptz,                 -- Soft delete preserves references

  UNIQUE(node_id, stable_id),
  UNIQUE(node_id, display_number) WHERE (deleted_at IS NULL)
);

CREATE INDEX idx_paragraphs_node_order
  ON public.paragraphs(node_id, order_index)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_paragraphs_node_stable
  ON public.paragraphs(node_id, stable_id);

-- RLS
ALTER TABLE public.paragraphs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paragraphs viewable by everyone."
  ON public.paragraphs FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert paragraphs."
  ON public.paragraphs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update paragraphs."
  ON public.paragraphs FOR UPDATE
  USING (auth.role() = 'authenticated');
```

### New table: `paragraph_revisions`

```sql
CREATE TABLE IF NOT EXISTS public.paragraph_revisions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paragraph_id    uuid REFERENCES public.paragraphs(id) ON DELETE CASCADE NOT NULL,
  node_id         uuid REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  author_id       uuid REFERENCES public.profiles(id) NOT NULL,
  content         text NOT NULL,              -- Full paragraph content at this revision
  marginal_note   text,                       -- Marginal note at this revision
  commit_message  text NOT NULL,
  revision_type   text DEFAULT 'content_edit'
    CHECK (revision_type IN ('creation', 'content_edit', 'marginal_note_edit', 'migration', 'deletion', 'revert')),
  content_size    integer,                    -- Visible text size (for delta checks)
  node_revision_id uuid,                     -- Future hook: link to node-level snapshot for point-in-time reconstruction
  created_at      timestamptz DEFAULT NOW()
);

CREATE INDEX idx_para_revisions_paragraph
  ON public.paragraph_revisions(paragraph_id, created_at DESC);

CREATE INDEX idx_para_revisions_node
  ON public.paragraph_revisions(node_id, created_at DESC);

-- RLS
ALTER TABLE public.paragraph_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paragraph revisions viewable by everyone."
  ON public.paragraph_revisions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert paragraph revisions."
  ON public.paragraph_revisions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

### Alter `cross_references` (Phase 1.5 — NOT Phase 1)

```sql
-- Run this ONLY in Phase 1.5, after paragraph core is validated.
ALTER TABLE public.cross_references
  ADD COLUMN IF NOT EXISTS target_paragraph_id uuid
  REFERENCES public.paragraphs(id) ON DELETE SET NULL;
```

### Helper function: generate `stable_id`

```sql
CREATE OR REPLACE FUNCTION generate_paragraph_stable_id()
RETURNS text AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := 'p_';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

> [!NOTE]
> `article_sections` table is NOT dropped or altered in Phase 1. Existing section-based edge code continues working. The section system is frozen, not removed.

---

## Implementation Phases

### Phase 1A: Schema (Day 1)

**Goal**: Paragraph tables exist. No content migration. No UI changes.

Old nodes continue rendering via `report_content` (permanent legacy format). New paragraph-native content is authored directly.

#### Tasks

- [ ] Run paragraph schema SQL (paragraphs, paragraph_revisions — NOT cross_references alter)
- [ ] Verify `article_sections` and `cross_references` are untouched

> [!NOTE]
> **No automatic migration.** Old `report_content` stays as-is. Important nodes will be manually rewritten as paragraph-native content by editors. The value comes from deliberate editorial structuring, not mechanical splitting.

#### Files to create

| File | Action |
|------|--------|
| `paragraph_schema.sql` | [NEW] Schema creation SQL (paragraphs + paragraph_revisions tables) |

---

### Phase 1B: Paragraph Rendering (Days 2–4)

**Goal**: Topic pages render from `paragraphs` table instead of `report_content`. Marginal notes visible. Group labels visible. Paragraph numbers in margin.

#### Tasks

- [ ] Create `getParagraphs(nodeId)` server action
- [ ] Create `ParagraphView` component (renders one paragraph with number + marginal note)
- [ ] Modify topic page to fetch paragraphs and render via `ParagraphView` instead of `ReportContent`
- [ ] Fallback: if no paragraphs exist for a node, render `report_content` as before (`report_content` is a permanent legacy format, not temporary — support it indefinitely)
- [ ] Style paragraph numbers and marginal notes (reuse seervai-prototype.css as base)
- [ ] Render group labels as visual separators between paragraph groups
- [ ] Add `id="p-{display_number}"` to each paragraph block for URL hash navigation
- [ ] Add hover action bar: Edit ¶N, Copy link to ¶N

#### Files to create/modify

| File | Action |
|------|--------|
| `src/app/actions/paragraphs.ts` | [NEW] `getParagraphs()`, `getParagraph()` server actions |
| `src/app/components/ParagraphView.tsx` | [NEW] Single paragraph display component |
| `src/app/components/ParagraphList.tsx` | [NEW] Ordered paragraph list with group separators |
| `src/app/components/paragraph-view.css` | [NEW] Paragraph styles (evolved from seervai-prototype.css) |
| `src/app/topic/[slug]/page.tsx` | [MODIFY] Fetch paragraphs, render ParagraphList OR ReportContent fallback |

---

### Phase 1C: Paragraph Editor (Days 7–12)

**Goal**: Contributors can edit a single paragraph through a focused editor. Saves create paragraph revisions.

#### Tasks

- [ ] Create `ParagraphEditor` component (focused single-paragraph textarea + marginal note field)
- [ ] Create `saveParagraph()` server action (validates, creates paragraph_revision, updates paragraph)
- [ ] Create `insertParagraph()` server action (creates new paragraph, renumbers subsequent paragraphs)
- [ ] Implement `renumberParagraphs(nodeId)` helper (updates display_number for all active paragraphs based on order_index)
- [ ] Add content-delta gate (same as current 20-char minimum on revisions)
- [ ] Add paragraph quality warnings (non-blocking, shown live in editor):
  - `⚠ Paragraph exceeds 450 words` (too large — may contain multiple ideas)
  - `⚠ Marginal note missing` (every paragraph should have one)
  - `⚠ Multiple headings detected` (a paragraph should not contain multiple headings)
  - `⚠ Paragraph may contain more than one major proposition` (heuristic: multiple bold phrases or sentence-starting "However,"/"Additionally," patterns)
- [ ] Surface editorial guidance panel inside the editor (collapsible, visible by default)
- [ ] Create "Edit ¶N" route or modal
- [ ] Create "+ Add paragraph" insertion points between paragraphs
- [ ] Create "New paragraph" creation flow (for nodes with no paragraphs)
- [ ] Wire up "Edit ¶N" button in ParagraphView hover action bar

#### Editor design

```
Route: /topic/{slug}/edit/{stable_id}
  OR
Modal: opened from ParagraphView action bar
```

The modal approach is recommended for MVP — it keeps the reader context visible and reduces navigation friction. The route approach can be added later for full-page editing.

#### Files to create/modify

| File | Action |
|------|--------|
| `src/app/components/ParagraphEditor.tsx` | [NEW] Focused paragraph editor (content + marginal note + commit message) |
| `src/app/actions/paragraphs.ts` | [MODIFY] Add `saveParagraph()`, `insertParagraph()`, `renumberParagraphs()` |
| `src/app/components/ParagraphList.tsx` | [MODIFY] Add "+ Add paragraph" insertion buttons |
| `src/app/components/paragraph-editor.css` | [NEW] Editor styles |

---

### Phase 1D: Paragraph Revisions (Days 12–14)

**Goal**: Each paragraph has visible revision history. Reviewers see paragraph-level diffs.

#### Tasks

- [ ] Create `getParagraphRevisions(paragraphId)` server action
- [ ] Create `ParagraphHistory` component (revision list for one paragraph)
- [ ] Add "History ¶N" button to paragraph hover action bar
- [ ] Show paragraph-level revision info in the existing contribution review drawer
- [ ] Support paragraph-level revert (create new revision with previous content)

#### Files to create/modify

| File | Action |
|------|--------|
| `src/app/actions/paragraphs.ts` | [MODIFY] Add `getParagraphRevisions()`, `revertParagraph()` |
| `src/app/components/ParagraphHistory.tsx` | [NEW] Paragraph revision timeline |

---

### Phase 1.5: Paragraph Edges (After Phase 1 validated)

**Goal**: Edges can target specific paragraphs. Edge form shows paragraph picker. Edge display shows paragraph reference.

**Prerequisite**: Phase 1 is live. People are reading and editing using paragraphs. The core experience is validated.

#### Tasks

- [ ] Run `ALTER TABLE cross_references ADD COLUMN target_paragraph_id`
- [ ] Modify `EdgeForm` to show paragraph list instead of section list when target node has paragraphs
- [ ] Modify edge display to show "→ ¶N Marginal note" instead of "→ § Section title"
- [ ] Modify edge links to use `#p-{display_number}` hash
- [ ] Existing section-based edges continue working (dual display: section OR paragraph)
- [ ] New edges can target paragraphs; old edges are NOT auto-migrated

#### Files to modify

| File | Action |
|------|--------|
| `src/app/topic/[slug]/edges/EdgeForm.tsx` | [MODIFY] Paragraph picker (alongside existing section picker) |
| `src/app/topic/[slug]/edges/actions.ts` | [MODIFY] Accept `target_paragraph_id` |
| `src/app/topic/[slug]/edges/page.tsx` | [MODIFY] Display paragraph references |

---

## What NOT to Build in Phase 1

| Feature | Why deferred |
|---------|-------------|
| Paragraph-targeted edges | Phase 1.5. Validate reading + editing first before touching the graph. |
| Edge migration | Phase 1.5. Existing section-based edges keep working. |
| `article_sections` removal | Phase 2. Storage is cheap; deletion is irreversible during a major migration. |
| Paragraph discussions | Not core to the reading/editing experience. Can use node-level discussions until Phase 2. |
| Node snapshots | Only needed for complex rollback scenarios. Paragraph-level revert is sufficient for MVP. |
| Citation button | Can add later — the URL hash (`#p-N`) provides basic citation capability. |
| Paragraph search | Current search is title-only anyway. Adding paragraph full-text search is a separate project. |
| Reordering UI | Drag-and-drop is complex. For MVP, paragraph order is set by creation order. Manual reordering via direct database edit if needed. |
| Bulk editor | "Edit all paragraphs at once" mode is a future convenience, not essential for launch. |

---

## Editorial Guidance: What Is a Siddhant Paragraph?

> [!IMPORTANT]
> This guidance MUST be surfaced directly inside the paragraph editor from day one. Not in a help page. Not in documentation. Inside the editor, visible while writing. If paragraph quality varies wildly, the entire system loses its value.

### A Siddhant paragraph is:

**One legal proposition, one historical point, one doctrinal principle, or one case holding.**

A good test: *can you describe what this paragraph is about in 5 words or fewer?* If yes, it's the right size. That description becomes the marginal note.

### Examples of good paragraphs

| Marginal note | Content scope |
|--------------|---------------|
| "Classification test" | Explains the two-limb test from *Anwar Ali Sarkar*. States both limbs. |
| "Maneka Gandhi — consolidation" | Describes how *Maneka Gandhi* consolidated the arbitrariness doctrine. States the holding and its impact. |
| "Presumption of constitutionality" | Explains the burden of proof when challenging a law under Article 14. Cites *Chiranjit Lal*. |

### A paragraph is NOT:

- **A sentence.** "Article 14 guarantees equality." — too small. This isn't a standalone idea.
- **An entire topic.** A 500-word block covering three different case principles — too large. Split into separate paragraphs, one per principle.
- **A heading.** Headings are absorbed into the `group_label` field, not stored as standalone paragraphs.
- **A list without context.** A bare numbered list needs an introductory sentence to make it a coherent paragraph.

### Size guidance

- **Target**: 80–250 words per paragraph
- **Minimum**: ~40 words (for very specific holdings or definitions)
- **Maximum**: ~400 words (for complex propositions requiring full explanation)
- **Average in the Article 14 example**: ~120 words

---

## Renumbering Walkthrough

> [!IMPORTANT]
> This section is required by the manager before implementation begins. It traces how every reference type survives a renumbering event.

### Scenario: Insert a new paragraph between ¶3 and ¶4

**Before insert:**

| display_number | stable_id | marginal_note |
|---------------|-----------|---------------|
| 1 | p_a1b2c3 | The guarantee stated |
| 2 | p_d4e5f6 | Two expressions, one guarantee |
| 3 | p_g7h8i9 | Constituent Assembly debates |
| 4 | p_j0k1l2 | Influence of American jurisprudence |
| 5 | p_m3n4o5 | Pre-constitutional position |

**After insert:**

| display_number | stable_id | marginal_note |
|---------------|-----------|---------------|
| 1 | p_a1b2c3 | The guarantee stated |
| 2 | p_d4e5f6 | Two expressions, one guarantee |
| 3 | p_g7h8i9 | Constituent Assembly debates |
| **4** | **p_x9y8z7** | **[New paragraph]** |
| 5 | p_j0k1l2 | Influence of American jurisprudence |
| 6 | p_m3n4o5 | Pre-constitutional position |

What was ¶4 (`p_j0k1l2`) is now ¶5. What was ¶5 (`p_m3n4o5`) is now ¶6.

### How each reference survives

**1. URL: A user bookmarked `/topic/article-14#p-4`**

- The URL uses `display_number` in the hash fragment
- After renumbering, `#p-4` now points to the NEW paragraph (the inserted one)
- The OLD paragraph ("Influence of American jurisprudence") is now at `#p-5`
- **Risk**: Bookmark is now wrong
- **Mitigation**: URLs should resolve through `stable_id`. The rendered page sets `id="p-4"` on the element, but the "Copy link" button should produce:
  ```
  /topic/article-14?pid=p_j0k1l2
  ```
  The page resolves `?pid=p_j0k1l2` → finds paragraph with that `stable_id` → scrolls to its current `display_number`. This URL never breaks.
- **Display URL** (for readability): `/topic/article-14#p-4` — ephemeral, convenient
- **Permanent URL** (for citation): `/topic/article-14?pid=p_j0k1l2` — stable, ugly but correct

**2. Edge: An edge targets `p_j0k1l2` (was ¶4, now ¶5)**

- Edge stores `target_paragraph_id` = uuid of `p_j0k1l2` (Phase 1.5)
- The FK does not change when display_number changes
- Edge display reads the paragraph's *current* `display_number` and `marginal_note` at render time
- Before renumber: "→ ¶4 Influence of American jurisprudence"
- After renumber: "→ ¶5 Influence of American jurisprudence"
- **Result**: ✅ Automatically correct. No migration needed.

**3. Discussion: A comment attached to `p_j0k1l2` (was ¶4, now ¶5)**

- Discussion stores `paragraph_id` = uuid of `p_j0k1l2` (Phase 2)
- The FK does not change when display_number changes
- Discussion header reads the paragraph's *current* display_number at render time
- Before renumber: "Discussion on ¶4"
- After renumber: "Discussion on ¶5"
- **Result**: ✅ Automatically correct.

**4. Paragraph revision: A revision recorded against `p_j0k1l2`**

- `paragraph_revisions.paragraph_id` = uuid of `p_j0k1l2`
- Display number changes do not affect revision history
- The revision history page reads the current display_number for the header
- **Result**: ✅ Automatically correct.

**5. Content edit: A contributor clicks "Edit ¶5" (which was ¶4 before)**

- The UI shows "Edit ¶5 — Influence of American jurisprudence"
- The action resolves `display_number=5` → `paragraph_id` → loads the correct content
- The contributor sees the right paragraph content
- **Result**: ✅ Correct.

### Renumbering implementation

```typescript
async function renumberParagraphs(nodeId: string) {
  // Fetch all active paragraphs in order
  const { data: paragraphs } = await supabase
    .from('paragraphs')
    .select('id, order_index')
    .eq('node_id', nodeId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });

  // Update display_number to match position
  for (let i = 0; i < paragraphs.length; i++) {
    await supabase
      .from('paragraphs')
      .update({ display_number: i + 1, updated_at: new Date().toISOString() })
      .eq('id', paragraphs[i].id);
  }
}
```

Called after: insert, delete, reorder. NOT called after content edits (content edits don't change numbering).

### Summary: Two URL strategies

| URL type | Format | Survives renumbering? | Use case |
|----------|--------|-----------------------|-----------|
| Display URL | `#p-4` | ❌ No — number may shift | Casual sharing, in-page navigation |
| Permanent URL | `?pid=p_j0k1l2` | ✅ Yes — stable_id never changes | Citations, edges, bookmarks |

The "Copy link" button in the action bar produces the **permanent URL**. The hash-based display URL is a convenience for reading.

---

## Verification Plan

### Phase 1A (Schema)

- [ ] `paragraphs` table created with correct constraints
- [ ] `paragraph_revisions` table created
- [ ] `article_sections` table is UNTOUCHED
- [ ] `cross_references` table is UNTOUCHED

### Phase 1B (Rendering)

- [ ] Topic page renders paragraphs from database
- [ ] Paragraph numbers visible in left margin
- [ ] Marginal notes visible
- [ ] Group labels create visual separators
- [ ] URL hash `#p-3` scrolls to correct paragraph
- [ ] URL param `?pid=p_xxx` resolves and scrolls to correct paragraph
- [ ] Hover action bar appears with Edit and Copy link buttons
- [ ] Copy link produces permanent URL (`?pid=stable_id`)
- [ ] Fallback: nodes without paragraphs still render via report_content
- [ ] Existing edge display continues working via `article_sections` (unchanged)

### Phase 1C (Editing)

- [ ] "Edit ¶N" opens focused editor
- [ ] Editor shows only the target paragraph content + marginal note
- [ ] Editorial guidance visible inside the editor
- [ ] Save creates a paragraph_revision row
- [ ] Paragraph content updates in the paragraphs table
- [ ] Content-delta gate blocks trivial saves
- [ ] "+ Add paragraph" creates new paragraph with correct numbering
- [ ] Subsequent paragraphs renumber correctly after insert
- [ ] Existing permanent URLs (`?pid=...`) still resolve after renumbering

### Phase 1D (Revisions)

- [ ] Paragraph revision history shows all edits for one paragraph
- [ ] Diff between revisions is clear and focused
- [ ] Revert restores previous paragraph content without affecting other paragraphs

---

## Estimated Timeline

| Phase | Days | Cumulative |
|-------|------|-----------|
| 1A: Schema | 1 | 1 |
| 1B: Rendering | 3 | 4 |
| 1C: Editing | 5 | 9 |
| 1D: Revisions | 2 | 11 |
| Buffer + QA | 1 | **12 days (~2.5 weeks)** |
| *1.5: Paragraph Edges* | *3* | *15 days (after validation)* |

---

## Seed Nodes: First 5 Paragraph-Native Rewrites

These nodes will be **manually authored** in paragraph-native form to validate the architecture. Not migrated. Written from scratch.

| # | Node | Type | Why this node |
|---|------|------|---------------|
| 1 | **Article 14 — Right to Equality** | constitutional_provision | Already drafted in the example document (25 paragraphs). Classification doctrine + arbitrariness doctrine give natural paragraph boundaries. |
| 2 | **Article 21 — Right to Life and Personal Liberty** | constitutional_provision | The broadest fundamental right. Rich jurisprudence (*Maneka Gandhi*, *Puttaswamy*, *Olga Tellis*). Tests whether the paragraph model handles a topic with 30+ distinct doctrinal developments. |
| 3 | **Maneka Gandhi v. Union of India** | judgment | The foundational case for the golden triangle. Facts → Issues → Reasoning → Ratio gives a natural paragraph flow. Tests the judgment template under paragraph discipline. |
| 4 | **Doctrine of Basic Structure** | doctrine | Requires tracing an evolving doctrine across multiple cases (*Kesavananda*, *Minerva Mills*, *I.R. Coelho*). Tests whether the system handles doctrinal evolution as a sequence of paragraphs. |
| 5 | **Kesavananda Bharati v. State of Kerala** | judgment | The longest judgment in Indian constitutional law. Forces decisions about granularity — can a 13-judge bench opinion be meaningfully broken into paragraph units? Stress-tests the model. |

> [!IMPORTANT]
> The success of this architecture will be judged by whether these 5 nodes feel dramatically better to read than equivalent content on any existing legal platform. If they don't, the architecture is correct but the content is wrong — and that's an editorial problem, not a technical one.
