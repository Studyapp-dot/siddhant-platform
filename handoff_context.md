# Siddhant Platform: Project Handoff Context

*Use this document to provide context when starting a new chat session.*

## 🎯 Current Project State: "Summaries to Evidence"
The platform is transitioning the `/recognition` activity feed from a generic "social media style" feed to a **verifiable scholarly ledger**. The core principle is that recognition (Endorsements, Scholar Stars) must be explicitly linked to the exact text changes (revisions) that earned them, proving intellectual accountability.

## ✅ Recently Completed Work (Successfully Built & Verified)
We just completed a major overhaul of the Recognition Feed cards to make them "evidence-first." 

1. **Database Migration (`evidence_feed_migration.sql`)**
   - Added `category` column to the `scholar_stars` table for structured storage.
   - Recreated `recognition_feed_view` to expose `source_revision_id` and `source_commit_message` for all recognition events, enabling deep-linking to the exact diff.
   - **CRITICAL ACTION NEEDED:** This SQL migration has been written but the user **must run it manually in their Supabase SQL Editor** before the new UI features will populate with data.

2. **Frontend UI Upgrades (`EndorsementCard.tsx` & `ScholarStarCard.tsx`)**
   - **Bug Fix:** Fixed the `Endorse` button on `EndorsementCard` (was incorrectly passing the endorsement record ID instead of the revision ID to `toggleInsightful`).
   - **Auto-loading Diffs:** Cards now automatically fetch `getRevisionDiffContext` on mount.
   - **First-Class Evidence:** Cards render a compact, git-style inline diff (green additions, red deletions) directly in the card body. It is no longer hidden behind a click.
   - **Deep Linking:** Added explicit "View Full Diff →" links that navigate to `/topic/[slug]/compare?rev=[source_revision_id]`.
   - **Category Badges:** `ScholarStarCard` now displays a structured category badge (e.g., Doctrine, Citation) pulling from `SCHOLAR_STAR_CATEGORIES`.

## 🧠 Manager's Architectural Directions & Future Scope
The system's technical foundation (revision-level tracking) was heavily praised, but the manager highlighted several critical conceptual paths for the future:

1. **The "Contribution" Layer (Future PR Model):**
   - *Current State:* Endorsements attach to single atomic revisions.
   - *Future State:* Multiple small revisions need to be grouped into a single logical "Contribution" (similar to a GitHub Pull Request). 
   - *Directive:* Do not build this yet, but ensure the data model and UI remain flexible enough to support this grouping later. Revisions remain the backend source of truth; Contributions will be the frontend abstraction.
2. **Commit Message Discipline:**
   - Because the feed now prominently displays `commit_message` as evidence, vague messages ("Added detail") are dangerous. 
   - *Future Action:* Implement a structured, guided UI for edit summaries (What changed? Why? What concept improved?).
3. **Quality Tiers:**
   - Current Quality Assessment cards feel administrative (`c_class` → `b_class`).
   - *Future Action:* Evolve these into comprehensive "Scholarly review reports" with criteria, rationale, and confidence scores.
4. **Discussion Scope Ambiguity:**
   - The "Discuss" button on feed cards is conceptually ambiguous. It's unclear if the user is discussing the *Node*, the *Revision*, or the *Endorsement* itself. This needs resolution.

## 🚀 Immediate Next Steps for New Chat
1. **Database Sync:** Confirm that `evidence_feed_migration.sql` has been executed in the Supabase dashboard.
2. **Review Feedback:** Address the manager's remaining concerns, specifically deciding how to handle "Discussion scope ambiguity" or beginning the design for "Structured Commit Messages".

## Latest Completed Work: Scholarly Evidence Rendering

The manager's next critique has now been addressed in the recognition UI:

1. **Contribution Thesis Added**
   - Endorsement, Scholar Star, and aggregated endorsement cards now promote a central "Contribution thesis" sentence.
   - Weak source summaries such as "Added more detail" no longer dominate the card hierarchy.
   - If the source edit summary is useful, it becomes the thesis; if it is weak, the thesis is inferred from the actual added/removed revision evidence.

2. **Raw Diff Replaced as Primary Evidence Language**
   - The visible card evidence now renders semantically as:
     - "Added contribution"
     - "Removed wording"
   - The full technical diff remains available through the "Full diff" / "View full diff" link.

3. **Structured Edit Summary Capture**
   - The edit page now asks for:
     - Contribution Summary
     - Concept improved
     - Evidence or reasoning
   - `submitRevision` composes these fields into the stored `commit_message`, so the existing database schema still works.

4. **Weak Commit Summary Flag**
   - Recognition cards now show a small "Needs structured summary" flag when the original edit summary is too vague.

5. **Cognitive Density Reduced**
   - Badges and reputation metadata are now supporting information.
   - The main eye path is: actor -> contribution thesis -> semantic evidence -> metadata/actions.

6. **Verification**
   - `npm run build` passes.
   - Scoped lint passes for the edited recognition files and the edited topic revision form/action files.
   - Full-project lint still fails because of pre-existing unrelated errors across other app files.

## Latest Completed Work: Contribution Intelligence

The manager's AI extraction direction has now been implemented as a second semantic extraction layer:

1. **Revision-Level AI Extraction**
   - Added `src/utils/ai/extract-revision-semantics.ts`.
   - It compares previous content, current content, and a compact diff.
   - It extracts:
     - contribution thesis
     - contribution type
     - contribution scope
     - scholarly significance
     - claims added
     - concepts introduced
     - evidence quality
     - concise reasoning
   - AI is descriptive only; it does not assign reputation, authority, or quality verdicts.

2. **Edit Submit Pipeline**
   - `src/app/topic/[slug]/edit/actions.ts` now triggers both:
     - node metadata extraction
     - revision semantic extraction
   - Both run fire-and-forget after revision insert.

3. **Database Migration**
   - Added `contribution_intelligence_migration.sql`.
   - Creates `revision_semantics`.
   - Rebuilds `recognition_feed_view` to expose semantic fields to the recognition UI.
   - Must be run manually in Supabase SQL Editor before AI semantics appear in production UI.

4. **Recognition UI Consumption**
   - Endorsement, Scholar Star, and aggregated endorsement cards now prefer AI-extracted thesis and semantic metadata when present.
   - Cards show AI-extracted labels, contribution type, scope, significance, evidence quality, claims added, and concepts introduced when available.
   - Existing diff/commit-summary fallback still works if the migration has not run or extraction has not completed.

5. **Surrounding System Upgrades**
   - Sidebar "Community Pulse" became "Scholarly Ledger" with semantic contribution counts and top contribution types.
   - Quality vote/assessment cards now render as lightweight "Scholarly review report" objects instead of flat admin text.

6. **Verification**
   - `npm run build` passes.
   - Scoped lint passes for edited files including the new revision semantics extractor.
