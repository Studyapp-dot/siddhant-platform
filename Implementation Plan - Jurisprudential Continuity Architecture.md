# Implementation Plan - Jurisprudential Continuity Architecture

## Executive Summary

The audit's main correction is accepted: Siddhant no longer has a primary entry problem after the `/explore` redesign. The immediate architectural priority is now jurisprudential continuity after entry.

This implementation phase will focus on the principle:

> No scholarly cul-de-sacs.

Every interpretive surface should offer one disciplined next scholarly movement into revision, discussion, relationship, chronology, recognition, or the current authority. This is not a recommendations project, a search project, or an engagement-feed project. The tone should remain institutional, editorial, finite, and quiet.

## Product Principle

Siddhant should guide users through jurisprudential pathways:

```text
Interpretation
-> Revision
-> Relationship
-> Debate
-> Recognition
-> Further interpretation
```

The implementation will avoid language such as "recommended for you", "you may also like", "trending", or generic discovery prompts. Preferred language is editorial and scholarly:

```text
This interpretive change may be examined through...
This relationship later connects to...
This discussion can continue through the revision record...
```

## Scope

### In Scope

1. Compare -> Discussion continuity
2. Discussion -> Revision continuity
3. Relationship -> Interpretation continuity
4. Topic -> Related jurisprudential movement
5. History -> Debate / Relationship / Chronicle continuity
6. Lightweight graph cartography link without making graph the primary experience
7. Walkthrough document after implementation

### Out of Scope

1. AI recommendations
2. Semantic search
3. Trending feeds
4. Algorithmic personalization
5. Making Dashboard the primary entry surface
6. Removing graph identity

## Implementation Phases

### Phase 1 - Shared Continuity Language

Create a restrained scholarly continuation pattern for interpretive surfaces. The pattern should present:

- a short editorial heading,
- a contextual explanatory sentence that explains why the next movement matters,
- one primary next scholarly movement,
- links that use `next/link` for fast app navigation.

This keeps continuity architecture consistent across the app without creating a recommendation system or broad branching UI.

### Phase 2 - Compare -> Discussion Continuity

The compare page should end with a clear scholarly continuation panel whose primary movement is:

- Discuss this interpretive change

Priority wording:

> This revision changes how the authority is read. Continue into the scholarly debate around its meaning and consequences.

This directly addresses the highest priority item from the manager reply.

### Phase 3 - Discussion -> Revision Continuity

The discussion page should expose a continuation panel near the discourse area whose primary movement is:

- Continue through the revision record

It should frame discussion as part of the revision process:

> Threads should not stand apart from the record. Move from argument to the revision or relationship it concerns.

### Phase 4 - Relationship -> Interpretation Continuity

The relationships page should shift from "edge management" alone toward scholarly cartography:

- Each relationship card should clearly link to the target authority.
- The page should offer one contextual next movement into the most relevant connected authority when one exists.
- The wider graph should be framed as cartography, not as primary entry.

The graph remains important, but as a cartographic layer.

### Phase 5 - Topic -> Related Jurisprudential Movement

The topic page's doctrinal connections should not read like a raw list. It should introduce relationships as movement:

> This doctrine continues through the following authorities and interpretive claims.

Each connection should preserve the editorial explanation, relationship type, and target authority.

### Phase 6 - History -> Continuity

The history page should stop acting as a terminal ledger by adding one temporal continuation:

- Compare the latest interpretive movement when enough revisions exist.
- Otherwise, continue into discussion about the authority.

This turns revision history into a living timeline of jurisprudential movement.

### Phase 7 - Verification

Run:

```bash
npm run build
```

Fix any type or build failures. If a local dev server is needed for visual QA, run it after implementation and provide the local URL.

## Acceptance Criteria

1. `/topic/[slug]/compare` no longer terminates after the diff.
2. `/topic/[slug]/discussion` provides direct movement into the revision record.
3. `/topic/[slug]/history` reads as temporal jurisprudence and gives one next movement into comparison or discussion.
4. `/topic/[slug]/edges` reads as scholarly cartography, not only edge administration.
5. Topic pages surface doctrinal relationships as interpretive continuation.
6. No copy uses engagement-platform language.
7. No dashboard-first or graph-first entry regression is introduced.
8. Build passes.
9. A walkthrough is created after implementation.
10. Each continuity surface remains editorial, jurisprudential, finite, and contextual.

## Manager-Facing Summary

This phase implements the audit correction by shifting Siddhant from isolated knowledge surfaces to jurisprudential movement. The goal is not broader discovery or recommendations. The goal is continuity: after a scholar reads a change, debate, relationship, or history, Siddhant should offer the next disciplined interpretive step.
