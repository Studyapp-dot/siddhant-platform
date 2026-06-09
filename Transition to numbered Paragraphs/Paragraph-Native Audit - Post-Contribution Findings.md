# Paragraph-Native Audit - Post-Contribution Findings

Status: audit and recommendation document only. No redesign or implementation is proposed as final in this document.

Date: 2026-06-09

## Executive Summary

The paragraph-native architecture is directionally validated, but the platform integration is incomplete.

The main problem is not the paragraph table or the paragraph editor itself. The problem is that Siddhant now has two contribution primitives:

- Legacy primitive: node revision in `revisions`
- New primitive: paragraph revision in `paragraph_revisions`

The new primitive renders and edits, but many older systems still only observe the legacy primitive. That creates concrete regressions in authority anchoring, link/citation persistence, draft safety, historical reconstruction, quality, recognition, reputation, and AI extraction.

Recommended priority:

1. Fix immediate authoring regressions before further contribution.
2. Audit the reading experience against Seervai after the bugs are stabilized.
3. Redesign paragraph-aware governance systems only after the audit is accepted.

## Evidence Base

This audit reviewed the current implementation in:

- `src/app/components/ParagraphEditor.tsx`
- `src/app/components/ParagraphView.tsx`
- `src/app/components/ParagraphList.tsx`
- `src/app/actions/paragraphs.ts`
- `src/app/actions/paragraph-revisions.ts`
- `src/app/components/AuthorityAnchorEditor.tsx`
- `src/app/components/DraftAuthorityEditor.tsx`
- `src/app/actions/authority-anchors.ts`
- `src/app/components/ReportContent.tsx`
- `src/app/topic/new/page.tsx`
- `src/app/topic/new/actions.ts`
- `src/app/topic/[slug]/page.tsx`
- `src/app/topic/[slug]/edit/EditForm.tsx`
- `src/app/topic/[slug]/edit/actions.ts`
- `src/app/topic/[slug]/history/page.tsx`
- `src/app/topic/[slug]/compare/page.tsx`
- `src/app/actions/quality.ts`
- `src/app/actions/quality-voting.ts`
- `src/app/actions/peer-review.ts`
- `src/app/actions/recognition-feed.ts`
- `src/app/actions/reputation.ts`
- `src/app/actions/edit-acceptance.ts`
- `src/utils/ai/extract-metadata.ts`
- `src/utils/ai/extract-revision-semantics.ts`
- `src/utils/revision-presentation.ts`

## Category A - Immediate Bugs

### A1. Authority Anchors Are Missing From Paragraph-Native Authoring

Severity: P0

Status: confirmed from code.

The legacy full-node editor supports authority anchoring:

- `EditForm.tsx` imports and renders `AuthorityAnchorEditor`.
- `DraftAuthorityEditor.tsx` exists for draft-mode authority attachment.
- `topic/new/page.tsx` only renders `DraftAuthorityEditor` inside the legacy full-article branch.
- `topic/new/actions.ts` only persists `pending_authority_anchors` in the legacy branch.
- `authority-anchors.ts` writes anchors to `authority_anchors` with `node_id`, `revision_id`, and `paragraph_index`.

The paragraph-native editor does not include authority anchoring:

- `ParagraphEditor.tsx` imports `EditorToolbar` and `LinkInsertModal`, but not `AuthorityAnchorEditor` or `DraftAuthorityEditor`.
- `ParagraphEditor.tsx` saves by calling `insertParagraph()` or `saveParagraph()`.
- `paragraphs.ts` writes only to `paragraphs` and `paragraph_revisions`.
- No paragraph save path writes `authority_anchors`.

The paragraph-native reading path also bypasses inline authority marker injection:

- `topic/[slug]/page.tsx` fetches `authorityAnchors`.
- If `hasParagraphs` is true, it renders `ParagraphList`.
- If `hasParagraphs` is false, it renders `ReportContent content={reportContent} authorities={authorityAnchors}`.
- `ReportContent` is where authority markers are injected into rendered content.
- `ParagraphView` renders `renderMarkdown(content)` directly and receives no authority data.

Impact:

- A contributor cannot attach cases, statutes, doctrines, or external sources while creating or editing a paragraph.
- Paragraph-native content cannot show inline authority markers even if node-level anchors exist.
- The right-side `AuthorityDrawer` can still show node-level anchors, but the paragraph text itself is not grounded at the claim level.
- This is a regression from the legacy editor and should block further contribution.

Recommendation:

- Add paragraph-aware authority anchoring before continuing feature work.
- Extend `authority_anchors` with nullable `paragraph_id` and, if needed, `paragraph_revision_id`.
- Keep `node_id` for aggregation and legacy compatibility.
- Replace `paragraph_index` as the primary paragraph locator for paragraph-native content.
- Create a paragraph authority editor that works inside `ParagraphEditor`.
- On paragraph save, create the paragraph revision and authority anchors in one server action flow.
- Update `ParagraphView` or `ParagraphList` to inject and display authority markers per paragraph.
- Keep legacy `AuthorityAnchorEditor` working for `report_content` nodes.

### A2. Link-Only Edits Can Be Blocked As "No Visible Changes"

Severity: P0

Status: confirmed risk from code; reproduce manually before patching.

The paragraph editor supports inserting links:

- `ParagraphEditor.tsx` renders `EditorToolbar`.
- `EditorToolbar.tsx` can open `LinkInsertModal`.
- `LinkInsertModal.tsx` inserts archive links as `[[slug|title]]` and external links as `[label](url)`.

But paragraph save normalizes visible text before deciding whether a save is meaningful:

- `saveParagraph()` calls `normalizeForComparison()` on old and new content.
- `normalizeForComparison()` uses `normalizePublicRevisionText()`.
- `normalizePublicRevisionText()` removes markdown link targets and keeps only display text.
- If the old and new visible text are identical and the marginal note is unchanged, `saveParagraph()` returns `No visible changes detected.`

That means these edits can be blocked:

- Turning `Maneka Gandhi` into `[Maneka Gandhi](https://...)`
- Turning `Article 14` into `[[article-14|Article 14]]`
- Updating a URL while keeping the same label

This is especially serious because link and citation attachment are not cosmetic changes. They are scholarly grounding changes.

Impact:

- Link insertion can appear to "not stick" because the save path may reject link-only changes.
- The same class of risk exists in the legacy full-node editor, although it has a citation-sensitive bypass for some legal reference text patterns.
- The paragraph path currently has no link/citation-sensitive bypass.

Recommendation:

- Treat link target changes as meaningful scholarly infrastructure changes.
- Add a link-aware comparison helper that detects new or changed `[[...]]` links and markdown URLs even when visible text is unchanged.
- Consider a `revision_type` such as `link_edit`, `citation_addition`, or `authority_link_edit`.
- Add a focused regression test:
  1. Start with plain text.
  2. Add an archive link around existing text.
  3. Save.
  4. Reopen.
  5. Confirm raw markdown link persists.
  6. Save again without changes.
  7. Confirm the link remains.

### A3. Paragraph Editor Has No Draft Saving

Severity: P1, but urgent for author trust.

Status: confirmed from code.

The legacy editors have draft protection:

- `topic/new/page.tsx` uses `localStorage`, autosave, restore UI, and `beforeunload`.
- `topic/[slug]/edit/EditForm.tsx` uses node-scoped `localStorage` draft keys and restore UI.

`ParagraphEditor.tsx` has only component state:

- `content`
- `marginalNote`
- `groupLabel`
- `commitMessage`

It has no `localStorage`, no restore prompt, and no `beforeunload` or close-confirm guard.

Impact:

- A modal close, route refresh, browser refresh, or accidental Escape can lose a paragraph draft.
- This is more painful in paragraph-native mode because users now write in smaller but more frequent authoring sessions.

Recommendation:

- Add local draft persistence for paragraph create and paragraph edit.
- Draft key should include `nodeId`, `paragraphId` or `new`, `insertAfterOrder`, and preferably `stableId` when available.
- Autosave fields: content, marginal note, group label, commit message, saved timestamp, and original paragraph updated timestamp.
- Add restore/discard UI.
- Add close warning when dirty.

### A4. Paragraph Content Can Update Without a Paragraph Revision

Severity: P0/P1.

Status: confirmed from code.

In `saveParagraph()`:

- The paragraph row is updated first.
- Then `paragraph_revisions` is inserted.
- If revision insert fails, the error is logged but treated as non-fatal.

In `insertParagraph()` and `deleteParagraph()`:

- Paragraph revision insertion is not treated as a blocking failure.

Impact:

- The live paragraph can change without a reliable revision record.
- History, revert, recognition, and audit trails become incomplete.
- This weakens the core promise that paragraphs are independently versioned.

Recommendation:

- Make paragraph mutation and paragraph revision creation atomic.
- If full SQL transaction support is not available through the current client path, create an RPC for paragraph edit/insert/delete.
- At minimum, fail the save if revision creation fails and avoid silent non-fatal revision loss.

### A5. Historical "View State" Is Unsafe For Paragraph-Native Nodes

Severity: P0 for historical integrity.

Status: confirmed from code.

`topic/[slug]/page.tsx` supports viewing a historical node revision through `?revision=<id>`.

However:

- The page always fetches current active paragraphs.
- If `hasParagraphs` is true, it renders `ParagraphList`.
- It does this even when `isViewingOldRevision` is true.
- The historical `reportContent` from the selected legacy revision is only used in the legacy `ReportContent` branch.

Impact:

- For paragraph-native nodes, "View State" can show current paragraphs while the banner says the user is viewing an old revision.
- This is misleading and can break legal/historical trust.
- Node snapshots were deferred, but the UI currently presents a stronger historical guarantee than the data model can satisfy.

Recommendation:

- Until node snapshots exist, disable or relabel `View State` for paragraph-native nodes.
- Add a clear fallback: "Paragraph-native historical reconstruction is not available yet."
- Long term, introduce node snapshots or reconstruct from paragraph revision timestamps.

## Category B - Reading Experience Audit

Status: presentation not yet validated.

The architecture is working as a model, but the reader surface does not yet feel like a calm legal text.

### B1. Paragraphs Are Not Visually Dominant Enough

Evidence:

- Topic page uses a three-column layout: left navigation sidebar, central content, right context panel.
- Central content max width is about 820px and is wrapped in a card-like surface.
- Right context includes scholarly grounding, knowledge intelligence, and community layers.
- Below content, institutional signals, cross-references, flags, peer review, and deletion controls continue the system-heavy page feel.

Impact:

- The reader sees platform machinery around the text.
- The page still feels like an operating console around a document, not a document with gentle scholarly aids.

Recommendation:

- Audit a dedicated reading mode before visual redesign.
- Test one paragraph-native node with left and right sidebars hidden, collapsed, or moved below content.
- Measure whether the text, paragraph number, and marginal note become the first visual read.

### B2. Marginal Notes Are Too Small And Too Hidden

Evidence:

- `.paragraph-marginal-note` width is 50px.
- Font size is `0.5rem`.
- Opacity is `0.3` by default and only `0.7` on hover.
- Marginal notes are hidden on mobile.

Impact:

- Marginal notes do not behave like Seervai-style marginal notes.
- They act more like low-priority metadata.
- The reader cannot scan the doctrinal flow through the margin.

Recommendation:

- Treat the marginal note as a stable scanning label, not hover metadata.
- Increase margin width and text size.
- Keep it visible by default on desktop.
- Consider a mobile alternative such as a small inline label above each paragraph.

### B3. Paragraph Numbers Are Too Subtle

Evidence:

- `.paragraph-number` opacity is `0.35` by default.
- It becomes prominent only on hover.

Impact:

- The paragraph number is not a confident citation marker.
- It does not feel like the platform's atomic legal unit.

Recommendation:

- Make paragraph numbers visible by default.
- Keep hover effects for actions, not for the existence of the citation unit.

### B4. Authoring Controls Compete With Reading

Evidence:

- `ParagraphView` action bar contains Edit, Copy link, History, and Delete.
- Insert buttons appear between every paragraph.
- The top page action still says "Improve" and routes to the full-node editor.

Impact:

- The reader surface carries edit controls inside the reading rhythm.
- Insertion affordances are useful for editors, but they should not shape the normal reading experience.

Recommendation:

- Separate "reading mode" from "editing mode" more clearly.
- Keep paragraph actions available, but reduce their visual footprint until an explicit edit intent.

## Category C - Paragraph-Native System Audit

### C1. Improve Button

Old unit:

- Node.
- The top "Improve" button links to `/topic/[slug]/edit`.
- That editor writes a new row into `revisions`.

Paragraph-native equivalent:

- Edit one paragraph.
- Add one paragraph.
- Possibly improve selected paragraphs as a bundle.

Current gap:

- Paragraph hover edit exists.
- Top-level "Improve" still routes to the legacy full-node editor.
- On paragraph-native nodes, the full-node editor can diverge from paragraph content because the live content lives in `paragraphs`.

Recommendation:

- Hybrid.
- Keep full-node edit only for legacy nodes, structural rewrites, metadata/type changes, and bulk import.
- On paragraph-native nodes, top "Improve" should guide the user to paragraph-level contribution.
- Future: support "Improve selected paragraphs" as a paragraph revision bundle.

### C2. Knowledge Intelligence Extraction

Old unit:

- Latest node revision content from `revisions.report_content`.
- Node metadata stored in `nodes.metadata`.
- Revision semantics stored in `revision_semantics`.

Current gap:

- Paragraph-native creation creates an empty node-level revision as a marker.
- `extractMetadata()` fetches the latest `revisions.report_content`.
- For paragraph-native nodes, that content can be empty even though `paragraphs.content` has the real text.
- Paragraph edits do not call `extractMetadata()` or `extractRevisionSemantics()`.

Paragraph-native equivalent:

- Paragraph-level semantic extraction for individual paragraph revisions.
- Node-level aggregate extraction from the ordered active paragraph set.

Recommendation:

- Hybrid.
- Keep node metadata as the aggregate quick reference.
- Build extraction input from ordered paragraphs when paragraphs exist.
- Add paragraph revision semantics for paragraph edits.
- Recompute node metadata when meaningful paragraph edits, insertions, deletions, or reorderings occur.

### C3. View History

Old unit:

- Node revision timeline from `revisions`.

Current paragraph-native behavior:

- `ParagraphHistory` exists for individual paragraphs.
- Node history page still fetches only `revisions`.
- Paragraph revisions do not appear in node history.
- Historical "View State" is unsafe for paragraph-native nodes, as described in A5.

Paragraph-native equivalent:

- Paragraph history for focused editing.
- Node history as a merged chronological timeline of paragraph events plus structural snapshots.

Recommendation:

- Hybrid.
- Keep paragraph history for local edits.
- Make node history an activity ledger that includes paragraph creations, edits, deletions, and reverts.
- Add node snapshots for actual point-in-time reconstruction.
- Until snapshots exist, avoid claiming old paragraph-native state can be viewed.

### C4. Compare Page

Old unit:

- Diff two rows from `revisions`.
- Diff content from `report_content` or `tier1_content`.

Current gap:

- Paragraph edits write `paragraph_revisions`, not `revisions`.
- Compare page cannot compare paragraph revisions.
- `DiffViewer` has paragraph-style grouping, but that is textual grouping inside legacy node revisions, not database paragraph comparison.

Paragraph-native equivalent:

- Compare one paragraph revision against its previous paragraph revision.
- Compare node snapshots for whole-node historical changes.

Recommendation:

- Hybrid.
- Add paragraph compare first because it is immediately useful and low scope.
- Keep legacy node compare for legacy nodes.
- Add node snapshot compare after structural snapshot support exists.

### C5. Quality Infrastructure

Old unit:

- Node quality tier.
- Quality votes and assessments are tied to `node_id` and latest `revisions.id`.
- Peer review snapshots latest node revision.
- Contributor independence checks inspect `revisions`.

Current gap:

- Paragraph-only contributors may not appear in independence checks.
- Paragraph-only contributions may not receive proportional quality advancement credit.
- Quality staleness checks use latest node revision, which may not change after paragraph edits.
- The system cannot yet ask "is Para 8 accurate and well-sourced?"

Paragraph-native equivalent:

- Paragraph quality for accuracy, sourcing, clarity, and claim discipline.
- Node quality for completeness, coherence, coverage, and structural integrity.

Recommendation:

- Hybrid.
- Introduce paragraph-level quality flags or review notes before full scoring.
- Keep final tier at node level.
- Compute node-level quality from paragraph quality plus whole-node coherence.
- Update independence and reward calculations to include paragraph revisions.

### C6. Chronicle / Activity Feed

Old unit:

- `recognition_feed_view` emits activity from node revisions, acknowledgments, endorsements, quality votes, quality assessments, group posts, and mentorship events.

Current gap:

- Paragraph revisions are not in the recognition/activity feed.
- The platform can say "Vipin edited Article 14" but not "Vipin revised Para 8."

Paragraph-native equivalent:

- Activity events for paragraph created, paragraph revised, paragraph deleted, paragraph reverted.
- Group multiple paragraph events by user and node to avoid feed noise.

Recommendation:

- Hybrid.
- Add paragraph revision activity types.
- Display marginal note and current display number.
- Use stable paragraph identity internally.
- Group bursts such as "created 5 paragraphs in Article 14."

### C7. Recognition

Old unit:

- Recognition actions target `revision_id`.
- Acknowledgments and endorsements query `contribution_votes` and `endorsements` by `revision_id`.
- Scholar stars use `source_type = 'revision'`.

Current gap:

- Paragraph revisions cannot be acknowledged, endorsed, or starred through the existing recognition model.
- Article-level endorsement stats aggregate old revision-based events.

Paragraph-native equivalent:

- Recognize a paragraph revision.
- Recognize a bundle of paragraph revisions.
- Recognize a whole-node milestone after a set of paragraph edits.

Recommendation:

- Hybrid.
- Add source support for `paragraph_revision`.
- Keep node-level recognition for broad article-level improvements.
- Add UI language that names the contribution unit: "Revised Para 12 - Rational nexus."

### C8. Reputation

Old unit:

- Accepted edit count and reputation events are driven by `revisions`.
- `processEditAcceptance()` processes revision acceptances.
- `acceptEdit()` awards reputation with `source_type = 'revision'`.

Current gap:

- Paragraph revisions do not increment total edit count.
- Paragraph revisions do not enter the 72-hour acceptance flow.
- Paragraph contributors may not advance through reputation levels.

Paragraph-native equivalent:

- Paragraph revision acceptance.
- Reputation events with `source_type = 'paragraph_revision'`.
- Optional aggregation for multiple accepted paragraph edits in one node.

Recommendation:

- Hybrid.
- Extend acceptance processing to `paragraph_revisions`.
- Update profile counters to count paragraph edits.
- Avoid double counting when a future node snapshot is created from paragraph edits.

## Recommended Execution Order

### P0 - Stop Data And Trust Regressions

1. Add paragraph-aware authority anchoring.
2. Fix link-only save detection.
3. Make paragraph save and paragraph revision creation atomic.
4. Disable or clearly label historical view state for paragraph-native nodes until snapshots exist.

### P1 - Protect Contributor Work

1. Add paragraph draft autosave.
2. Add dirty-close warnings for paragraph editor modal.
3. Add regression tests for link round-trips, authority attachment, and draft restore.

### P2 - Reading Experience Audit

1. Create a focused reading-mode prototype.
2. Make paragraph numbers and marginal notes stable visual anchors.
3. Reduce sidebar and platform-control competition.
4. Compare against the Seervai reading goal.

### P3 - System Integration Redesign

1. Merge paragraph revisions into node history and activity feed.
2. Add paragraph compare.
3. Make metadata extraction paragraph-aware.
4. Update quality, recognition, reputation, and peer review to include paragraph revisions.

## Bottom Line

The paragraph model is not the problem. The paragraph model is exposing the old assumptions.

The next engineering move should not be a broad redesign. It should be a focused stabilization pass that makes paragraph authoring as safe as legacy authoring:

- source-grounded
- link-safe
- draft-safe
- revision-safe
- historically honest

Only after that should the reading experience and governance systems be redesigned around the paragraph as the true contribution unit.
