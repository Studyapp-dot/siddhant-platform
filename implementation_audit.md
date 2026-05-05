# Reputation System — Implementation Audit

> Cross-referenced against both design documents:
> - [Original Plan](file:///c:/Users/Nipun/OneDrive/Desktop/Legal%20Platfrom%20-%20AG/original_implementation_plan%20Reputation%20Mechanism%20%26%20User%20Hierarchy%20%E2%80%94%20Design%20Document)
> - [Final Plan](file:///c:/Users/Nipun/OneDrive/Desktop/Legal%20Platfrom%20-%20AG/implementation_plan%20(%20Reputation%20Mechanism%20%26%20User%20Hierarchy%20%E2%80%94%20Final%20Design%20Document%20))

---

## Part 1: User Levels — Names & Identity

| Level | Siddhant Name | DB Value | Status |
|-------|--------------|----------|--------|
| 1 | Reader | `reader` | ✅ In schema, in constants, in UI |
| 2 | Contributor | `contributor` | ✅ Default role, migration working |
| 3 | Recognized Contributor | `recognized` | ✅ In schema, advancement logic coded |
| 4 | Senior Scholar | `senior_scholar` | ✅ In schema, advancement logic coded |
| 5 | Steward | `steward` | ✅ In schema (mapped from old `admin`) |
| 6 | Governance Council | `governance_council` | ✅ In schema |

**Verdict: 6/6 COMPLETE** — All levels exist in database, constants file, and UI display.

---

## Part 2: What Each Level Can Do — Permissions

### Level 1 — Reader
| Capability | Plan Status | Build Status |
|-----------|-------------|--------------|
| Read all content | Always worked | ✅ Existing |
| View discussion pages, revision histories, contribution records | Always worked | ✅ Existing |
| Pending-changes contribution (edits enter a queue) | Approved for early stage | ❌ **NOT BUILT** |

### Level 2 — Contributor
| Capability | Plan Status | Build Status |
|-----------|-------------|--------------|
| Edits go live immediately | Always worked | ✅ Existing |
| Submit new nodes/articles | Always worked | ✅ Existing |
| Participate in all discussion spaces | Always worked | ✅ Existing |
| Public user profile with contribution history | Enhanced in this phase | ✅ Built |
| Follow/watch nodes for notifications | Pre-existing | ✅ Existing |
| Flag content issues (inline tags) | Pre-existing | ✅ Existing |

### Level 3 — Recognized Contributor
| Capability | Plan Status | Build Status |
|-----------|-------------|--------------|
| One-click revert of harmful edits | Approved | ❌ **NOT BUILT** |
| Mark flagged issues as resolved | Approved | ❌ **NOT BUILT** (no permission gate) |
| Fast-track minor corrections | Approved | ❌ **NOT BUILT** |
| Participate in peer review | Approved | ❌ **NOT BUILT** (no peer review UI) |
| Bypass pending-changes restrictions | Approved | N/A (pending changes not built) |

### Level 4 — Senior Scholar
| Capability | Plan Status | Build Status |
|-----------|-------------|--------------|
| Close content discussions and record consensus | Approved | ❌ **NOT BUILT** |
| Advance nodes to higher quality tiers | Approved | ❌ **NOT BUILT** |
| Participate in dispute resolution | Approved | ❌ **NOT BUILT** |
| Mentor subject-area groups | Approved | ❌ **NOT BUILT** |
| Propose content structure changes | Approved | ❌ **NOT BUILT** |

### Level 5 — Steward
| Capability | Plan Status | Build Status |
|-----------|-------------|--------------|
| Page protection (standard, extended, full) | Approved | ❌ **NOT BUILT** |
| Block users | Approved | ❌ **NOT BUILT** |
| Delete or restore content | Approved | ❌ **NOT BUILT** |
| Resolve escalated disputes | Approved | ❌ **NOT BUILT** |
| Grant specific tool access | Approved | ❌ **NOT BUILT** |

### Level 6 — Governance Council
| Capability | Plan Status | Build Status |
|-----------|-------------|--------------|
| Review Steward conduct | Approved | ❌ **NOT BUILT** |
| Appoint/remove Stewards | Approved | ❌ **NOT BUILT** |
| Propose platform-wide policy changes | Approved | ❌ **NOT BUILT** |

> [!IMPORTANT]
> **Summary**: The permission *infrastructure* (6 levels in DB, role checks possible) is in place, but **none of the level-gated actions have been built**. Right now, having Level 3 vs Level 2 makes no functional difference — it's a label, not a capability gate. This is expected: the design documents explicitly separated Phase 1 (infrastructure) from Phase 2 (interaction layer and permission gates).

---

## Part 3: Reputation Points

### Point Values — Implemented
| Action | Points (Plan) | Points (Code) | Status |
|--------|--------------|---------------|--------|
| Edit accepted — minor (<50 chars) | +2 | +2 | ✅ Function exists (`acceptEdit`) |
| Edit accepted — substantive (≥50 chars) | +5 | +5 | ✅ Function exists (`acceptEdit`) |
| Generic upvote received | +1 | +1 | ✅ Working (`toggleUpvote`) |
| "This Helped Me" endorsement | +10 | +10 | ✅ Working (`toggleEndorsement`) |
| Scholar Star received | +15 | +15 | ✅ Working (`awardScholarStar`) |
| Peer review completed | +3 | +3 | ⚠️ Constant defined, **no trigger** |
| Peer review aligned with consensus | +2 | +2 | ⚠️ Constant defined, **no trigger** |
| Discussion cited in closing summary | +5 | +5 | ⚠️ Constant defined, **no trigger** |
| Flagged issue subsequently resolved | +2 | +2 | ⚠️ Constant defined, **no trigger** |
| Mentee's first contribution | +5 | +5 | ⚠️ Constant defined, **no trigger** |
| Quality tier advancement (proportional) | Proportional | +0 placeholder | ⚠️ Constant defined, **no trigger** |

### Interaction Mechanisms — Status
| Mechanism | Status | Notes |
|-----------|--------|-------|
| Upvote button on revisions | ✅ **WORKING** | Toggle, self-prevention, rep awards |
| "This Helped Me" endorsement button | ✅ **WORKING** | Toggle, self-prevention, rep awards |
| Scholar Star modal with written reason | ✅ **WORKING** | 20-char minimum, self-prevention, rep awards |
| Edit acceptance timer (72h window) | ❌ **NOT RUNNING** | `acceptEdit()` function exists but **nothing calls it**. No cron job or scheduled function triggers it after 72 hours. |
| Character delta classification (minor vs substantive) | ✅ Logic exists | In `acceptEdit()`, threshold at 50 chars |
| Self-prevention on all actions | ✅ **WORKING** | Cannot upvote/endorse/star yourself |
| Voting ring detection | ❌ **NOT BUILT** | Plan acknowledged this for future |

> [!WARNING]
> **Critical gap**: The 72-hour edit acceptance timer has the server-side logic (`acceptEdit()`) but no scheduler calls it. Currently, **no edits are ever marked "accepted"**, which means `accepted_edits_count` stays at 0 for everyone, which means **level advancement can never trigger** since it requires ≥15 accepted edits. This is the single most important missing piece.

---

## Part 4: Level Advancement

| Transition | Criteria (Plan) | Code Status |
|-----------|----------------|-------------|
| 2 → 3 (Contributor → Recognized) | ≥15 accepted edits, ≥70% rate, ≥50 rep | ✅ Logic in `checkLevelAdvancement()` |
| 3 → 4 (Recognized → Senior Scholar) | ≥75 accepted, ≥80% rate, ≥400 rep + qualitative | ✅ Numeric logic coded (qualitative not enforced) |
| 4 → 5 (Senior Scholar → Steward) | Community nomination + vote | ❌ No nomination/voting system |
| 5 → 6 (Steward → Governance Council) | Community election | ❌ No election system |

**Level advancement check fires automatically** after every reputation award. The thresholds match the plan exactly. But see the timer warning above — without the acceptance timer, the `accepted_edits_count` prerequisite can never be met.

---

## Part 5: Profile Display

| Element | Plan | Status |
|---------|------|--------|
| Username (without @) | Implied | ✅ Fixed (removed @ prefix) |
| Level badge (prominent, color-coded) | Required | ✅ Built — sidebar + header |
| Reputation score (primary metric) | Required | ✅ Built — large number in sidebar |
| Accepted edits / total with percentage | Required | ✅ Built — acceptance rate displayed |
| Endorsement count ("This Helped Me") | Required | ✅ Built — in stats grid |
| Scholar Stars count | Required | ✅ Built — in stats grid |
| Peer reviews completed count | Required | ✅ Built — in stats grid |
| Scholar Stars with written reasons | Required (socialization signal) | ✅ Built — full cards with giver + reason |
| Reputation audit trail | Required (transparency) | ✅ Built — event log with context links |
| Contribution history | Required | ✅ Built — with revision cards |
| Discussion contributions | Added by user request | ✅ Built |
| Flags raised | Added by user request | ✅ Built |
| Subject Groups membership | From original plan | ❌ **NOT DISPLAYED** |
| Member Since date | From original plan | ✅ Built |
| Tabbed layout (Portfolio / Reputation / Community) | Added by user request | ✅ Built |
| Context links in reputation events (→ which revision) | Added by user request | ✅ Built |

---

## Part 6: Database & Infrastructure

### Tables & Columns
| Item | Status |
|------|--------|
| `profiles.role` expanded (6 values + CHECK constraint) | ✅ |
| `profiles.accepted_edits_count` | ✅ |
| `profiles.total_edits_count` | ✅ |
| `profiles.endorsements_received` | ✅ |
| `profiles.peer_reviews_completed` | ✅ |
| `profiles.scholar_stars_received` | ✅ |
| `reputation_events` table (audit trail) | ✅ |
| `endorsements` table ("This Helped Me") | ✅ |
| `scholar_stars` table (with written reason) | ✅ |
| `contribution_votes` table (generic upvotes) | ✅ |
| RLS policies updated for 6 levels | ✅ |
| `recent_changes_view` with author reputation | ✅ |
| Backfill script for existing profiles | ✅ |
| RPC functions (SECURITY DEFINER) for cross-user mutations | ✅ |

### Navigation
| Item | Status |
|------|--------|
| Recent Changes as top-level nav item | ✅ |
| Recent Changes in landing page navbar | ✅ |
| Recent Changes in landing page footer | ✅ |
| Recent Changes in dashboard sidebar | ✅ |
| Level badges on recent changes entries | ✅ |
| Level badges on revision history entries | ✅ |

---

## Overall Scorecard

| Category | Built | Remaining | Completion |
|----------|-------|-----------|------------|
| **User Levels** (names, DB schema) | 6/6 | 0 | 100% |
| **Level Permissions** (functional gates) | 0/~20 | ~20 | 0% |
| **Reputation Points** (earning mechanisms) | 3/11 triggers | 8 triggers | ~27% |
| **Level Advancement** (algorithmic) | 2/2 coded | Timer missing | ~80% |
| **Level Advancement** (community) | 0/2 | 2 | 0% |
| **Profile Display** | 13/14 | 1 | ~93% |
| **Database Schema** | 14/14 | 0 | 100% |
| **Navigation & UI** | 6/6 | 0 | 100% |

> [!NOTE]
> **Phase 1 of the Final Design Document is essentially complete** — database schema, profile display, recent changes prominence, reputation engine backbone. What remains is primarily Phase 2 work (interaction layer, permission gates, peer review UI) plus the critical 72h acceptance timer.

---

---

# Quality Tiers — Design Analysis

## The Conflict You Identified

Your research says two things that appeared contradictory:
1. Quality tier upgradation should be **automated** (based on community work)
2. Level 4 users would **formally advance** the tier

You correctly resolved this: **the system calculates whether criteria are met; the Level 4 user performs the formal act of recording the advancement.** It's like a judge announcing a verdict that the jury already decided — the human action is the ceremony, the criteria are the substance.

## The Bigger Problem: Activity ≠ Quality

Your Wikipedia research reveals a fundamental design flaw in the original research-based quality tier model:

| Approach | What it measures | Problem |
|----------|-----------------|---------|
| **Research-based** (our original) | Number of edits, community activity on the node | A node with 50 edit wars is "higher quality" than a node with one perfect expert contribution |
| **Wikipedia-based** (your finding) | Actual content quality: accuracy, completeness, neutrality, sourcing | The **destination** matters, not the journey |

> [!CAUTION]
> The original research plan tied quality tier advancement to **activity metrics** (number of edits, peer reviews completed on the node). Your Wikipedia research shows this is fundamentally wrong. **Quality tier should reflect the state of the content, not the volume of activity around it.**

## Proposed Quality Tier Model for Siddhant

Based on your Wikipedia research, adapted for a legal knowledge graph:

### Tier Structure

| Tier | Name | What It Means | Who Decides |
|------|------|---------------|-------------|
| **Stub** | Draft | Bare-bones content. A few sentences. Missing citations. | Auto-assigned on creation |
| **Start** | Developing | Some meaningful content but incomplete. Needs citations and structure. | Any editor (self-assessed) |
| **C** | Useful | Useful to a casual reader but has significant gaps. | Any editor (self-assessed) |
| **B** | Solid | Mostly complete, well-referenced, minor gaps only. | Individual Level 3+ editor |
| **Good** | Good Article ✓ | Meets core editorial standards. Reviewed by at least one independent editor. | **One independent Level 3+ reviewer** (who did NOT contribute to the node) |
| **Featured** | Featured Article ★ | Definitive, comprehensive, stable. Scholarly citations. | **Multi-editor consensus** (Level 4+ reviewers, formal review process) |

### Key Design Principles

1. **Lower tiers (Stub → C)**: Any editor can "flip the switch" by updating the assessment — just like Wikipedia's Talk Page dropdown. If someone disagrees, they can switch it back with a note.

2. **Mid-tier (B)**: Requires a Level 3+ editor to assess. This is where the institutional quality gate begins.

3. **Upper tiers (Good, Featured)**: Require formal review by editors who are **independent of the node** — they cannot have significantly contributed to it. This prevents "rating inflation."

4. **Content-based criteria, NOT activity-based**:
   - ❌ "This node has 15 edits" → does NOT determine quality
   - ✅ "This node covers all aspects of the doctrine, cites primary sources, maintains neutral tone" → DOES determine quality

5. **The "rot" problem**: A "Good Article" from 6 months ago might no longer meet standards if new case law has emerged. Quality tiers should be **reassessable** — any Level 3+ editor can initiate a reassessment.

6. **The "hidden gem" problem**: A node might have been massively improved but still shows "Draft" because nobody updated the tier. The system should surface candidates for reassessment (e.g., "This Draft node has 5,000 characters and 12 citations — consider upgrading").

### How This Connects to Level 4 Powers

The Final Design Document says Level 4 (Senior Scholar) can **"advance nodes to higher quality tiers when criteria are met."** With the Wikipedia-informed model:

- Level 4 users can **formally advance** a node to **Good Article** or **Featured** status after a review process
- They are the "independent reviewer" for Good Article nominations
- They participate in the multi-editor consensus for Featured nominations
- They **cannot** review nodes they significantly contributed to (independence requirement)

### What Needs To Be Built (Future Work)

1. **`quality_tier` column on `nodes` table** — values: `stub`, `start`, `c_class`, `b_class`, `good_article`, `featured`
2. **Quality assessment UI** — on each node's Talk/Discussion page, a dropdown or panel for assessing tier
3. **Assessment history** — who changed the tier, when, and why (audit trail)
4. **Nomination workflow** — for Good and Featured status, a formal nomination and review process
5. **Reassessment mechanism** — ability to initiate a quality review
6. **Quality badge** — visible on the node page (we already have a `getQualityTier()` function that uses revision count — this needs to be replaced with the actual assessed tier)

> [!IMPORTANT]
> **The existing `getQualityTier()` function in `topic/[slug]/page.tsx`** currently uses `revisionCount` to compute quality labels. This is exactly the activity-based approach your research says is wrong. When quality tiers are built properly, this function should read from the `quality_tier` column on the `nodes` table instead.

---

## Prioritized Next Steps

### Immediate (Critical Path)
1. **Build the 72h edit acceptance timer** — Without this, no edits are ever "accepted," `accepted_edits_count` stays at 0, and level advancement is permanently blocked
2. **Fix `getQualityTier()`** — At minimum, add a database column and stop using revision count as a quality proxy

### Near-Term (Phase 2 Completion)
3. **Permission gates** — Make Level 3+ required for one-click revert, flag resolution
4. **Peer review rubric interface** — The most complex remaining UI
5. **Quality tier assessment UI** — The dropdown/panel on node pages

### Future (Phase 3)
6. **Pending-changes queue** for Level 1 readers
7. **Community nomination/election** for Steward and Governance Council
8. **Voting ring detection**
9. **Good Article / Featured Article review workflow**
