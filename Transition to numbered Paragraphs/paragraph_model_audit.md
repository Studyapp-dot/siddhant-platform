# Architecture Audit: Paragraph-Based Knowledge Model

> **Context**: Evaluating whether Siddhant's fundamental unit of knowledge should shift from **sections** (heading-based subdivisions within a node) to **numbered paragraphs** (Seervai-style `¶9.1, ¶9.2, ¶9.3` blocks with marginal notes).

---

## Current Model (Questions 1–4)

### Q1. What is the smallest editable unit in Siddhant today?

**The entire node.**

The editor ([EditForm.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edit/EditForm.tsx)) presents a single `<textarea>` containing the complete `report_content` for the node. There is no section-level or paragraph-level editing. A contributor must load the entire article, make changes anywhere in the text, and submit the whole document as a new revision.

```
Contributor opens edit → sees one giant textarea → edits anywhere → saves entire document
```

### Q2. What is the smallest addressable unit today?

**The section heading** (via `article_sections` slugs).

When a revision is saved, the [edit actions](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edit/actions.ts#L139-L208) parse all markdown headings and assign each one a stable opaque slug (e.g., `sec_a81f2c`). These slugs are appended to headings as `{#sec_xxxx}` in stored content but stripped before the editor shows them. The [article_sections](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/section_anchoring_patch.sql#L15-L26) table stores:

| Column | Purpose |
|--------|---------|
| `slug` | Opaque immutable identifier |
| `title` | Human-readable heading text |
| `level` | Heading depth (1–6) |
| `order_index` | Positional ordering |
| `deleted_at` | Soft-delete for removed sections |

So sections can be addressed by URL fragment (`/topic/article-14#sec_a81f2c`), but individual paragraphs within a section cannot.

### Q3. What is the smallest linkable unit today?

**The section**, via `target_section_id` on [cross_references](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/section_anchoring_patch.sql#L46-L47). An edge can point to `Node + Section`. Individual paragraphs are not linkable.

### Q4. What is the smallest version-controlled unit today?

**The entire node.** Each [revision](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/siddhant_schema.sql#L50-L60) stores the complete `report_content` for the node. There is no section-level or paragraph-level diff or history. Viewing a historical revision shows the entire document at that point in time.

---

## Section Dependency Audit (Question 5)

### Q5. Which features currently depend on section slugs?

| Feature | Depends on Sections? | How |
|---------|---------------------|-----|
| **Edges / Cross-references** | ✅ Yes | `cross_references.target_section_id` → `article_sections.id`. Edges can optionally point to a specific section. |
| **Edge Form UI** | ✅ Yes | [EdgeForm.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edges/EdgeForm.tsx#L26-L37) fetches sections via `getNodeSections()` and offers a dropdown for section-level targeting. |
| **Edge Display** | ✅ Yes | [edges/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edges/page.tsx#L211-L227) renders `§ Section Title` next to edges, and links with `#sec_xxxx` fragment. |
| **Backlinks (incoming edges)** | ✅ Yes | Same page shows `↳ citing § Title` for incoming edges with section targets. |
| **Section sync on save** | ✅ Yes | [edit/actions.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edit/actions.ts#L396-L429) syncs `article_sections` table: upserts new/changed sections, soft-deletes removed ones. |
| **Slug reattachment** | ✅ Yes | Position-based slug reattachment logic in [edit/actions.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edit/actions.ts#L123-L208). Renamed headings keep their slug; only genuinely new headings get new slugs. |
| **Section templates** | ⚠️ Partially | [SECTION_TEMPLATES](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/page.tsx#L79-L88) suggest heading structures per node type — but they're guidance only, not enforced. |
| **Table of Contents** | ❌ No | There is no rendered TOC component. The sidebar shows navigation breadcrumbs but not section-level TOC. |
| **Citations** | ❌ No | No citation-pointing to sections exists. The "Cite Node" button is non-functional. |
| **Authority Anchors** | ❌ No | Anchored to `paragraph_index` (integer position) not section slugs. |
| **Search** | ❌ No | Search uses `.ilike('title', ...)` — title-level only, no section or paragraph indexing. |
| **URLs** | ⚠️ Minimal | Sections can appear as URL hash fragments (`#sec_xxxx`) but are not used in routing. |

---

## Edge System Audit (Questions 6–9)

### Q6. How are edges currently stored?

```sql
cross_references (
  source_node_id  → nodes.id
  target_node_id  → nodes.id
  target_section_id → article_sections.id  (NULLABLE — optional precision)
  relationship_type (20 types across 4 families)
  description       (scholarly interpretation text)
  signal            (positive/neutral/negative)
  created_by        → profiles.id
)
```

Example:
```
Node: "Maneka Gandhi v. Union of India"
  → relationship: "interprets"
  → target: "Article 21"
  → target_section_id: sec_abc123 ("Scope and Application")
```

### Q7. If sections disappear, what breaks?

| Component | Impact |
|-----------|--------|
| Existing `target_section_id` values | Become orphaned FK references. The FK is `ON DELETE SET NULL`, so they degrade gracefully to node-level edges. |
| Edge display UI | Would show `§ (Archived)` label for deleted sections — this already works because edges page checks `deleted_at`. |
| Edge creation form | Section dropdown would be empty — graceful degradation already implemented. |
| Slug reattachment in edit save | Would have nothing to reattach — new system needed. |

**Verdict**: Sections can disappear without hard breakage. The system was designed with soft-delete precisely for this case.

### Q8. Could edges point to paragraph IDs instead?

**Yes.** The current `target_section_id` column (nullable UUID FK to `article_sections`) could be replaced or supplemented with a `target_paragraph_id` pointing to a new `article_paragraphs` table. The schema change would be:

```sql
-- Option A: Replace
ALTER TABLE cross_references
  ADD COLUMN target_paragraph_id uuid REFERENCES article_paragraphs(id) ON DELETE SET NULL;

-- Option B: Coexist (sections + paragraphs)
-- Keep target_section_id, add target_paragraph_id
```

Edge links would change from:
```
Article14#sec_abc123
```
to:
```
Article14#14.23
```

### Q9. Migration difficulty per edge-related component

| Component | Difficulty | Rationale |
|-----------|-----------|-----------|
| `cross_references` table schema | 🟢 Low | Add column, FK. Existing `target_section_id` values can be mapped or set to NULL. |
| Edge creation form (EdgeForm.tsx) | 🟢 Low | Swap section dropdown for paragraph dropdown. Same UX pattern. |
| Edge display (edges/page.tsx) | 🟢 Low | Change `§ Section Title` to `¶ 9.23 Marginal Note`. |
| Edge display (CrossReferences.tsx) | 🟢 Low | Same as above. |
| Edge actions (addEdge, removeEdge) | 🟢 Low | Swap `target_section_id` for `target_paragraph_id`. |
| Existing edge data migration | 🟡 Medium | Existing edges with `target_section_id` need mapping. If sections are 1:1 with paragraph ranges, it's mechanical. If not, requires human review. |

---

## Editor Audit (Questions 10–12)

### Q10. Can the editor support independently editable numbered paragraphs?

**Not today.** The editor is a single `<textarea>` ([EditForm.tsx L320-328](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edit/EditForm.tsx#L320-L328)). To support paragraph-level editing, you would need one of:

1. **Multiple textareas** — one per paragraph block, each independently saveable
2. **Block editor** (Notion-like) — each paragraph is a block with its own identity
3. **Section-level locking** — lock/unlock individual paragraphs for editing

> [!IMPORTANT]
> This is the single largest engineering change in the entire migration. The editor is the bottleneck.

However, the current architecture could support a **hybrid approach**: keep the monolithic editor for full-article editing, but add a "Quick Edit ¶9.23" button that opens a focused editor for just that paragraph. This is closer to Wikipedia's "edit section" pattern.

### Q11. Can paragraphs be reordered without breaking references?

**Yes, if paragraph IDs are opaque and position-independent.** The current section system already does this — slugs like `sec_a81f2c` are opaque identifiers that survive reordering. The same pattern would work for paragraph IDs. A paragraph's number (`9.23`) would be its **display label**, while its stable identity would be an opaque UUID or short ID.

### Q12. Can paragraph numbers remain stable when inserting new content?

This is the classic **numbering stability problem**. Three approaches:

| Approach | Example | Stability | User Experience |
|----------|---------|-----------|-----------------|
| **Decimal subdivision** | Insert between 9.2 and 9.3 → `9.21` | ✅ High | Gets ugly fast: `9.213` |
| **Letter suffix** | Insert between 9.2 and 9.3 → `9.2A` | ✅ High | Seervai uses this — familiar to legal scholars |
| **Auto-renumber on save** | Insert between 9.2 and 9.3 → all numbers shift | ❌ Low | Breaks all external citations |

> [!WARNING]
> **Seervai's system uses static numbering** — paragraphs like `9.221, 9.222, 9.223` are **permanent** across all editions. Any system Siddhant adopts must respect this. If someone cites `¶9.23`, that reference must remain valid forever.

**Recommendation**: Use opaque IDs internally (like current section slugs) but display **stable sequential numbers** that are only auto-assigned on initial creation and manually managed thereafter. New insertions get letter/decimal suffixes.

---

## Citation Audit (Questions 13–14)

### Q13. What does a citation currently point to?

**The node itself.** The "Cite Node" button on the [topic page](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/page.tsx#L683) exists but is non-functional (just a `<button>` with no handler). There is no citation format or copy mechanism.

### Q14. Could citations point directly to numbered paragraphs?

**Yes — and this would be a major advantage.** A citation format like:

```
Siddhant, Article 14, ¶9.23 (rev. 2025-06-01)
```

would be more precise than:

```
Siddhant, Article 14, § Classification Test
```

This maps directly to how legal academics cite Seervai:

> See Seervai, *Constitutional Law of India*, ¶9.222 (4th ed.)

The numbered paragraph model inherently creates more citable, stable reference points.

---

## Search Audit (Questions 15–16)

### Q15. Does search index nodes, sections, or blocks?

**Nodes only.** All search queries use `.ilike('title', ...)` — matching against the node title. Examples:

- [Dashboard search](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/dashboard/page.tsx#L75): `ilike('title', '%query%')`
- [Authority search](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/authority-anchors.ts#L185): `ilike('title', '%query%')`

There is no full-text search of content, no section-level search, and no paragraph-level search.

### Q16. Could search return paragraph-level results?

**Yes.** With a `paragraphs` table containing `content` and `marginal_note`, search could return:

```
Node: Right to Equality
Paragraph: ¶9.23 — Classification Test
"...the State must show that the classification is..."
```

This would require either:
- PostgreSQL full-text search (`tsvector`) on paragraph content
- Or a lightweight index on `marginal_note` text

> [!TIP]
> Paragraph-level search is a significant UX improvement regardless of the numbering system. Even if you keep sections, adding searchable paragraph blocks would be valuable.

---

## Contribution Audit (Questions 17–19)

### Q17. How many clicks does it take to improve...

| Target | Clicks Today | Flow |
|--------|-------------|------|
| An entire node | **2** | Click "Improve" → edit in textarea → save |
| A section | **2** (same) | Click "Improve" → scroll to section in textarea → edit → save |
| A single paragraph | **2** (same) | Click "Improve" → scroll to paragraph in textarea → edit → save |

The problem isn't click count — it's **cognitive load**. Opening a 3000-character article to fix one paragraph is psychologically heavier than opening a focused editor for `¶9.23`. The friction is emotional, not mechanical.

### Q18. Could a contributor edit only paragraph 9.23?

**Not today.** Possible implementation paths:

1. **Quick Edit Button per paragraph**: Render a small ✏️ icon next to each `¶` block. Clicking it opens a focused mini-editor for just that paragraph.
2. **Section-level edit**: Wikipedia-style "edit" links per section (groups of paragraphs).

Both require paragraph/section-level content storage or smart slicing of the monolithic `report_content`.

### Q19. Would paragraph-level editing reduce moderation complexity?

**Significantly.** Today, a revision diff shows changes across the entire document. Reviewers must read the full diff to find the actual change. With paragraph-level edits:

- Each revision touches exactly one `¶` block
- Diff is immediately visible and focused
- Moderation can be faster and more confident
- The [ContributionReviewDrawer](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/ContributionReviewDrawer.tsx) could show "¶9.23 was modified" instead of a full-document diff

---

## Navigation Audit (Question 20)

### Q20. Which model better fits Siddhant's existing architecture?

**Model A** (Named Sections):
```
Node
 ├─ Introduction
 ├─ History
 ├─ Cases
```

**Model B** (Numbered Paragraphs):
```
Node
 ├─ 9.1 Preliminary
 ├─ 9.2 Elements
 ├─ 9.3 Classification Test
 ├─ 9.4 Key Cases
```

**Model A fits the current code better**, because the system already has:
- `article_sections` table with `title` and `slug`
- Section templates per node type (SECTION_TEMPLATES)
- Position-based slug reattachment on save
- Edge targeting by section

**But Model B fits the platform's *mission* better** — low-friction contribution to a living legal knowledge base. The section model was designed for organizational hierarchy; the paragraph model is designed for atomic contribution.

> [!NOTE]
> The optimal answer may be a **hybrid**: keep sections as navigational groupings, but make paragraphs the primary editable/citable/linkable unit *within* each section.

---

## Migration Audit (Questions 21–22)

### Q21. If Siddhant adopts numbered paragraphs...

#### What must change

| Component | Change Required | Effort |
|-----------|----------------|--------|
| **Database: new `article_paragraphs` table** | Create table with `node_id`, `paragraph_number`, `marginal_note`, `content`, `order_index`, `stable_id` | 🟡 Medium |
| **Editor: paragraph-level editing** | Either split textarea into blocks, or add "edit this ¶" feature | 🔴 High |
| **Content rendering (ReportContent.tsx)** | Render paragraph numbers + marginal notes in margins | 🟡 Medium |
| **Edge form** | Replace section dropdown with paragraph dropdown | 🟢 Low |
| **Content migration** | Parse existing markdown into paragraph blocks, assign numbers | 🟡 Medium |
| **Revision storage** | Either store per-paragraph or continue storing whole document with paragraph markers | 🟡 Medium |

#### What can remain unchanged

| Component | Reason |
|-----------|--------|
| Nodes table | Paragraphs live inside nodes, not replacing them |
| Cross-references structure | Just add `target_paragraph_id` |
| Authority anchors | Already paragraph-indexed (`paragraph_index`) |
| Quality system | Operates at node level — unaffected |
| Reputation system | Operates at user/revision level — unaffected |
| Authentication / profiles | Completely orthogonal |
| Discussion system | Currently node-level — can stay that way initially |
| Knowledge graph (node types, metadata) | Operates at node level |

#### Estimated Engineering Effort

| Phase | Effort | Duration (solo dev) |
|-------|--------|---------------------|
| Phase 1: Database schema + rendering | Medium | 1–2 weeks |
| Phase 2: Paragraph-level editing | High | 2–3 weeks |
| Phase 3: Edge migration + citation | Medium | 1 week |
| Phase 4: Content migration script | Medium | 1 week |
| Phase 5: Search indexing | Low | 3–5 days |
| **Total** | | **5–8 weeks** |

### Q22. Should Siddhant keep sections, replace sections, or use sections + numbered paragraphs?

**Recommendation: Sections + Numbered Paragraphs (Hybrid)**

Here's why:

| Option | Pros | Cons |
|--------|------|------|
| **Keep sections only** | No migration. Existing code works. | Doesn't achieve the Seervai-style calm. Sections are too big for atomic contribution. |
| **Replace sections with paragraphs** | Clean model. One unit type. | Destroys existing section infrastructure. Loses navigational grouping. No hierarchy. |
| **Sections + Numbered Paragraphs** | Best of both worlds. Sections provide navigation/grouping. Paragraphs provide atomic editability and citability. | More complex model. Two levels of sub-node structure. |

The hybrid model would look like:

```
Node: Right to Equality (Article 14)

  § 1. Preliminary                    ← Section (navigation group)
    ¶ 9.1  Meaning of equality        ← Paragraph (atomic unit)
    ¶ 9.2  Historical origins
    ¶ 9.3  Influence of U.S. law

  § 2. Classification Test
    ¶ 9.4  Rational nexus
    ¶ 9.5  Intelligible differentia
    ¶ 9.6  Object of legislation

  § 3. Judicial Interpretation
    ¶ 9.7  Early approach
    ¶ 9.8  Modern expansion
    ¶ 9.9  Current position
```

- **Sections** remain as `article_sections` — used for TOC, navigation, edge targeting (existing behavior preserved)
- **Paragraphs** become the new `article_paragraphs` — the smallest editable, citable, linkable unit
- Each paragraph has a **display number** (`9.1`) and a **marginal note** (`Meaning of equality`)
- Edges can target either section OR paragraph
- Contributors can edit a single paragraph

---

## The Manager's Core Question

> Are sections actually solving a user problem, or are they only solving a database/organization problem?

**Sections are solving an organization problem.** They exist because the edit system needed heading-based structure to create stable cross-reference anchors. But from the user's perspective:

- Readers don't navigate by section slug — there's no TOC
- Contributors can't edit a section independently — it's all one textarea
- Citations can't point to a section — the Cite button doesn't work

The paragraph is a more natural atomic unit for Siddhant because:
1. A contributor can improve `¶9.3` without touching the rest
2. A reader can cite `¶9.3` precisely
3. An edge can point to `¶9.3` for semantic precision
4. A moderator can review "change to ¶9.3" quickly

**The true atomic unit for Siddhant should be the numbered paragraph.** Sections should remain as optional navigational groupings above paragraphs.
