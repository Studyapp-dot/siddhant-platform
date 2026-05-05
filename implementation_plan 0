# Institutional Movement — Navigation & Continuity Architecture

The manager diagnosed the core problem precisely: **Siddhant has solved institutional identity but not institutional movement.** Pages behave as destinations, not transitions. This plan implements the 6 priorities in order of urgency.

---

## Proposed Changes

### Priority 1 — CRITICAL: Mobile Navigation

> [!CAUTION]
> India is mobile-heavy. Law students browse on phones. The entire platform is currently **inaccessible on mobile** — navbar links are `display: none` below 1024px with no alternative.

**Approach**: Bottom navigation bar — calm, institutional, always reachable. No hamburger menus or complex drawers. Exactly 5 taps: Archive, Communities, Chronicle, Recognition, Scholar's Desk.

#### [MODIFY] [Navbar.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/Navbar.tsx)
- Add a `<nav className="mobile-bottom-nav">` below the main navbar
- Contains 5 icon+label buttons for the core scholarly surfaces
- Only visible at `max-width: 1024px` (exactly where desktop nav disappears)
- Uses subtle icons (§ 🏛 📋 ⭐ 📜) with compact labels underneath

#### [MODIFY] [Navbar.css](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/components/Navbar.css)
- Add `.mobile-bottom-nav` styles: fixed bottom, glass background, 56px height
- Active state with gold underline matching desktop convention
- `padding-bottom: env(safe-area-inset-bottom)` for iPhone notch safety
- Hide on desktop (`display: none` above 1024px)
- Add `body` bottom padding on mobile so content isn't hidden behind the bar

---

### Priority 2 — VERY HIGH: Compare → Scholarly Continuation

> [!IMPORTANT]
> Compare is Siddhant's most philosophically important page — it visualizes **legal meaning changing through time**. Yet after viewing a diff, users have nowhere meaningful to go.

**Approach**: Add a "Continue Exploring" section after the diff viewer. Restrained — 4-5 contextual links, not a sidebar overload.

#### [MODIFY] [compare/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/compare/page.tsx)
- Add a `"Continue Exploring"` section after the `<DiffViewer />` component
- Links generated from actual context:
  - **"Discuss this interpretive shift"** → `/topic/{slug}/discussion`
  - **"View doctrinal relationships"** → `/topic/{slug}/edges`
  - **"See how this appears in the Chronicle"** → `/recent-changes`
  - **"Review the contributor's portfolio"** → `/profile/{author}`
  - **"Return to the current article"** → `/topic/{slug}`
- Also rename `Current Article` → `Current Topic` in existing nav bar
- Style: horizontal row of subtle card-links with icons, matching the archival calm aesthetic

#### [MODIFY] [compare.css](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/compare/compare.css)
- Add `.continue-exploring` section styles
- Subtle separator, restrained layout, hover transitions

---

### Priority 3 — VERY HIGH: First Exploration Experience (Post-Onboarding)

> [!WARNING]
> Onboarding teaches interpretive evolution and scholarly continuity. Then users land in **force-directed graph chaos**. This creates massive conceptual discontinuity.

**Approach**: Change the WelcomeFlow destination from `/nodes` (raw graph) to `/dashboard` (Scholar's Desk). The Scholar's Desk already has search, watchlist, curated links, and first-visit guidance — it's the natural first landing.

#### [MODIFY] [WelcomeFlow.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/welcome/WelcomeFlow.tsx)
- Change all 3 `router.push('/nodes')` calls → `router.push('/dashboard')`
- The Scholar's Desk first-visit guide already shows "Explore the Knowledge Archive", "Join a Scholarly Community", and "Create Your First Topic" — perfect guided exploration

---

### Priority 4 — HIGH: Edges → Broader Exploration Continuity

> [!NOTE]
> The edges/relationships page is a "cul-de-sac." Users establish doctrinal connections but have no pathways to continue exploring.

**Approach**: Add a contextual navigation footer below the existing edge form. Links back to the topic's other scholarly surfaces.

#### [MODIFY] [edges/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edges/page.tsx)
- Add a "Continue Exploring" section at the bottom of the page (after the form)
- Links:
  - **"View revision evolution"** → `/topic/{slug}/history`
  - **"Discuss this topic"** → `/topic/{slug}/discussion`
  - **"See in the Chronicle"** → `/recent-changes`
  - **"Return to topic"** → `/topic/{slug}`
- Use the same calm, restrained style as the Compare page continuity section

#### [MODIFY] [edges.css](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edges/edges.css)
- Add matching continuation section styles

---

### Priority 5 — HIGH: Communities Integration

> [!NOTE]
> Communities are socially isolated — they don't feel connected to jurisprudential exploration. The Domain Reports Tracker is a good start but needs more cross-pollination.

**Approach**: Add contextual cross-links to the ForumClient component. When a group has linked topics, surface paths to those topics' related scholarly surfaces (history, discussion, chronicle).

#### [MODIFY] [groups/[slug]/page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/groups/%5Bslug%5D/page.tsx)
- Change "Subject Workspace" badge → "Scholarly Community"
- Add "Explore Connected Topics" quick links in the sidebar below the member roster, linking to the community's associated topics' scholarly surfaces
- Add a "Scholarly Chronicle" link in the sidebar navigation

---

## What NOT To Do (Per Manager)
- ❌ No giant mobile redesign — just calm bottom nav
- ❌ No overwhelming "related everything" systems — restrained contextual links only
- ❌ No overcrowded top nav — Scholar's Desk stays in dropdown
- ❌ No complex drawer systems on mobile
- ❌ No new institutional prose — just navigation pathways

---

## Verification Plan

### Automated Tests
- `npx next build` — ensure all pages compile with zero errors

### Manual Verification
- Test mobile bottom nav at 375px, 768px, 1024px viewport widths
- Verify Compare page continuation links resolve correctly
- Confirm WelcomeFlow now sends users to Scholar's Desk
- Verify edges page has working continuation links
- Verify groups sidebar shows connected topics
