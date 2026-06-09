# Siddhant Platform: Handoff & Chat Transition Document

This document provides a detailed log of the structural shifts, feature implementations, and codebase modifications completed in this session. It acts as a comprehensive reference guide to seamlessly resume development in a new chat.

---

## 1. Context & Architecture Strategy

The primary goal of this session was to transition the **Siddhant** legal-knowledge platform from a monolithic node-level markdown structure (stored in `nodes.report_content`) to a **Paragraph-Native Architecture**. 

Under this model, the **numbered paragraph** is the fundamental, atomic unit of legal knowledge. It is:
* **Independently editable**: Contributor edits target individual paragraphs rather than the whole node, avoiding merge conflicts.
* **Independently citable**: Links point directly to stable paragraph elements.
* **Independently versioned**: Edits generate lightweight paragraph-specific revisions.

### Approved Design Decisions
* **Flat Structure (Option A)**: A Node directly owns a flat sequence of Paragraphs. The database does not enforce structural section tables.
* **Visual Grouping**: Visual section headings are modeled using a non-structural `group_label` text field on the paragraph itself.
* **Dual URL Routing**:
  * **Display URL** (casual sharing): `/topic/[slug]#p-[display_number]` (subject to change if paragraphs are inserted/deleted).
  * **Permanent Permalink** (citations, bookmarks, edges): `/topic/[slug]?pid=[stable_id]` (static, opaque identifier).
* **Quality Guidance**: Quality warning heuristics (word count limits, missing marginal notes, heading checks, multi-proposition warnings) are built directly into the focused paragraph editor.

---

## 2. Implemented Features & Core Milestones

### Phase 1: Core MVP (Paragraph-Native Reading, Editing & Revisions)
1. **Paragraph Database Schema**: Established the `paragraphs` and `paragraph_revisions` tables with custom Row-Level Security (RLS) policies and a stable ID generator.
2. **Unified Rendering fallback**: Updated the topic detail route ([page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/[slug]/page.tsx)) to fetch paragraphs from the database and render them via [ParagraphList.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/ParagraphList.tsx). If no paragraphs are present, it falls back to rendering the legacy `report_content` blob.
3. **Focused Paragraph Editor**: Developed the [ParagraphEditor.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/ParagraphEditor.tsx) client-side modal. Hovering over paragraphs shows an action bar enabling editors to modify the content or add marginal notes.
4. **Insertion Points**: Addressed the creation of paragraphs by inserting "+ Add paragraph" controls between active elements.
5. **Renumbering Algorithm**: Implemented a two-pass renumbering routine ([paragraphs.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/paragraphs.ts#L75-L107)) which updates `display_number` sequentially on insert/delete to maintain clean numerical runs while avoiding unique-constraint conflicts.
6. **Paragraph Revision History**: Developed the [ParagraphHistory.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/ParagraphHistory.tsx) drawer showing paragraph diff histories and providing single-click reverts to previous revisions.
7. **Clean-up of Prototype Code**: Conducted a thorough code audit to remove around 95 lines of legacy, dead prototype code, retiring the old `seervai-prototype.css` styles completely.

### Owner-Only Node Deletion & Query Audits
1. **Node Deletion Component**: Implemented [NodeDeleteZone.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/NodeDeleteZone.tsx) at the bottom of the topic page. It displays strictly for the node's creator (`node.created_by === user.id`) and forces the creator to type out the exact title of the node before enabling the delete action.
2. **Deletion Server Action**: Programmed `softDeleteNode` in [node-delete.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/node-delete.ts), which marks the node with a `deleted_at` timestamp and cascades the soft-delete timestamp to all child paragraphs.
3. **RLS Database Policy Fixes**: Fixed silent Supabase database RLS policy update blocks. Added UPDATE permissions for authors on the `nodes` and `paragraphs` tables.
4. **Node Ownership Backfill**: Generated migration scripts to assign node ownership (`created_by`) for newly created nodes and backfilled existing nodes dynamically by examining their oldest historical revision author.
5. **Cross-Cutting Deletion Audit**: Reviewed all occurrences of `.from('nodes')` in the codebase, appending `.is('deleted_at', null)` to ensure soft-deleted nodes are hidden globally (explore page, dashboard search, compares, revisions list, cross-references list, and link modals).

---

## 3. Database Schema & Migration SQL Files

All migration files are saved in the [migrations](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/migrations) folder of the project root.

### A. Paragraph Schema (`paragraph_schema.sql` at root)
Defines the `paragraphs` and `paragraph_revisions` tables, RLS settings, and helper routines.
```sql
CREATE TABLE IF NOT EXISTS public.paragraphs (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id        uuid REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  stable_id      text NOT NULL,
  display_number integer NOT NULL,
  marginal_note  text,
  content        text NOT NULL DEFAULT '',
  group_label    text,
  order_index    integer NOT NULL,
  created_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz DEFAULT NOW(),
  updated_at     timestamptz DEFAULT NOW(),
  deleted_at     timestamptz,

  UNIQUE(node_id, stable_id),
  UNIQUE(node_id, display_number) WHERE (deleted_at IS NULL)
);

CREATE INDEX idx_paragraphs_node_order
  ON public.paragraphs(node_id, order_index)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_paragraphs_node_stable
  ON public.paragraphs(node_id, stable_id);

ALTER TABLE public.paragraphs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paragraphs viewable by everyone."
  ON public.paragraphs FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert paragraphs."
  ON public.paragraphs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update paragraphs."
  ON public.paragraphs FOR UPDATE USING (auth.role() = 'authenticated');

-- Revisions Table
CREATE TABLE IF NOT EXISTS public.paragraph_revisions (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paragraph_id    uuid REFERENCES public.paragraphs(id) ON DELETE CASCADE NOT NULL,
  node_id         uuid REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  author_id       uuid REFERENCES public.profiles(id) NOT NULL,
  content         text NOT NULL,
  marginal_note   text,
  commit_message  text NOT NULL,
  revision_type   text DEFAULT 'content_edit'
    CHECK (revision_type IN ('creation', 'content_edit', 'marginal_note_edit', 'migration', 'deletion', 'revert')),
  content_size    integer,
  node_revision_id uuid,
  created_at      timestamptz DEFAULT NOW()
);

CREATE INDEX idx_para_revisions_paragraph
  ON public.paragraph_revisions(paragraph_id, created_at DESC);

CREATE INDEX idx_para_revisions_node
  ON public.paragraph_revisions(node_id, created_at DESC);

ALTER TABLE public.paragraph_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Paragraph revisions viewable by everyone."
  ON public.paragraph_revisions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert paragraph revisions."
  ON public.paragraph_revisions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

### B. Node Deletion Support ([node_soft_delete.sql](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/migrations/node_soft_delete.sql))
Alters the `nodes` table schema.
```sql
ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at
  ON public.nodes (deleted_at)
  WHERE deleted_at IS NULL;
```

### C. Ownership Backfilling ([backfill_created_by.sql](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/migrations/backfill_created_by.sql))
Updates authorship for existing pre-migration nodes.
```sql
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
```

### D. Update RLS Correction ([rls_update_policies.sql](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/migrations/rls_update_policies.sql))
Permits owners to issue updates and mark soft deletions.
```sql
CREATE POLICY "Creators can update their own nodes" 
ON public.nodes 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Creators can update their own paragraphs" 
ON public.paragraphs 
FOR UPDATE 
USING (auth.uid() = created_by);
```

---

## 4. Key Files Directory Guide

### Server Actions
* [paragraphs.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/paragraphs.ts): Contains functions for managing paragraph data (`getParagraphs`, `resolveStableId`, `saveParagraph`, `insertParagraph`, `deleteParagraph`, `renumberParagraphs`).
* [paragraph-revisions.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/paragraph-revisions.ts): History tracking actions (`getParagraphRevisions`, `revertParagraph`).
* [node-delete.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/node-delete.ts): Action logic for owner soft-deletion verification and cascaded child soft deletes.

### UI Components
* [ParagraphView.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/ParagraphView.tsx): Renders a single paragraph body, displaying display numbers, marginal notes, hover action menus, and paragraph delete popups.
* [ParagraphList.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/ParagraphList.tsx): Combines multiple paragraphs together, inserting "+ Add paragraph" controls between elements.
* [ParagraphEditor.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/ParagraphEditor.tsx): Modal interface with content styling options and editorial warnings (e.g., word count checks, bold proposition counts).
* [ParagraphHistory.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/ParagraphHistory.tsx): History sidebar displaying revision chains and diff compare views.
* [NodeDeleteZone.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/NodeDeleteZone.tsx): Creator-only threat/danger container rendering validation fields at the footer.

### Styling & CSS Sheets
* [paragraph-view.css](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/paragraph-view.css): Visual style layouts for paragraph margin labels, marginal notes, and hover controls.
* [paragraph-editor.css](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/paragraph-editor.css): Styles for editor modals, validation alerts, quality guides, and comparison panels.
* [node-delete-zone.css](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/node-delete-zone.css): Layout colors for the danger zone delete box.

### Audited Core Routes
These files were modified to append `.is('deleted_at', null)` filters:
* [page.tsx (root router)](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/page.tsx)
* [nodes/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/nodes/page.tsx)
* [dashboard/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/dashboard/page.tsx)
* [explore/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/explore/page.tsx)
* [api/nodes-list/route.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/api/nodes-list/route.ts)
* [topic/[slug]/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/[slug]/page.tsx)
* [topic/[slug]/compare/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/[slug]/compare/page.tsx)
* [topic/[slug]/discussion/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/[slug]/discussion/page.tsx)
* [topic/[slug]/edges/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/[slug]/edges/page.tsx)
* [topic/[slug]/history/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/[slug]/history/page.tsx)
* [topic/new/actions.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/new/actions.ts): Patched to ensure `created_by` stores `user.id` during creation.

---

## 5. Current Verification State & Build Status

* **Git Status**: Working directory is completely clean. All modifications are committed and pushed onto `origin/main`.
* **Last Git Commit**: `27ff8c3` - *feat: complete authoring experience enhancements and soft-delete workflows*.
* **Build Integrity**: Tested compile integrity using Next.js build. Compilation completed with zero syntax/TypeScript errors.

---

## 6. Next Steps & Implementation Roadmap

The next AI agent or developer should address the remaining items in the implementation plan:

### Phase 1.5: Paragraph-level Edges (Cross-References)
Currently, edges/cross-references target entire nodes or legacy sections. To make edges fully paragraph-native:
1. **Schema Update**: Execute the SQL statement:
   ```sql
   ALTER TABLE public.cross_references
     ADD COLUMN IF NOT EXISTS target_paragraph_id uuid
     REFERENCES public.paragraphs(id) ON DELETE SET NULL;
   ```
2. **Edge Creation Form**: Update `EdgeForm` to fetch the target node's paragraphs and display a paragraph picker (instead of or alongside the legacy section picker).
3. **Edge Display**: Update edges lists to show paragraph displays (e.g., "→ ¶4 Intelligible Differentia") and link permalinks using `?pid=[stable_id]`.

### Phase 2: Complete Integration
1. **Paragraph-targeted Discussions**: Link the `discussions` table to `paragraphs.id` to support granular inline commenting.
2. **Node Snapshots**: Create the `node_snapshots` database schema and snapshot trigger on structural updates to enable full point-in-time rollbacks.
3. **Paragraph Full-Text Search**: Update search algorithms to index paragraph text and return deep matches alongside node titles.
4. **Reordering UI**: Develop a drag-and-drop or rank-swapping interface to adjust paragraph `order_index` orderings.
5. **article_sections Clean-up**: Retract the legacy section schema and table once the system stabilizes.
