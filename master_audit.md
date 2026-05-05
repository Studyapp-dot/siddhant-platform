# 🧠 MASTER AUDIT: Recognition + Revision + Endorsement System
## Complete Answers — All 66 Questions

> Every answer below is sourced from the **actual codebase** — SQL migrations, server actions, and frontend components. No assumptions.

---

# 🔴 SECTION 1: REVISION SYSTEM (CORE LAYER)

## 📦 Data & Storage

### Q1. What exactly is stored for each revision?

**Full content snapshot.** Each revision stores the complete `report_content` (the entire article text at time of save). There is NO diff storage — diffs are computed at read-time by comparing adjacent revisions.

Source: [siddhant_schema.sql](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/siddhant_schema.sql#L50-L60)

```sql
create table public.revisions (
  id uuid primary key,
  node_id uuid references public.nodes not null,
  author_id uuid references public.profiles not null,
  report_content text,        -- FULL content snapshot
  tier1_content text,         -- Legacy column
  commit_message text not null,
  created_at timestamptz
);
```

### Q2. Do we store revision_id, node_id, author_id, created_at, content_size?

**Yes — all five.** Plus additional tracking columns added by migrations:

| Field | Source | Notes |
|-------|--------|-------|
| `id` (revision_id) | Core schema | UUID v4 |
| `node_id` | Core schema | FK to nodes |
| `author_id` | Core schema | FK to profiles |
| `created_at` | Core schema | UTC timestamp |
| `content_size` | [revision_history_migration.sql](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/revision_history_migration.sql#L19-L20) | Character count of report_content |
| `acceptance_processed` | quality_and_acceptance_migration | Boolean — 72h timer processed? |
| `is_revert` | revert_system_migration | Was this created by a revert? |
| `is_reverted` | revert_system_migration | Has this been reverted? |
| `reverted_revision_id` | revert_system_migration | FK to the revision this undid |
| `is_flagged` | flagging migration | Admin flag |

### Q3. Is there a concept of parent revision / revision chain?

**Implicit chain, not explicit parent.** There is no `parent_revision_id` column. The chain is reconstructed by querying revisions for the same `node_id` ordered by `created_at DESC`. The `getRevisionDiffContext()` function does exactly this:

```typescript
// Fetch previous revision for this node
const { data: prevRevision } = await supabase
  .from('revisions')
  .select(...)
  .eq('node_id', revision.node_id)
  .lt('created_at', revision.created_at)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

> [!WARNING]
> **Gap:** No explicit `parent_id` means revision chains can't handle branching (concurrent edits). Currently this is fine because edits are sequential, but it's a scalability limitation.

---

## 🔗 Linking & Access

### Q4. Can we directly open a revision via URL?

**Yes, via the compare page:** `/topic/[slug]/compare?rev=[revision_id]`

The history page has a form that submits to `/topic/${slug}/compare`. Individual revisions are selectable there.

### Q5. Can we highlight what changed in that revision?

**Yes.** The system computes diffs at read-time using the `diff-match-patch` library. `getRevisionDiffContext()` fetches the current revision's content and the previous revision's content, then the client renders character-level diffs with green (additions) and red (deletions) highlighting.

### Q6. Do we support inline diff / side-by-side diff?

**Inline diff only.** The `RevisionCard.tsx` and `/compare` page both render inline diffs via `diff_match_patch`. No side-by-side view exists currently.

---

## ⚖️ Classification Logic

### Q7-8. How do we define minor vs substantive? Is the threshold configurable?

**Fixed threshold: 50 characters.** Applied in two places:

| Location | Logic |
|----------|-------|
| [feedUtils.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/recognition/feedUtils.ts#L105-L107) | `detailSize >= 50 ? 'substantive' : 'minor'` |
| [process_edit_acceptance SQL](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/revert_system_migration.sql#L84) | `v_is_minor := (v_char_delta < 50)` |
| [reputation.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/reputation.ts#L157) | `const isMinor = Math.abs(charDelta) < 50` |

> [!NOTE]
> The threshold is **hardcoded in 3 separate places** (SQL + 2 TypeScript files). It is NOT configurable via any admin UI or environment variable.

### Q9. Can a revision change category after review?

**No.** The minor/substantive classification is computed at the time of acceptance (72h window) and baked into the `reputation_events` record permanently. There is no mechanism to reclassify after the fact.

---

## 🧠 Review Lifecycle

### Q10. What happens after a revision is submitted?

Step-by-step flow from [edit/actions.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edit/actions.ts):

1. User submits edit → `submitRevision()` inserts into `revisions` table with `acceptance_processed = false`
2. `total_edits_count` incremented on user's profile
3. AI metadata re-extraction fires (async)
4. Redirect to topic page
5. **72-hour window opens** — other users can revert or flag
6. After 72h, `process_edit_acceptance()` RPC runs and auto-accepts if not reverted/flagged

### Q11. What defines accepted / rejected / flagged?

| Status | Definition | Source |
|--------|-----------|--------|
| **Accepted** | Revision survives 72h without being reverted or flagged | `process_edit_acceptance` SQL |
| **Rejected** | `is_reverted = true` — another user reverted the edit | `revert_system_migration.sql` |
| **Flagged** | `is_flagged = true` — admin flagged the revision | flagging migration |
| **Pending** | Less than 72h old, not reverted, not flagged | Frontend derivation in `feedUtils.ts` |

### Q12. Is the 72-hour rule hardcoded?

**Semi-configurable.** The SQL function `process_edit_acceptance(p_hours_threshold integer DEFAULT 72)` accepts a parameter, so the DB function is technically configurable. But the frontend status derivation in `feedUtils.ts` hardcodes `72 * 60 * 60 * 1000`:

```typescript
const seventyTwoHours = 72 * 60 * 60 * 1000;
if (ageMs >= seventyTwoHours) return 'accepted';
```

### Q13. Can users dispute rejection / appeal?

**No formal appeal mechanism.** A reverted edit can be re-applied by creating a new revision with the same content. There is no dispute queue, appeal workflow, or admin review panel for contested reverts.

---

## 📊 Visibility

### Q14. Can users see full revision history of a node?

**Yes.** `/topic/[slug]/history` shows all revisions for a node with diff comparison capability, revert buttons, and commit messages.

### Q15. Can we show "this revision led to X outcome"?

**Partially.** The `reputation_events` table links outcomes to source revisions via `source_id`. But this is **not surfaced in the UI** — users cannot currently see "this revision earned you +5 rep" or "this revision was endorsed by 3 scholars" from the revision itself.

> [!IMPORTANT]
> **Gap:** No "revision impact dashboard" exists. The data is there (`reputation_events.source_id` → revision), but the UI doesn't connect them.

---

# 🔴 SECTION 2: ENDORSEMENT SYSTEM

### Q16. Is every endorsement tied to revision_id or node_id?

**Tied to `revision_id`.** Both tables:

```sql
-- endorsements (Insightful)
UNIQUE(revision_id, endorser_id)

-- contribution_votes (Acknowledge)  
PRIMARY KEY (user_id, revision_id)
```

### Q17. Can a user endorse same revision multiple times?

**No.** Both tables enforce uniqueness:
- `endorsements`: `UNIQUE(revision_id, endorser_id)`
- `contribution_votes`: `PRIMARY KEY (user_id, revision_id)`

### Q18. Can a user endorse multiple revisions of same node?

**Yes.** The uniqueness constraint is per-revision, not per-node. A user can acknowledge/endorse revision #1, #2, #3 etc. of the same article.

### Q19-20. What endorsement types exist? Are they hardcoded?

| Type | Table | Base Points | Level Gate |
|------|-------|------------|------------|
| **Acknowledge** (👏) | `contribution_votes` | +1 | Any user |
| **Insightful** (💡) | `endorsements` | +10 | L2+ (Contributor) |
| **Scholar Star** (⭐) | `scholar_stars` | +15 | L2+ (Contributor) |

**Hardcoded.** Adding a new type requires: new DB table, new server action, new UI component, new reputation_events entry. Not extendable via config.

### Q21-23. How is endorsement weight calculated?

**Formula (from [contributions.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/contributions.ts#L32-L91)):**

```
effective_points = base_points × giver_level_multiplier × (1 / repeat_count)
```

| Giver Level | Multiplier |
|------------|-----------|
| L1 Reader | 0.5× |
| L2 Contributor | 1.0× |
| L3 Recognized | 1.5× |
| L4 Senior Scholar | 2.0× |
| L5 Steward | 2.5× |

The multiplier is **computed dynamically** at endorsement time (not stored). The `repeat_count` applies diminishing returns when the same giver endorses the same recipient across multiple revisions.

The **exact weight value IS shown in the UI** on endorsement cards: `{actorRole.multiplier}× Authority`.

### Q24-25. Do we store total endorsements per revision, or compute it?

**Both.** Aggregate counts are maintained on the `profiles` table (`endorsements_received`, `scholar_stars_received`) and are incremented via RPC on each new endorsement. Per-revision counts are **computed on demand** — there's no `endorsement_count` column on `revisions`.

### Q26-27. Do endorsements store text reasoning?

**No for Acknowledge/Insightful.** The `endorsements` table has only `(id, revision_id, endorser_id, created_at)`. No `reason` or `text` column.

**Yes for Scholar Stars** — the `reason` column is mandatory (50+ characters enforced).

> [!IMPORTANT]
> **Gap:** Adding text reasoning to endorsements would require: `ALTER TABLE endorsements ADD COLUMN reason text;` + UI changes. The schema change is trivial; the UX change is moderate.

### Q28-29. Can endorsements be removed/changed? Do we log history?

**Removable: Yes.** Both `toggleAcknowledge()` and `toggleInsightful()` support toggle-off (delete). RLS policies explicitly allow `DELETE USING (auth.uid() = endorser_id)`.

**History: Partial.** The `reputation_events` table logs when reputation was *awarded*, but does NOT log when an endorsement is *removed*. The anti-exploit protection: removing an endorsement does NOT re-award reputation on re-add (dedup check via `reputation_events`).

---

# 🔴 SECTION 3: SCHOLAR STAR SYSTEM

### Q30-31. Is Scholar Star tied to revision/node/discussion? Multiple stars to same revision?

**Tied to recipient + optional source.** Schema:

```sql
scholar_stars (
  recipient_id uuid,     -- WHO receives it
  giver_id uuid,         -- WHO gives it
  reason text,           -- WHY (mandatory)
  source_id uuid,        -- WHAT triggered it (optional revision/discussion ID)
  source_type text       -- 'revision' | 'discussion' | 'peer_review' | 'mentoring' | 'other'
)
```

**Multiple stars: Rate-limited.** One star per giver→recipient pair per 30 days. Different givers CAN star the same recipient/revision.

### Q32-33. What fields are stored? Is category stored?

Stored: `id, recipient_id, giver_id, reason, source_id, source_type, created_at`

**Category is NOT stored in the database.** The `SCHOLAR_STAR_CATEGORIES` (Citation, Doctrine, Diligence, Clarity, Detective) exist in [reputation-constants.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/reputation-constants.ts#L49-L80) and are used in the award UI, but the category is only embedded in the `reputation_events.description` string — not as a structured field.

> [!WARNING]
> **Gap:** Category is lost as structured data. The `scholar_stars` table needs `ADD COLUMN category text` to make categories queryable/filterable.

### Q34-35. Who can give Scholar Stars? Limits?

- **L2+ (Contributor) minimum** to give
- **Self-award blocked** (`CHECK (recipient_id != giver_id)`)
- **Rate limit:** 1 star per giver→recipient per 30 days (checked in `awardScholarStar()`)
- No global daily/weekly limit per user (they can star different people freely)

### Q36. Is justification required and validated?

**Yes, strictly.** Minimum 50 characters enforced server-side:
```typescript
if (!reason || reason.trim().length < 50) {
  return { error: 'Please provide a meaningful written reason (at least 50 characters)...' };
}
```

### Q37-38. Where does clicking Scholar Star send users? Can we link to exact revision?

**Currently: No deep link from the feed card.** The Scholar Star card in the recognition feed shows the justification and participants but has NO link to the source revision. The `source_id` IS stored in the DB and IS available in the feed view, but the UI doesn't use it for navigation.

> [!IMPORTANT]
> **Gap:** We have `source_id` and `source_type` — we should link Scholar Star cards to `/topic/[slug]/compare?rev=[source_id]` when `source_type = 'revision'`.

---

# 🔴 SECTION 4: REPUTATION SYSTEM

### Q39-40. Where is reputation calculated? Real-time or batch?

**Hybrid:**

| Trigger | Type | Source |
|---------|------|--------|
| Endorsement/Acknowledge/Star | **Real-time** via server action | [contributions.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/contributions.ts) |
| Edit acceptance (72h) | **Batch** via SQL RPC | `process_edit_acceptance()` in SQL |
| Quality tier advancement | **Real-time** within `cast_quality_vote()` RPC | quality_governance_migration.sql |

Reputation is stored on `profiles.reputation_score` (single integer). All point changes are logged in `reputation_events` for full audit trail.

### Q41-42. What contributes to reputation? Are weights configurable?

From [reputation-constants.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/actions/reputation-constants.ts#L17-L29):

| Event | Base Points | Actual (weighted) |
|-------|------------|-------------------|
| Minor edit accepted | +2 | Fixed |
| Substantive edit accepted | +5 | Fixed |
| Acknowledge received | +1 | × giver multiplier × diminishing |
| Insightful received | +10 | × giver multiplier × diminishing |
| Scholar Star received | +15 | × giver multiplier × diminishing |
| Peer review completed | +3 | Fixed |
| Peer review aligned | +2 | Fixed |
| Discussion cited | +5 | Fixed |
| Flag resolved | +2 | Fixed |
| Tier advancement bonus | Variable | Proportional to contribution size |

**Hardcoded** in `REPUTATION_POINTS` constant. Not configurable via admin UI.

### Q43-44. Can users game the system? Anti-spam safeguards?

**Safeguards in place:**

| Protection | Implementation |
|-----------|---------------|
| Self-endorsement blocked | `revision.author_id === user.id` check |
| Self-star blocked | `CHECK (recipient_id != giver_id)` in DB |
| Toggle exploit prevented | Dedup via `reputation_events` — re-adding doesn't re-award |
| Star rate-limiting | 1 per giver→recipient per 30 days |
| Insightful/Star level gate | L2+ required (must have contributed first) |
| Diminishing returns | Repeated giver→recipient pairs get reduced weight |
| Independence in quality votes | Contributors to a node cannot vote on its quality |
| Activity comments rate-limited | Max 20 per hour |

> [!NOTE]
> **Remaining vulnerability:** Two colluding L2+ users could exchange endorsements on each other's revisions indefinitely. The diminishing returns formula mitigates this but doesn't fully prevent it.

### Q45-46. How are roles updated? When does it trigger?

**Automatically** via `checkLevelAdvancement()` which runs after every `awardReputation()` call.

```
contributor → recognized:    15 accepted edits + 70% acceptance rate + 50 reputation
recognized → senior_scholar: 75 accepted edits + 80% acceptance rate + 400 reputation
```

**Steward and Governance Council require manual/community nomination** — no automatic path.

---

# 🔴 SECTION 5: QUALITY TIER SYSTEM

### Q47-48. How is tier decided?

**Dual-path system:**

| Tier Range | Mechanism | Requirement |
|-----------|-----------|-------------|
| stub → start → c_class → b_class | **Community blind voting** | Minimum 3 votes, majority wins |
| b_class → good_article → featured | **Formal peer review** | Senior Scholar sign-off via review_cycles |

Voting logic in `cast_quality_vote()`: majority vote among all voters, with minimum 3 votes to change from default.

### Q49. Is quality tier linked to revisions or node state?

**Linked to node state.** `nodes.quality_tier` is a column on the nodes table. Quality votes reference the `revision_id` that was current when the voter assessed it — but the tier is a property of the node, not the revision.

### Q50. Can user see why a node is at its current tier?

**Yes.** The `quality_assessments` table logs every tier change with `justification`, `previous_tier`, `new_tier`, and `assessor_id`. Additionally, after voting, users see the full vote breakdown (blind before voting, transparent after).

### Q51-52. Can tier go down? What triggers downgrade?

**Yes, tiers can go down** within the votable range. If new votes shift the majority from `c_class` back to `start`, the tier updates. The `cast_quality_vote` function applies whatever the majority consensus is — no directional constraint.

For `good_article`/`featured`, downgrade requires a new review cycle.

---

# 🔴 SECTION 6: RECOGNITION FEED

### Q53-54. What powers the feed? What fields are returned?

**SQL View: `recognition_feed_view`** — a `UNION ALL` of 6 queries:

1. Revisions (edits)
2. Scholar Stars
3. Insightful Endorsements
4. Acknowledges
5. Quality Votes
6. Quality Assessments

Returns 15 fields: `activity_id, activity_type, actor_id, actor_username, actor_role, actor_reputation, recipient_id, recipient_username, node_id, node_title, node_slug, detail_text, detail_category, detail_size, is_revert, is_reverted, is_flagged, created_at`

### Q55-56. Does each item include revision_id? Why are we not using it?

**Partially.** For endorsements and acknowledges, the `activity_id` is the endorsement/vote ID — **not the revision_id.** The revision is joined to get node context, but the actual `revision_id` being endorsed is not exposed as a separate field in the view.

> [!IMPORTANT]
> **Gap:** The feed view should expose `revision_id` as a dedicated column for endorsements/acknowledges. Currently we can't deep-link an endorsement card to the specific revision that was endorsed.

### Q57. Where is sorting done?

**Both.** The SQL view returns items ordered by `created_at DESC` (chronological). The **importance-based sorting** (Featured → High Value → Recent) is done entirely on the frontend in [page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/recognition/page.tsx) using `getImportanceScore()`.

### Q58. Is grouping frontend only?

**Yes.** Endorsement aggregation (`aggregateEndorsements()`) runs entirely in the frontend. The database returns individual rows; grouping by recipient+node is computed client-side in `feedUtils.ts`.

---

# 🔴 SECTION 7: USER EXPERIENCE FLOWS

### Q59. Edit Flow step-by-step

1. User navigates to `/topic/[slug]/edit`
2. Edits content in rich text editor
3. Writes commit message
4. Submits → `submitRevision()` server action
5. New revision row inserted (`acceptance_processed = false`)
6. `total_edits_count` incremented on profile
7. AI metadata re-extraction fires async
8. Redirect to `/topic/[slug]`
9. **72-hour community review window** — revert/flag possible
10. After 72h: `process_edit_acceptance()` awards reputation

### Q60. Where can user endorse from?

| Surface | Types Available |
|---------|----------------|
| `/topic/[slug]/history` | Acknowledge, Insightful (per revision) |
| `/recognition` feed | Acknowledge, Insightful (per revision card) |
| Spotlight Review Drawer | Acknowledge, Insightful + optional comment |

### Q61-62. How does user give a Scholar Star? What UI appears?

**Via `ScholarStarModal` component.** Triggered from the article page. Modal UI requires:
1. Select recipient (from contributors to the article)
2. Select category (Citation/Doctrine/Diligence/Clarity/Detective — 5 options)
3. Write justification (50+ characters minimum)
4. Submit → `awardScholarStar()` server action

### Q63. How does user discover high-quality content?

| Discovery Path | Mechanism |
|---------------|-----------|
| Recognition Feed | Sorted by importance — Scholar Stars and substantive edits surface first |
| Quality Tier Badges | Node pages show current quality tier |
| Top Contributors sidebar | Leaderboard of active scholars this week |
| Recent Changes | `/recent-changes` shows all platform activity |
| Knowledge Graph | `/nodes` shows connected topics |

---

# 🔴 SECTION 8: SYSTEM GAPS (HONEST ASSESSMENT)

### Q64. Where is the system weak?

1. **No revision-to-impact traceability in UI.** Data exists in `reputation_events.source_id` but users can't see "this revision earned X points, was endorsed by Y scholars"
2. **Endorsement reasons missing.** Only Scholar Stars have written reasons. Insightful/Acknowledge are binary with no explanation
3. **72h acceptance is passive.** No notification when edits are accepted/rejected — users have to check manually
4. **Feed aggregation is frontend-only.** Will not scale beyond ~500 items per page load
5. **Scholar Star category not stored structurally.** Only embedded in description strings

### Q65. What parts feel hacked together?

1. **The 50-char threshold** is duplicated in 3 places (SQL + 2 TS files) — should be a single constant
2. **Acknowledge uses `contribution_votes`** (composite PK) while Insightful uses `endorsements` (UUID PK) — inconsistent patterns for what are conceptually the same thing at different weights
3. **`activity_id` for acknowledges** uses `uuid_generate_v5()` to synthesize a UUID from the composite PK — a workaround, not a clean design
4. **The `process_edit_acceptance` RPC** must be called externally (no cron trigger) — it's unclear when/how it actually runs in production

### Q66. What would I redesign starting fresh?

1. **Unified endorsement table** with `type` column ('acknowledge', 'insightful') instead of two separate tables
2. **Explicit `parent_revision_id`** on revisions for proper chain tracking
3. **Store Scholar Star category** as a structured field, not embedded in description text
4. **Add `revision_id`** as an explicit column in the feed view for endorsement items
5. **Move importance scoring to the SQL view** — add a computed `importance_score` column to avoid frontend sorting at scale
6. **Add optional `reason` column** to the endorsements table
7. **Implement a cron/scheduled function** for `process_edit_acceptance` instead of relying on manual invocation

---

# 🚨 THE 3 MOST IMPORTANT QUESTIONS

### 1. Can we link every recognition event to an exact revision and show diff?

**Almost.** The data linkage exists:
- Endorsements: `endorsements.revision_id` → revision → node
- Scholar Stars: `scholar_stars.source_id` + `source_type = 'revision'`
- Quality Votes: `quality_votes.revision_id`

**But the UI doesn't use it.** The feed view doesn't expose `revision_id` for endorsement items, and Scholar Star cards don't link to the source revision. **Fix required:** Add `revision_id` to the feed view + add deep links in card components.

### 2. Can users see WHY something was endorsed in detail?

**Only for Scholar Stars** (mandatory 50+ character written reason). Acknowledge and Insightful are **binary signals with no explanation.** The `submitRecognition()` action supports an optional comment that gets posted to the Discussion board, but this is a separate discussion post — not attached to the endorsement record itself.

### 3. Can we show full contribution history of a user clearly?

**Partially.** The `/profile/[username]` page shows:
- Reputation score, role, accepted edits count
- Recent reputation events (last 20)
- Scholar Stars received (with reasons)

**Missing:** A unified "contribution timeline" showing all revisions, endorsements given/received, quality votes, and their outcomes. The data exists across `revisions`, `endorsements`, `contribution_votes`, `scholar_stars`, and `reputation_events` — but no single view aggregates it per-user.

---

# 📊 SYSTEM HEALTH SUMMARY

| Layer | Maturity | Notes |
|-------|----------|-------|
| **Revision Storage** | ✅ Strong | Full snapshots, proper audit trail |
| **Endorsement Logic** | ✅ Strong | Anti-gaming, weighted, deduplicated |
| **Scholar Star** | ✅ Strong | Rate-limited, justified, categorized |
| **Reputation Engine** | ✅ Strong | Transparent, auditable, weighted |
| **Quality Tiers** | ✅ Strong | Dual-path (voting + review), consensus-based |
| **Feed Data Layer** | ⚠️ Adequate | SQL view works but missing `revision_id` exposure |
| **Feed UI** | ⚠️ Adequate | Client-side sorting/aggregation won't scale |
| **Revision↔Impact Link** | ❌ Weak | Data exists but UI doesn't connect them |
| **User Contribution Profile** | ❌ Weak | No unified per-user contribution timeline |
| **Endorsement Reasoning** | ❌ Weak | Only Scholar Stars have written explanations |
