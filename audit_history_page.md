# 3. HISTORY PAGE — AUDIT ANSWERS

> **Scope**: [page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/history/page.tsx), [HistoryListClient.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/history/HistoryListClient.tsx), [history.css](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/history/history.css), [compare/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/compare/page.tsx), [DiffViewer.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/compare/DiffViewer.tsx)

---

## A. Purpose

**1. What is the intended role of the History page?**
To serve as the **permanent, transparent, chronological record** of every revision made to a node. The CSS header calls it "LEGAL LEDGER" — it is designed as an audit trail + scholarly evolution record. It shows who changed what, when, and provides entry points into review (endorsement drawer), comparison (diff viewer), and state viewing (article at any point in time).

**2. Is it an audit trail, scholarly evolution, transparency system, legal precedent timeline, contributor history, or all of these?**
**All of these, with varying degrees of completeness:**

| Role | Implementation Status |
|---|---|
| **Audit trail** | ✅ Complete — every revision with timestamp, author, revision ID, commit message |
| **Transparency system** | ✅ Complete — reverts, flags, endorsement counts all visible inline |
| **Contributor history** | ✅ Complete — author name, role badge (L1-L6), reputation score per revision |
| **Scholarly evolution** | ⚠️ Partial — commit messages show intent, but no semantic categorization of changes |
| **Legal precedent timeline** | ⚠️ Partial — chronological list exists, but no legal-specific timeline visualization |

---

## B. Timeline Structure

**3. What exactly appears in history?**
Each revision card displays:
- **Radio selectors**: "Old" and "New" radio buttons for comparison selection
- **Timestamp**: Date (DD Mon YYYY format, en-IN locale) + time (HH:MM)
- **Revision ID badge**: First 8 chars of UUID, monospace font, copy-on-select
- **Status badges**: ↩ REVERT (amber), ✗ REVERTED (red), ⚑ FLAGGED (gold)
- **Commit message**: Serif font, 1.2rem, the primary content of each card
- **Author block**: Avatar (first initial), username link, role badge (L1-L6 with color), reputation score
- **Social counts**: 👏 acknowledge count, 💡 insightful count (only if > 0)
- **Size delta**: Character count change badge (+green, -red, 0 muted, first revision blue)
- **Actions**: "View State" link + "Review & Endorse" button (for non-own, non-revert, non-reverted revisions)

**4. Are entries chronological only?**
**Yes — strictly reverse chronological** (newest first). The query uses `ORDER BY created_at DESC`. There is no sorting option for any other order.

**5. Can users filter by contributor, topic, node, article, type of edit, or time range?**
**No filtering exists on the History page.** It shows ALL revisions for the current node in reverse chronological order. No contributor filter, no date range filter, no edit type filter, no search.

The separate **Recent Changes page** (`/recent-changes`) provides platform-wide filtering by activity type (revisions, discussions, inline tags, peer reviews, flagged, recognition) — but not per-node filtering.

**6. Can users compare revisions?**
**Yes — via radio button selection.** Each revision has "Old" and "New" radio buttons. Users select two revisions and click "Compare Selected" to navigate to `/topic/{slug}/compare?oldRev={id}&newRev={id}`.

The Compare page shows:
- Commit message cards side-by-side (Previous → New Revision)
- Author and date for each
- Character size delta
- Full word-level diff with Unified/Split view toggle
- Word addition/deletion statistics

Additionally, clicking "View State" shows the article as it appeared at any point in time.

---

## C. Historical Intelligence

**7. Does the system surface major doctrinal shifts, controversial edits, highly reviewed changes, or disputed changes?**

| Signal | Surfaced? | How? |
|---|---|---|
| **Major doctrinal shifts** | ❌ No | No semantic categorization of edit impact |
| **Controversial edits** | ⚠️ Partially | Flagged revisions show ⚑ FLAGGED badge |
| **Highly reviewed changes** | ⚠️ Partially | 👏 and 💡 counts shown inline — high-count revisions stand out |
| **Disputed changes** | ⚠️ Partially | Reverted revisions shown at 0.55 opacity with red border; flags visible |

There is no computed "significance" score, no "this revision changed the legal position" indicator, no controversy metric.

**8. Can users understand WHY a change happened?**
**Partially.** The commit message is prominently displayed (1.2rem serif, largest text element in each card). On the edit page, contributors provide structured commit info:
- **What changed** (required, 20+ char minimum)
- **Concept improved** (required)
- **Evidence/reasoning** (required)

These are concatenated into a single commit message string. So the WHY is available but is unstructured text within the commit message.

**9. Is reviewer reasoning preserved historically?**
- **Endorsement reasoning**: If a professional note was written, it's posted to the Discussion page — but NOT linked back from the History page
- **Peer review reasoning**: Fully preserved — criteria scores, comments, overall comment, confidence, alignment, and consensus summary are all stored and viewable in the PeerReviewPanel
- **Flag reasoning**: Stored in `revisions.flag_reason` and visible in the ContributionReviewDrawer
- **Revert reasoning**: Stored in the revert revision's commit message (prefixed with "Revert: ")

**10. Are citations/version lineage visible?**
- **Version lineage**: Implied by chronological ordering and size deltas. Each revision has a unique ID badge. The Compare page shows explicit lineage between any two selected revisions.
- **Citation lineage**: ❌ Not tracked. There is no citation diff, no "this revision added/removed these citations" view.

---

## D. Readability & Cognitive Flow

**11. What currently feels difficult to scan?**
- **Uniform card density**: Every revision gets the same visual weight. The 12th revision looks identical to the 1st. There's no visual hierarchy based on significance.
- **Commit messages vary wildly**: Some are one-line ("Updated content"), others are multi-sentence structured messages. No truncation or expansion.
- **Author blocks take significant space**: Avatar + name + role badge + reputation score occupy multiple lines per card.
- **Radio selectors add cognitive overhead**: "Old" and "New" labels with radio buttons on every card require understanding the comparison workflow.

**12. What creates visual overload?**
- **Dense revision list**: Each card has 5+ data elements (timestamp, ID, status badges, commit message, author block, social counts, size delta, actions). For nodes with 20+ revisions, this creates a wall of information.
- **Multiple badge types**: Role badges (L1-L6), status badges (REVERT/REVERTED/FLAGGED), social counts (👏/💡), size deltas (+/-) — too many small colored elements competing for attention.
- **1px gap between cards**: The `revisions-list` uses `gap: 1px` with border-subtle background, creating a very dense visual.

**13. Are important edits visually distinguishable?**
**Partially:**
- **Reverts**: Amber left border + amber background tint
- **Reverted edits**: 0.55 opacity + red left border
- **Flagged edits**: Gold left border + gold background tint + ⚑ FLAGGED badge
- **First revision**: Blue size delta badge ("+N" in blue instead of green)
- **Regular edits**: No visual distinction based on size, impact, or significance

**14. Is scholarly significance communicated?**
**No.** There is no "importance" indicator, no "major revision" flag, no "minor edit" marker. All revisions are presented with equal visual weight. The only indirect signal is the size delta (large positive changes might indicate major additions).

---

## E. Transparency & Trust

**15. Can users trace who changed what, when, why, based on which sources, and approved by whom?**

| Question | Traceable? |
|---|---|
| **Who** | ✅ Author name, role, reputation score |
| **What** | ✅ Via diff comparison (Compare Selected or View State) |
| **When** | ✅ Date + time, locale-formatted |
| **Why** | ⚠️ Commit message (structured on edit page but concatenated into one string) |
| **Based on which sources** | ❌ No source tracking per revision |
| **Approved by whom** | ⚠️ 72-hour acceptance timer runs silently. Endorsement counts visible. Peer review tracked separately in PeerReviewPanel. |

**16. Is rollback/audit visibility present?**
**Yes, strong:**
- Reverts create NEW revisions (never delete) → radical transparency
- Reverted revisions are visually dimmed (0.55 opacity) with red border
- Revert revisions show "↩ REVERT" badge
- Revert commit messages include the reason
- Restores are marked `is_revert=true` (administrative, non-reputation-earning)

**17. Is historical integrity protected?**
**Yes — by architecture:**
- Revisions are INSERT-only (never UPDATE or DELETE from the client)
- Reverts create new revisions rather than modifying old ones
- The `execute_revert` RPC is SECURITY DEFINER (server-side only)
- All revision IDs are UUIDs, shown publicly for reference
- Content size is stored per revision for delta computation

---

## F. Visualization

**18. Is history currently list-based, timeline-based, diff-based, or graph-based?**
**List-based.** It is a vertical list of cards (`flex-direction: column; gap: 1px`) inside a bordered container with rounded corners. Each card is a horizontal flex row.

There is no timeline visualization, no graph visualization, no diff-based view (diffs are only shown on the separate Compare page).

**19. Are semantic changes visualized?**
**No.** The `extract-revision-semantics.ts` utility extracts semantic data per revision, but this data is not surfaced on the History page. Semantic impact (e.g., "this edit changed the legal position on X") is not visualized.

**20. Are relationship changes visible?**
**No.** Edge (graph relationship) changes are managed on `/topic/{slug}/edges` and are not tracked in the revision history. If someone adds a "cites" edge to a judgment, this does not appear in the revision history.

---

## G. Technical/System

**21. How are revisions stored?**
`revisions` table with columns:
- `id` (UUID, PK)
- `node_id` (FK to nodes)
- `author_id` (FK to profiles)
- `report_content` (text — full article content, NOT incremental diff)
- `tier1_content` (legacy column, same purpose)
- `commit_message` (text)
- `content_size` (integer — character count)
- `created_at` (timestamp)
- `is_revert` (boolean)
- `is_reverted` (boolean)
- `reverted_revision_id` (UUID, FK — which revision this reverted)
- `is_flagged` (boolean)
- `flag_reason` (text)
- `flagged_by` (UUID)
- `acceptance_processed` (boolean — for 72-hour timer)

**22. Is versioning immutable?**
**Mostly yes.** Revisions are INSERT-only from the application layer. The only UPDATE operations are:
- `is_reverted = true` (via `execute_revert` RPC)
- `is_flagged`, `flag_reason`, `flagged_by` (via `resolve_revision_flag` RPC)
- `acceptance_processed` (via edit acceptance timer)

Content (`report_content`) is never modified after insert.

**23. Are snapshots stored?**
**Yes — every revision stores the full article content.** This is a full-snapshot model, not an incremental diff model. Each revision contains the complete `report_content` text. This means:
- Any revision can be viewed independently (no need to reconstruct from diffs)
- Diffs are computed on-the-fly from consecutive full snapshots
- Storage grows linearly with edits (full content duplicated each time)

**24. How are diffs computed?**
**On-the-fly**, not pre-computed. Two implementations exist:

1. **`computeWordDiff()`** in `diff-logic.ts` (shared utility): LCS-based word-level diff with simplified fallback for large texts (>500K token threshold)
2. **`computeWordDiff()`** in `DiffViewer.tsx` (Compare page): Identical algorithm, duplicated locally

Both tokenize on word boundaries (`/\S+\s*/g`), build an O(m×n) DP table, backtrack to produce edit operations, and merge consecutive same-type operations.

> [!WARNING]
> The diff algorithm is **duplicated** in two files (`diff-logic.ts` and `DiffViewer.tsx`). The ContributionReviewDrawer imports from `diff-logic.ts`, but the Compare page's DiffViewer has its own copy.

**25. Is there historical caching/pagination?**
- **Caching**: No explicit caching. The History page is a server component that queries Supabase on every request. Next.js may cache via its default behavior but no explicit cache strategy exists.
- **Pagination**: **No pagination.** The query fetches ALL revisions for the node with no `LIMIT`. For nodes with hundreds of revisions, this would load all data at once.

> [!CAUTION]
> **No pagination** — the History page will become increasingly slow for nodes with many revisions. All revisions, all vote counts, all endorsement counts, and all user votes are fetched in a single server-side render.

**26. How large can histories become?**
**Unbounded.** There is no revision limit per node. Each revision stores full article content. For an active node with daily edits over years, this could mean:
- Hundreds of revision rows
- Each containing full article text (potentially 10,000+ chars)
- Plus all associated vote/endorsement queries
- All loaded on every History page view without pagination
