# Paragraph Prototype Audit

> **Scope**: Can we test the Seervai experience cheaply — UI only, no database changes?

---

## Q1. Without changing the database, can we render numbered paragraphs and marginal notes?

**Yes.**

The infrastructure already exists. [renderMarkdownParagraphs()](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/utils/markdownRenderer.ts#L186-L203) splits content by `\n\n` and renders each paragraph independently. [ReportContent.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/ReportContent.tsx#L401-L415) already iterates over these blocks and wraps each in a `<div className="report-paragraph-block">`.

What needs to change:

**Step 1 — Number each block.** In [ReportContent.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/ReportContent.tsx#L403-L414), the map already has an index. Add a paragraph number to each block:

```jsx
{processedParagraphs.map((para, i) => {
  const paraNumber = i + 1;  // Simple sequential for prototype
  return (
    <div key={i} className="report-paragraph-block" id={`p-${paraNumber}`}>
      <span className="para-number">¶{paraNumber}</span>
      <div dangerouslySetInnerHTML={{ __html: para.html }} />
    </div>
  );
})}
```

**Step 2 — Extract marginal notes.** A marginal note can be derived from the content itself — no database column needed:

- If the paragraph starts with a **heading** (`<h2>`, `<h3>`), the heading text becomes the marginal note
- If the paragraph starts with **bold text** (`<strong>`), that becomes the marginal note
- Otherwise: first ~5 words become the marginal note

This is a pure rendering heuristic. Extract it from the HTML with a regex or DOM parse.

**Step 3 — CSS layout.** Add margin-left space for the paragraph number and a subtle left-border. The existing [page.css](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/page.css#L2589-L2655) already styles `.report-body` and `.report-paragraph-block`. Add:

```css
.report-paragraph-block {
  position: relative;
  padding-left: 48px;  /* room for ¶ number */
  margin-bottom: 1.5rem;
  border-left: 1px solid transparent;
  transition: border-color 0.2s;
}

.report-paragraph-block:hover {
  border-left-color: var(--color-gold-soft);
}

.para-number {
  position: absolute;
  left: 0;
  top: 2px;
  font-family: var(--font-sans);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
  opacity: 0.5;
  user-select: none;
}

.report-paragraph-block:hover .para-number {
  opacity: 1;
  color: var(--color-gold);
}

.para-marginal {
  position: absolute;
  left: 0;
  top: 16px;
  font-family: var(--font-sans);
  font-size: 0.58rem;
  font-weight: 600;
  color: var(--text-muted);
  opacity: 0.4;
  max-width: 44px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

> [!NOTE]
> **Numbers in this prototype are ephemeral.** They are recalculated on every render. They are NOT stable identifiers. If someone adds a paragraph between ¶2 and ¶3, all subsequent numbers shift. This is fine for a prototype — the question is whether the *feeling* is right, not whether the *citations* are stable.

---

## Q2. How many days would that take?

| Task | Effort |
|------|--------|
| Paragraph numbering in ReportContent.tsx | 2–3 hours |
| Marginal note extraction heuristic | 3–4 hours |
| CSS for Seervai-style layout | 3–4 hours |
| Testing on a few nodes, edge cases (empty paragraphs, headings-only, lists) | 3–4 hours |
| **Total** | **~2 days** |

This is pure frontend work. No migrations. No API changes. No edge system changes. Fully reversible by removing one CSS class and a few JSX lines.

---

## Q3. Can contributors click "Edit ¶3" while still storing content in the existing textarea?

**Yes.** Two approaches:

### Approach A — Hash-link to editor (1 day)

Each `¶` gets a small ✏️ icon on hover. Clicking it navigates to:

```
/topic/{slug}/edit#p-3
```

The edit page opens the normal textarea and auto-scrolls to paragraph 3. The contributor sees the full document but their cursor is positioned at the right paragraph.

This is trivial: add an `id` to each paragraph in the rendered view, pass a hash to the edit page, and use `scrollIntoView()` on mount.

**Limitation**: The contributor still sees the entire document. The psychological benefit of "I'm only editing ¶3" is partially lost.

### Approach B — Focused paragraph editor (3–4 days)

A modal or inline mini-editor that:

1. Extracts paragraph `i` from `report_content` (split by `\n\n`)
2. Shows only that paragraph in a focused textarea
3. On save: splices the edited paragraph back into the full content at position `i`
4. Submits the full `report_content` to the existing `submitRevision()` action

```
User clicks "Edit ¶3"
 → Modal opens with ONLY paragraph 3's text
 → User edits
 → Click "Save"
 → Behind the scenes: full document rebuilt with new ¶3, submitted as normal revision
```

The database sees a normal full-document revision. Nothing changes in the data model. But the contributor's experience is: **"I edited one paragraph."**

> [!IMPORTANT]
> Approach B is the one that creates the Seervai psychological effect. Approach A is just a convenience link. I'd recommend B for the prototype.

---

## Q4. Can edges display paragraph references without creating a paragraph table?

**Partially.**

Edges currently use `target_section_id` → `article_sections.id`. Without a paragraph table, we can't store paragraph-level edge targets.

But for the **prototype**, we can:

1. **Display paragraph numbers on the target side.** When an edge links to a node, and the user navigates there, the paragraphs are numbered. So `"See Article 14, ¶7"` becomes a meaningful reference even if the edge technically points to the whole node.

2. **Use section → paragraph range mapping.** If an edge points to a section (e.g., `§ Classification Test`), and that section contains ¶4–¶6, the edge display could say:

   ```
   → Article 14, § Classification Test (¶4–¶6)
   ```

   This is derived at render time from the already-existing section structure + paragraph counting. No schema change.

3. **Display-only paragraph references in edge descriptions.** Contributors already write free-text `description` on edges. They could naturally write `"See ¶7 for the rational nexus test"` — the platform would just render the ¶ character nicely.

**What you can NOT do without a paragraph table**: store a formal FK from an edge to a specific paragraph. But the manager's question is about testing the experience, not building the final architecture — and for that, display-level references are sufficient.

---

## Q5. Can we test the Seervai experience on 5 nodes first?

**Yes.** Three options:

### Option 1 — Feature flag by node slug (simplest)

```tsx
const SEERVAI_PROTOTYPE_SLUGS = [
  'article-14',
  'article-21',
  'bns-section-103',
  'doctrine-of-basic-structure',
  'maneka-gandhi-v-union-of-india',
];

const useSeervaiLayout = SEERVAI_PROTOTYPE_SLUGS.includes(slug);
```

Pass `useSeervaiLayout` to `ReportContent`. If true, render with paragraph numbers and marginal notes. If false, render exactly as today.

### Option 2 — Node metadata flag

Add `"seervai_prototype": true` to the node's `metadata` JSON field. No schema change needed — `metadata` is already a free-form `jsonb` column. Set it manually in Supabase for 5 nodes.

### Option 3 — URL query parameter

```
/topic/article-14?view=seervai
```

Anyone can toggle the experience on any node. Good for internal testing.

**Recommendation**: Use Option 3 for initial development and visual testing, then switch to Option 2 for a curated 5-node test.

---

## Summary

| Question | Answer | Effort |
|----------|--------|--------|
| Can we render ¶ numbers + marginal notes? | ✅ Yes — pure UI in ReportContent.tsx | ~1 day |
| How long? | **2 days total** for the full reading experience | 2 days |
| Can contributors click "Edit ¶3"? | ✅ Yes — focused modal editor, saves as full document | +3–4 days |
| Can edges show ¶ references? | ⚠️ Display-only — no FK, but visually meaningful | +0.5 day |
| Can we test on 5 nodes? | ✅ Yes — URL param or metadata flag | +0.5 day |
| **Total prototype** | | **~3 days** (reading) or **~6 days** (reading + editing) |

---

## What the prototype will tell you

After 3 days of work, you will have 5 nodes that look like:

```
¶1   Preliminary

     Liberty and equality are words of passion and power. They
     were the watchwords of the French Revolution; they inspired
     the unforgettable words of Abraham Lincoln's Gettysburg Address...

¶2   Historical Background

     Under the heading "Right to Equality" are grouped Articles 14
     to 18. Article 14 raised many problems but the principles for
     solving them were well settled by 1960...

¶3   Classification Test

     The concept of equality does not mean that all persons are equal.
     It requires that persons similarly situated should be treated alike...
```

You will then be able to answer the manager's three questions:

1. **Does it feel calmer?** — Read it. Compare to the current wall-of-text.
2. **Does it feel easier to navigate?** — Can you jump to ¶7 instantly?
3. **Does it feel easier to contribute?** — Does the "Edit ¶3" button make you think "I can improve this one thing"?

If all three answers are yes, the paragraph model is validated. Then — and only then — you design the stable paragraph table, the numbering scheme, and the migration.

If the answers are mixed, you saved yourself 8 weeks.
