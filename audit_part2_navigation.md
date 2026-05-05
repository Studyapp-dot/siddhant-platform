# PART 2 — Navigation Architecture Audit

## 4. Global Navigation Structure

### Top Navbar (Desktop)
| # | Label | Route | Visibility | Icon |
|---|-------|-------|-----------|------|
| 1 | § Siddhant (logo) | `/` | Always | Gold § square |
| 2 | Graph | `/nodes` | Always | None |
| 3 | Forums | `/groups` | Always | Gold pulse dot |
| 4 | Activity | `/recent-changes` | Always | None |
| 5 | Recognition | `/recognition` | Always | None |
| 6 | 🔔 (Notification Bell) | — (dropdown) | Auth only | Bell SVG |
| 7 | User Avatar + Name | — (dropdown) | Auth only | Letter avatar |
| 8 | Sign In | `/login` | Unauth only | None |

### User Menu Dropdown
| Label | Route | Icon |
|-------|-------|------|
| My Profile | `/profile/{username}` | 👤 |
| Dashboard | `/dashboard` | 📊 |
| Sign Out | Server action | ⏻ |

### Landing Page Footer
| Label | Route |
|-------|-------|
| Knowledge Graph | `/nodes` |
| Forums | `/groups` |
| Chronicle | `/recent-changes` |
| Recognition | `/recognition` |
| Sign In | `/login` |

### Mobile Navigation (< 1024px)
| Element | Behavior |
|---------|----------|
| § Logo icon | Visible (text hidden on < 640px) |
| Nav links | **COMPLETELY HIDDEN** — `display: none` |
| Notification bell | Visible if authenticated |
| User menu | Visible |

> [!CAUTION]
> **There is NO mobile navigation menu.** No hamburger menu, no bottom nav, no drawer. On mobile, users can only access the homepage (via logo), their profile/dashboard (via user menu dropdown), and notifications. **All 4 primary nav links (Graph, Forums, Activity, Recognition) become completely inaccessible on mobile.**

### Page-Level Sidebars

#### Topic Page Sidebar
| Label | Route | Auth Required |
|-------|-------|:---:|
| Graph Home | `/` | ❌ |
| {Breadcrumb parents} | `/topic/{parent}` | ❌ |
| #{current slug} | — (current) | ❌ |
| 💬 Discussion | `/topic/{slug}/discussion` | ❌ |
| 🏛 Forums | `/groups` | ❌ |
| 📖 Doctrinal Relationships | `/topic/{slug}/edges` | ✅ |

#### Topic Page Context Panel (Right)
| Label | Route |
|-------|-------|
| Open Discussion | `/topic/{slug}/discussion` |

#### History Page Sidebar
| Label | Route |
|-------|-------|
| Back to Article | `/topic/{slug}` |
| Discussion | `/topic/{slug}/discussion` |

#### Discussion Page Sidebar
| Label | Route |
|-------|-------|
| ← Back to Article | `/topic/{slug}` |
| Article View | `/topic/{slug}` |
| Revision History | `/topic/{slug}/history` |

#### Chronicle Page Sidebar
| Label | Route |
|-------|-------|
| Dashboard | `/dashboard` |
| Knowledge Graph | `/nodes` |
| Community Groups | `/groups` |

#### Recognition Page Sidebar
| Label | Route |
|-------|-------|
| 🔥 Recent Changes | `/recent-changes` |
| 🏠 Dashboard | `/dashboard` |
| 🔗 Knowledge Graph | `/nodes` |

#### Edges Page
| Label | Route |
|-------|-------|
| ← Back to Scholar View | `/topic/{slug}` |

#### Compare Page
| Label | Route |
|-------|-------|
| ← Previous Revision | `/topic/{slug}/compare?rev={prevId}` |
| History | `/topic/{slug}/history` |
| Current Article | `/topic/{slug}` |
| Next Revision → | `/topic/{slug}/compare?rev={nextId}` |

---

## 5. Navigation Hierarchy Audit

### What Currently Appears Most Important (Left to Right)

```
Graph → Forums → Activity → Recognition
```

### Analysis of Current Hierarchy

| Position | Label | Nature |
|----------|-------|--------|
| 1st | Graph | **Exploratory** — Knowledge exploration |
| 2nd | Forums | **Social** — Community discussion |
| 3rd | Activity | **Operational** — Feed/changelog |
| 4th | Recognition | **Social** — Reputation/gamification |

### Classification

The hierarchy is **hybrid operational-social**, not scholarly.

- **Graph** is the only scholarly entry point, but it's labeled with engineering language
- **Forums** and **Recognition** are social/community features
- **Activity** is an operational changelog
- **Dashboard** (the most important *personal* page) is **hidden in the user dropdown** — it requires 2 clicks to access

### What's Missing from Top Navigation

| Missing Concept | Why It Matters |
|-----------------|---------------|
| Dashboard / Workspace | Personal scholarly workspace is buried |
| Chronicle / Recent Changes | Current "Activity" label undersells the scholarly chronicle |
| Create / Contribute | No persistent creation entry point in nav |
| Search | No global search bar — only exists within dashboard and nodes sidebar |

### Is the Hierarchy Scholarly?

**No.** The current hierarchy is:

```
Exploratory → Social → Operational → Social
```

A scholarly hierarchy would look more like:

```
Archive → Chronicle → Discourse → Recognition
```

Or entry-first:

```
Explore → Contribute → Review → Your Desk
```

---

## 6. Cross-Page Continuity Audit

### Page-by-Page Outgoing Navigation

#### Topic Page (`/topic/{slug}`)
| Outgoing Path | How Accessed | Scholarly? |
|---------------|-------------|:---:|
| → Edit page | "Improve this page" button | ✅ |
| → Discussion | Sidebar link + context panel CTA | ✅ |
| → History | Not directly linked from main content | ⚠️ |
| → Compare | Not linked from topic page | ❌ |
| → Edges | Sidebar link (auth only) | ✅ |
| → Forums | Sidebar link | Marginally |
| → Child nodes | Child node cards | ✅ |
| → Parent breadcrumb | Breadcrumb nav | ✅ |
| → Cross-references | CrossReferences component | ✅ |
| → Author profile | Meta line link | ✅ |

**Verdict:** Topic page is the **strongest hub** — it connects to most scholarly actions. But History and Compare are not prominently surfaced.

#### Compare Page (`/topic/{slug}/compare`)
| Outgoing Path | How Accessed |
|---------------|-------------|
| → Previous/Next Revision | Nav arrows |
| → History | Nav link |
| → Current Article | Nav link |
| → Author profiles | Commit card links |
| → Topic itself | Via "Current Article" |

**Missing from Compare:**
- ❌ No link to Discussion
- ❌ No link to Doctrinal Relationships
- ❌ No link to Recognition/Endorsement for this revision
- ❌ No "Review this change" action
- ❌ No "This revision matters because..." scholarly context

**Verdict:** Compare is a **scholarly dead-end after viewing the diff.** The only meaningful next action is "go back to history."

#### Chronicle / Recent Changes (`/recent-changes`)
| Outgoing Path | How Accessed |
|---------------|-------------|
| → Topic page | Entry title links |
| → Topic history | "History" action link |
| → Topic compare | "Compare →" action link |
| → Author profile | Author username link |
| → Dashboard | Sidebar nav |
| → Knowledge Graph | Sidebar nav |
| → Community Groups | Sidebar nav |

**Verdict:** Chronicle has **good outgoing links per-entry** (topic, history, compare, author). It is one of the better connected pages. But sidebar navigation only goes to operational hubs, not to scholarly exploration.

#### History Page (`/topic/{slug}/history`)
| Outgoing Path | How Accessed |
|---------------|-------------|
| → Back to Article | Sidebar link |
| → Discussion | Sidebar link |
| → Compare (selected revisions) | Client-side selection |
| → View State (historical revision) | Client-side action |
| → Author profiles | Username links in cards |

**Missing from History:**
- ❌ No link to Edges/Relationships
- ❌ No link to Recognition for specific revisions

**Verdict:** History connects well to Article and Compare but is **isolated from the broader scholarly ecosystem.**

#### Review / Contribution Review Drawer
| Outgoing Path | How Accessed |
|---------------|-------------|
| → Topic page | Triggered from topic page spotlight |
| → Compare/Diff | Inline within drawer |

**Verdict:** Review is **embedded in topic** — not a standalone page. This is good architecturally.

#### Doctrinal Relationships / Edges (`/topic/{slug}/edges`)
| Outgoing Path | How Accessed |
|---------------|-------------|
| → Back to Scholar View | Back link |
| → Target topic pages | Edge target links |
| → Source topic pages (incoming) | Incoming edge links |
| → Author profiles | Attribution links |

**Missing from Edges:**
- ❌ No link to Discussion
- ❌ No link to History
- ❌ No link to Compare
- ❌ No link to the Knowledge Graph (/nodes)
- ❌ No way to discover related but unconnected nodes

**Verdict:** Edges page is **a cul-de-sac.** Users can only go back or click through to specific connected topics. No broader scholarly exploration is suggested.

#### Recognition (`/recognition`)
| Outgoing Path | How Accessed |
|---------------|-------------|
| → Topic pages | Node links in feed cards |
| → Author profiles | Username links |
| → View Diff | Compare links in cards |
| → Recent Changes | Sidebar nav |
| → Dashboard | Sidebar nav |
| → Knowledge Graph | Sidebar nav |

**Missing:**
- ❌ No link to specific Discussion threads
- ❌ No link to Edges/Relationships
- ❌ No "explore similar contributions" path

**Verdict:** Recognition connects to topics and profiles but **does not encourage deeper scholarly exploration.**

#### Discussion (`/topic/{slug}/discussion`)
| Outgoing Path | How Accessed |
|---------------|-------------|
| → Back to Article | Sidebar link |
| → Article View | Sidebar link |
| → Revision History | Sidebar link |
| → Author profiles | Comment author links |

**Missing:**
- ❌ No link to Edges/Relationships
- ❌ No link to Compare (when discussing specific revisions)
- ❌ No link to related discussions on connected topics

**Verdict:** Discussion connects back to its parent article but is **isolated from the broader knowledge graph.**

#### Dashboard (`/dashboard`)
| Outgoing Path | How Accessed |
|---------------|-------------|
| → Topic pages | Watchlist, activity items, search results |
| → Author profile | "View Public Portfolio" |
| → New Article | "+ New Article" button |
| → Nodes/Graph | "Explore Graph →" button |
| → Recent Changes | Quick link |
| → Recognition | Quick link |
| → Subject Groups | Quick link |
| → User discussions | Opportunities section |

**Verdict:** Dashboard is the **second strongest hub** after the Topic page. It connects to most major features. But it's hidden behind 2 clicks in the user menu.

#### Groups (`/groups` and `/groups/{slug}`)
| Outgoing Path | How Accessed |
|---------------|-------------|
| → Individual group pages | Group cards |
| → (Within group: discussions) | Group discussion threads |

**Missing:**
- ❌ No link back to Knowledge Graph
- ❌ No link to Chronicle
- ❌ No link to Recognition
- ❌ No link to related Topics

**Verdict:** Groups is **almost completely isolated** from the rest of the scholarly ecosystem.

### Final Cross-Page Continuity Assessment

> [!IMPORTANT]
> ## Does Siddhant encourage jurisprudential traversal? Or isolated page usage?
>
> **The platform currently encourages isolated page usage.**
>
> The Topic page is the only true hub. Every other page functions as a **spoke** — you go there, do one thing, and go back. The spokes do not connect to each other:
>
> - Compare doesn't lead to Discussion
> - Discussion doesn't lead to Relationships
> - Relationships doesn't lead to History
> - Recognition doesn't lead to Exploration
> - Groups is completely isolated
>
> **The scholarly traversal path `Topic → Compare → History → Relationships → Discussion` is not naturally navigable.** Each transition requires returning to the Topic page first.

---

## 7. Dead-End Audit

### Dead-End #1: Compare Page
```
User opens Compare page
↓
Views the diff between two revisions
↓
No scholarly next action
↓
Can only go: "Previous Revision" / "Next Revision" / "History" / "Current Article"
↓
No: "Discuss this change" / "Endorse this revision" / "View relationships affected"
```

### Dead-End #2: Groups Discovery
```
User browses /groups directory
↓
No connection to Knowledge Graph topics
↓
No connection to Chronicle activity
↓
No connection to Recognition
↓
Groups exist in isolation from the scholarly archive
```

### Dead-End #3: Edges Page — Post-Composition
```
User proposes a new doctrinal relationship on /edges
↓
Success message displayed
↓
No suggestion: "Now document the interpretation in the article"
↓
No suggestion: "View this in the knowledge graph"
↓
No suggestion: "Discuss this relationship in the topic's reasoning board"
```

### Dead-End #4: Recognition Feed — After Browsing
```
User scrolls through Recognition feed
↓
Sees endorsements and scholar stars
↓
No pathway to: "Explore topics that need recognition"
↓
No pathway to: "Find underappreciated contributions"
↓
Only action: click into specific topic pages
```

### Dead-End #5: Profile Page — Visitor
```
User visits /profile/{username}
↓
Views contribution history
↓
No connection to: "Explore topics this scholar works on"
↓
No connection to: "See this scholar's doctrinal relationship work"
↓
Profile is a terminus
```

### Dead-End #6: Onboarding → /nodes
```
New user completes onboarding
↓
Redirected to /nodes (the Knowledge Graph)
↓
Sees force-directed graph visualization
↓
No guidance on: "Start by reading this article"
↓
No guidance on: "This is a good first contribution"
↓
Highest cognitive-load page on the platform as first destination
```

### Dead-End #7: Search (Dashboard) — No Results
```
User searches in dashboard omnibar
↓
No exact matches
↓
Only action: "Pioneer the Node"
↓
No suggestion: "Browse related concepts"
↓
No suggestion: "Try the Knowledge Graph"
↓
No semantic/fuzzy search fallback
```

### Dead-End #8: Mobile — Everywhere
```
User on mobile device
↓
Navbar links are completely hidden
↓
Can only access: Home, Profile, Dashboard (via user menu)
↓
Cannot access: Graph, Forums, Activity, Recognition
↓
ENTIRE scholarly platform is inaccessible on mobile
```
