# Walkthrough - Scholarly Traversal Architecture

## Manager Corrections Followed

This implementation treats the manager reply as the controlling strategy:

- It does not redirect onboarding to `/dashboard`.
- It does not leave onboarding pointed at `/nodes`.
- It creates a dedicated first exploration surface at `/explore`.
- It keeps continuity restrained to Compare and Relationships for now.
- It makes mobile navigation text-led and stable rather than symbol-heavy.
- It keeps communities as attached scholarly discourse rooms, not a central navigation spine.

## 1. First Exploration Surface

New route:

`/explore`

Purpose:

To bridge philosophical onboarding into guided jurisprudential exploration without graph overload or dashboard/productivity framing.

Structure:

- Featured Constitutional Path
- Recent Scholarly Development
- Suggested Exploration
- First Contribution Path

Implementation:

- The page attempts to feature an Article 21 node if present.
- It pulls one recent revision from the Scholarly Chronicle.
- It pulls one doctrinal relationship pathway, preferring Article 21 when possible.
- It offers contribution entry points without turning the surface into a workspace dashboard.

Files:

- `src/app/explore/page.tsx`
- `src/app/explore/explore.css`
- `src/app/welcome/WelcomeFlow.tsx`

Onboarding now sends all three entry paths to `/explore`.

## 2. Mobile Navigation

The mobile nav now appears exactly where desktop nav disappears: `max-width: 1024px`.

Labels:

- Archive
- Chronicle
- Communities
- Recognition
- Desk

Design approach:

- Textual clarity first.
- Small alphabetic institutional markers instead of ambiguous icon-only symbolism.
- Fixed bottom bar with safe-area padding.
- Active state uses the existing gold continuity language.

Files:

- `src/app/components/Navbar.tsx`
- `src/app/components/Navbar.css`
- `src/app/globals.css`

## 3. Compare Continuity

The Compare page no longer ends immediately after the diff.

Added section:

`Continue Tracing This Interpretation`

The section is interpretive rather than a generic related-links footer. It groups links as:

- This interpretive shift also appears in
- Related scholarly activity

Destinations:

- Doctrinal Relationships
- Scholarly Chronicle
- Topic Discussion
- Contributor interpretive history, when available

Files:

- `src/app/topic/[slug]/compare/page.tsx`
- `src/app/topic/[slug]/compare/compare.css`

## 4. Relationships Continuity

The Relationships page now closes with a restrained continuation section.

Added section:

`Explore Related Jurisprudence`

Destinations:

- Revision evolution
- Discussion
- Chronicle
- Return to authority

This keeps the relationships page from becoming a cul-de-sac while avoiding platform-wide recommendation saturation.

Files:

- `src/app/topic/[slug]/edges/page.tsx`
- `src/app/topic/[slug]/edges/edges.css`

## 5. Communities Integration

The Domain Reports Tracker now gives each linked report quiet scholarly context links:

- Revision history
- Relationships
- Topic discussion

This keeps communities attached to jurisprudence without making them the platform's navigation infrastructure.

File:

- `src/app/groups/[slug]/ForumClient.tsx`

## Verification

`npm run build` passed successfully with Next.js 16.2.1 and generated the new `/explore` route.

`npm run lint` is still blocked by pre-existing project-wide lint failures, mostly `no-explicit-any`, hook purity, unused variables, and unescaped entity issues across many older files. The build check confirms the implemented changes compile.
