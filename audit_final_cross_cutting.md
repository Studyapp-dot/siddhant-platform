# FINAL CROSS-CUTTING QUESTIONS — ALL 3 PAGES

---

## 1. What are the biggest UX problems currently known?

### New Article Page
- **Silent error swallowing**: Server action errors (slug collisions, creation failures) are passed as URL query params but NEVER displayed in the UI
- **No draft/autosave**: Work can be lost entirely on navigation or crash
- **No preview**: Contributors cannot see how content renders before publishing
- **Raw textarea**: No rich text, no headings, no formatting tools for what should be scholarly long-form writing

### Review Contribution
- **Missing commit message**: The drawer shows the diff but NOT the author's commit message — reviewers can't see the stated intent of the change
- **Overloaded drawer**: Endorsement, Scholar Stars, flagging, reverting, and restoring all crammed into one 500px-wide panel
- **No citation-level review**: Diff is word-level text only — no structured view of citation changes, no source quality indicators

### History Page
- **No pagination**: ALL revisions loaded at once — will become a performance problem
- **No filtering**: Can't filter by contributor, date range, or edit type
- **Uniform visual weight**: Every revision looks identical regardless of significance
- **Duplicated diff algorithm**: Same LCS code exists in both `diff-logic.ts` and `DiffViewer.tsx`

---

## 2. Which sections feel unfinished?

| Page | Section | Status |
|---|---|---|
| New Article | Error display | ❌ Not implemented (errors in URL params, never rendered) |
| New Article | Draft system | ❌ Not implemented |
| New Article | Preview mode | ❌ Not implemented |
| New Article | Citation input | ❌ Not implemented (free text only) |
| New Article | Category/tag selection | ❌ Not implemented |
| New Article | Graph node linking during creation | ❌ Not implemented |
| Review Contribution | Direct notifications for endorsements | ❌ Not implemented |
| Review Contribution | Author response mechanism | ❌ Not implemented |
| Review Contribution | Escalation workflow | ❌ Not implemented |
| Review Contribution | Semantic impact display | ❌ Not implemented (data exists but not surfaced) |
| History | Pagination | ❌ Not implemented |
| History | Filtering/search | ❌ Not implemented |
| History | Semantic change visualization | ❌ Not implemented (data exists but not surfaced) |
| History | Edge change tracking | ❌ Not implemented |

---

## 3. Which workflows feel fragile?

1. **New Article creation error handling**: If slug already exists or DB insert fails, the user is redirected to `/topic/new?error=...` but sees no error message. They may retry and get the same invisible failure.

2. **AI metadata extraction**: Fire-and-forget with only `console.error` on failure. If extraction fails, the Quick Reference card never populates. No retry mechanism, no user notification.

3. **Revert chain**: A→B→Revert(B)→Re-Revert — there's no protection against revert wars. No cooldown, no escalation trigger, no edit-protection.

4. **Peer review timing**: If content is edited after a review cycle opens (snapshot revision changes), there's a warning banner but reviews are still accepted. The reviewed content may no longer match the current state.

5. **72-hour acceptance timer**: Runs lazily via `processEditAcceptance()` triggered by topic page visits. If no one visits the page, acceptance is never processed.

---

## 4. Which areas feel visually weakest?

1. **New Article error states**: No error UI exists at all
2. **History page mobile**: Single breakpoint at 900px, cards stack vertically but become very tall
3. **Compare page in dark mode**: The diff container has `background: white` hardcoded, with a `prefers-color-scheme: dark` override that may not trigger on theme-toggled dark mode (uses `:root:not(.light)` selector)
4. **Review drawer on mobile**: 500px max-width cuts to 90vw, but internal layouts (split view grid, recognition option grid) don't have mobile-specific adaptations
5. **History page sidebar**: Minimal content — just navigation links and a recognition legend. Feels underutilized compared to the topic page sidebar.

---

## 5. Which areas feel cognitively overwhelming?

1. **ContributionReviewDrawer**: 7+ distinct sections in a single scrollable panel — diff + endorsement types + comment + Scholar Star + flag + revert + restore
2. **PeerReviewPanel review form**: 6 criteria × 5 score dots × optional comment each, plus recommendation, confidence, and overall comment — this is a 20+ input form
3. **History page for active nodes**: Dense list of uniform cards with 5+ data elements per card, no visual hierarchy, no pagination
4. **Node type selection on New Article**: 8 types with emoji icons, hints only on hover (title attribute), no explanation of when to use which

---

## 6. Which areas are hardest for new users?

1. **Understanding node types**: "Topic" vs "Concept" vs "Doctrine" requires legal knowledge
2. **Commit message semantics**: "Commit Note" is Git jargon
3. **History page radio buttons**: "Old" and "New" selector pattern for comparison is unintuitive without prior experience with wiki-style history
4. **Review drawer endorsement types**: Understanding the difference between Acknowledge (+1) and Insightful (+10) and when to use each
5. **Peer review rubric**: 6 criteria with legal-domain-specific descriptions

---

## 7. Which areas are hardest for expert users?

1. **No keyboard shortcuts**: No way to quickly navigate between revisions in the review drawer beyond clicking Prev/Next
2. **No batch operations on History page**: Can't bulk-acknowledge, can't select multiple revisions for comparison
3. **No advanced diff options**: No ability to ignore whitespace, collapse unchanged sections, or filter by change type
4. **No direct citation-to-revision linking**: Expert reviewers cannot trace a specific citation back to the revision that introduced it
5. **No reviewer dashboard**: No "my pending reviews" view, no "revisions awaiting my assessment"

---

## 8. Which features are planned but not implemented?

Based on codebase analysis (placeholder text, comments, unused infrastructure):

1. **Draft system**: References to "drafting" in CSS class names but no actual draft persistence
2. **Rich text editing**: The textarea approach is clearly a placeholder — the platform's ambition exceeds raw textarea capability
3. **Notification integration for reviews**: `NotificationBell.tsx` exists but review events don't trigger notifications
4. **Category/tag system**: Not present for articles (though inline tags exist for flagging content issues)
5. **Citation management**: AI extraction exists post-publish, but no citation input tooling during writing
6. **Semantic diff visualization**: `extract-revision-semantics.ts` extracts data but it's never surfaced in UI
7. **Graph impact preview**: Edge management exists but has no preview/impact visualization

---

## 9. Which areas are most technically difficult to redesign?

1. **Editor upgrade (textarea → rich text)**: Would require integrating a library (TipTap/ProseMirror), migrating existing content format, updating diff algorithms for structured content, and changing the AI extraction pipeline. **High complexity, high impact.**

2. **History pagination**: Requires refactoring the server component to use cursor-based pagination, updating vote/endorsement count queries to be paginated, and adding client-side "load more" interaction. **Medium complexity, necessary for scale.**

3. **Splitting the Review Drawer**: Separating endorsement from management requires rethinking the entry points, creating separate UI surfaces, and potentially duplicating the revision-fetching logic. **Medium complexity, important for clarity.**

4. **Real-time collaborative review**: Adding Discussion-style threads within the review drawer would require WebSocket/realtime integration and significant UI restructuring. **High complexity.**

5. **Citation-aware diffing**: Would require parsing article content into a structured format where citations are first-class entities, then building a citation-aware diff algorithm. **Very high complexity.**

---

## 10. If you had to redesign one section completely, which would it be and why?

### Answer: The ContributionReviewDrawer

**Why this, above everything else:**

The Review Contribution drawer is the **single most important interaction point** for scholarly quality governance on the platform. It is where endorsement, management, and editorial judgment converge. Yet it currently suffers from:

1. **Identity crisis**: It tries to be an endorsement tool AND a moderation tool AND a diff viewer AND a social recognition engine — all in a 500px slide-out panel
2. **Missing critical context**: The author's commit message (their stated intent) is not shown
3. **No citation awareness**: For a legal knowledge platform, the inability to inspect citations during review is a fundamental gap
4. **No semantic impact display**: The AI already extracts revision semantics, but this data sits unused during the review process
5. **No structured reviewer output**: The drawer collects endorsement + optional comment, but the peer review rubric lives on an entirely separate component (PeerReviewPanel). These should be conceptually unified.

A redesign would:
- Split into separate **Endorsement** and **Management** surfaces
- Surface the commit message, semantic impact, and citation changes
- Add a "significance" classifier (minor edit, major revision, position change)
- Connect reviewer notes to the Discussion feed with deep-linking
- Add keyboard navigation for efficient expert review
- Implement a reviewer dashboard for tracking pending reviews

This single redesign would elevate the platform from "well-designed CMS with review features" to "purpose-built scholarly governance system."
