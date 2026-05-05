# PART 1 — Global Terminology Audit

## 1. Master Vocabulary Map

Every significant term currently used across the platform, organized by location.

### Navbar
| Term | Route | Context |
|------|-------|---------|
| Siddhant | `/` | Brand name / logo |
| Graph | `/nodes` | Primary nav link |
| Forums | `/groups` | Primary nav link (with pulse dot) |
| Activity | `/recent-changes` | Primary nav link |
| Recognition | `/recognition` | Primary nav link |
| Sign In | `/login` | Unauthenticated state |

### User Menu Dropdown
| Term | Route | Context |
|------|-------|---------|
| My Profile | `/profile/{username}` | User dropdown item |
| Dashboard | `/dashboard` | User dropdown item (📊 icon) |
| Sign Out | — | User dropdown action |

### Landing Page (`/`)
| Term | Context |
|------|---------|
| The Living Memory of Indian Law | Hero title |
| Private Beta · {n} nodes live | Status badge |
| Go to Dashboard | Authenticated CTA |
| Browse the Archive | Secondary CTA |
| Explore Jurisprudence | Unauthenticated CTA |
| Jurisprudential Exhibition | Section label |
| Interpretive Evolution | Diff label |
| Doctrinal Relationships | Cartography section |
| The Living Archive | Section label |
| Every Concept Is a Living Document | Section title |
| Knowledge Graph | Node reference term |
| Revised, debated, and verified | Archive subtitle |
| Scholarly Vitality | Vitality strip label |
| Latest recorded interpretation | Signal label |
| Doctrinal relationship established | Signal label |
| Under scholarly review | Signal label |
| Participatory Jurisprudence | Section label |
| Contribute to the Living Record | Section title |
| Document Jurisprudential Meaning | Pathway title |
| Review Interpretive Claims | Pathway title |
| Trace Doctrinal Lineage | Pathway title |
| Browse the Knowledge Graph | CTA |

### Landing Page Footer
| Term | Route |
|------|-------|
| Knowledge Graph | `/nodes` |
| Forums | `/groups` |
| Chronicle | `/recent-changes` |
| Recognition | `/recognition` |
| Sign In | `/login` |

### Dashboard (`/dashboard`)
| Term | Context |
|------|---------|
| Scholar Dashboard | Page title |
| Reputation Points | Stats card |
| Graph Contributions | Stats card |
| View Public Portfolio | Profile link |
| Endorsement(s) | Recognition summary |
| Scholar Star(s) | Recognition summary |
| Upvote(s) | Recognition summary |
| Awaiting Your Attention | Section label |
| Your Communities | Section label |
| Your Recent Contributions | Feed label |
| Global Knowledge Pulse | Feed label |
| Knowledge Watchlist | Section title |
| Quick Links | Section title |
| Recent Changes | Quick link |
| Recognition Feed | Quick link |
| Subject Groups | Quick link |
| + New Article | Button |
| Explore Graph → | Button |
| Intelligence Matches | Search results label |
| Pioneer the "{q}" Node | No-results CTA |
| Since you were away | Banner |
| Watchlist edits | Banner stat |
| The graph is quiet | Empty state |

### Nodes Page (`/nodes`)
| Term | Context |
|------|---------|
| Knowledge Index | Sidebar title |
| Search concepts... | Search placeholder |
| Filter chips: All, Statute, Chapter, Section, Const., Judgment, Doctrine, Concept, Topic | Filter bar |
| {n} of {n} concepts | Sidebar footer |
| Node Inspector | Inspector panel (implicit) |
| Network | Inspector stat label |
| related concepts | Inspector stat value |
| Last Updated | Inspector stat label |
| Open Full Analysis → | Inspector action |
| Propose Revision | Inspector action |
| Network Relations | Inspector section label |
| + New Concept | FAB button |
| Initializing graph… | Loading state |
| Connections will appear as relationships are mapped | Empty relations |
| No matching concepts | Empty search state |

### Graph Visualizer Labels
| Term | Context |
|------|---------|
| CONST., STATUTE, JUDGMENT, CHAPTER, DOCTRINE, SECTION, CONCEPT, TOPIC | Node type badges |
| PART OF, GROUPED, REPLACES, AMENDS, REPEALS, SUBORDINATE, OVERRIDES | Edge labels |
| FOLLOWED, APPLIED, APPROVED, EXPLAINED, REFERRED, DISTINGUISHED | Edge labels |
| DOUBTED, NOT FOLLOWED, OVERRULED | Edge labels |
| INTERPRETS, ESTABLISHES, CODIFIES, PREREQUISITE, DISTINGUISH, RELATED | Edge labels |
| EXCEPTION, GOVERNED BY, ANALOGOUS | Edge labels |

### Topic Page (`/topic/{slug}`)
| Term | Context |
|------|---------|
| Graph Home | Sidebar nav |
| Navigation | Sidebar section title |
| Tools | Sidebar section title |
| Discussion | Sidebar tool link |
| Forums | Sidebar tool link |
| Doctrinal Relationships | Sidebar tool link (auth-only) |
| Quality History | Sidebar section title |
| Quick Reference | Context panel section |
| AI-Derived | Source pill |
| Improve this page | Edit button |
| Cite Node | Cite button |
| Open Discussion | Context panel CTA |
| {n} revisions | Wiki signal |
| {n} contributors | Wiki signal |
| Open for improvement | Wiki signal |
| Revision, Revisions | Sidebar stats |
| Contributor, Contributors | Sidebar stats |
| Published {date} · Written by @{user} | Meta line |
| Community-reviewed, open for improvement | Quality context |
| Section Templates: Facts, Issues, Arguments, Judgment, Reasoning, Ratio Decidendi, Obiter Dicta | (judgment type) |

### Topic Page — Quality System Terms
| Term | Context |
|------|---------|
| Stub | Quality tier |
| Start | Quality tier |
| C-Class | Quality tier |
| B-Class | Quality tier |
| Good Article | Quality tier |
| Featured | Quality tier |
| Reviewed at earlier version | Staleness indicator |
| Some votes from earlier version | Vote staleness |
| Vouched for | Vote card language |
| Promoted by | Assessment card language |
| Scholar Star | Star card language |

### Compare Page (`/topic/{slug}/compare`)
| Term | Context |
|------|---------|
| Revision Evolution | Page title suffix |
| Scholarly Change Summary | Section label |
| Contribution thesis | Semantic label |
| Governance Context | Strip label |
| Previous / New Revision | Commit card labels |
| ← Previous Revision / Next Revision → | Navigation |
| History | Nav link |
| Current Article | Nav link |

### History Page (`/topic/{slug}/history`)
| Term | Context |
|------|---------|
| Revision History | Page title |
| Intellectual evolution of "{title}" | Subtitle |
| Timeline | Sidebar section |
| Epochs | Sidebar section |
| Revisions, Contributors, Major, Period | Sidebar stat labels |
| Back to Article | Sidebar nav |
| Discussion | Sidebar nav |

### Edges Page (`/topic/{slug}/edges`)
| Term | Context |
|------|---------|
| Doctrinal Relationships | Page title |
| Subject Authority | Anchor label |
| Established Doctrinal Relationships | Section heading |
| Judicial Treatment | Family label |
| Legislative Lineage | Family label |
| Conceptual | Family label |
| Structural | Family label |
| Authorities Citing This Topic | Incoming section |
| Propose a Doctrinal Relationship | Composition panel title |
| Related Legal Authority | Form label |
| Classify Doctrinal Relationship | Form label |
| Scholarly Interpretation | Form label |
| ← Back to Scholar View | Navigation |
| Remove Relationship | Action |
| Proposed by @{user} | Attribution |

### Discussion Page (`/topic/{slug}/discussion`)
| Term | Context |
|------|---------|
| Legal Reasoning Board | Context label |
| Structured discourse for legal analysis and consensus building | Subtitle |
| Active Threads | Sidebar stat |
| Resolved | Sidebar stat |
| Total Posts | Sidebar stat |
| Questions, Interpretations, Improvements, Issues, General | Thread types |
| Article View | Sidebar nav |
| Revision History | Sidebar nav |
| Governance | Sidebar section |
| Account Required | Unauthenticated notice |

### Recent Changes / Chronicle (`/recent-changes`)
| Term | Context |
|------|---------|
| Scholarly Chronicle | Page title |
| Filter Chronicle | Sidebar section |
| All Activity, Revisions, Discussions, Inline Tags, Peer Reviews, Flagged Activity, Recognition | Filter options |
| Major Developments | Mode toggle |
| Today, Yesterday, This Week, Earlier | Epoch labels |
| ✦ High Significance | Significance badge |
| Major Revision | Significance badge |
| Data Sync Interrupted | Error state |
| Navigation: Dashboard, Knowledge Graph, Community Groups | Sidebar nav |

### Recognition Page (`/recognition`)
| Term | Context |
|------|---------|
| Community Recognition | Page title |
| Your Status | Sidebar section |
| Recognition Feed | Sidebar section |
| All Activity, Endorsements, Scholar Stars, Latest Edits, Quality Assessments, Community | Filter options |
| Top This Week | Sidebar section |
| Scholarly Ledger | Sidebar section |
| Scholar Stars Awarded, Active Contributors, Semantic Contributions, Substantial / Foundational | Ledger stats |
| Featured, Community Endorsements, Recognized Contributions, Recent Activity | Feed section headers |
| Recent Changes, Dashboard, Knowledge Graph | Sidebar nav |

### Welcome / Onboarding (`/welcome`)
| Term | Context |
|------|---------|
| Welcome to Siddhant | Layer 1 title |
| Enter the Living Archive | Layer 1 CTA |
| How Legal Meaning Evolves | Layer 2 section label |
| Interpretive Evolution | Diff label |
| Doctrinal Relationships | Cartography label |
| Scholarly Participation | Culture label |
| Revise Interpretations | Action title |
| Review Doctrinal Claims | Action title |
| Map Jurisprudential Lineage | Action title |
| Enter Siddhant | Layer 2 skip |
| Scholarly Identity | Layer 3 label |
| How would you like to participate in Siddhant? | Layer 3 title |
| Law Student, Advocate, Academic/Professor, Researcher, Public Contributor | Roles |
| Your Institution | Field label |
| Areas of Interest | Field label |
| Continue to the Archive → | Layer 3 skip |

### Auth / Login (`/login`)
| Term | Context |
|------|---------|
| Sign In / Join Siddhant | Tab labels |
| Welcome to Siddhant | Login title |
| Join the Scholarly Record | Signup title |
| Continue with Google | Primary auth |
| Sign in with email / Sign up with email | Secondary auth |
| Institutional or Personal Email | Email field label |
| Choose a Scholar Handle | Username field label |
| Security Password | Password field label |
| Create Scholar Profile | Signup submit |
| Community Guidelines / Data Privacy Policy | Footer links |

### Groups (`/groups`)
| Term | Context |
|------|---------|
| Subject Groups | Page badge |
| Scholarly Communities | Page title |
| Domain-specific spaces | Subtitle phrase |

### Mobile Navigation
| Term | Context |
|------|---------|
| § (logo icon only) | Logo text hidden on mobile |
| All nav links hidden | `display: none` below 1024px |
| No hamburger menu exists | **Critical gap** |

---

## 2. Terminology Collision Audit

### Concept: "The Central Page for Nodes"
```
Used as:
- Graph (navbar)
- Knowledge Graph (footer, dashboard, recognition sidebar, chronicle sidebar)
- Knowledge Index (nodes sidebar)
- Browse the Archive (landing CTA)
- Explore Graph (dashboard button)

Appears in:
- navbar → "Graph"
- landing footer → "Knowledge Graph"
- dashboard → "Explore Graph →"
- dashboard quick links → (not linked as "Graph")
- recognition sidebar → "Knowledge Graph"
- chronicle sidebar → "Knowledge Graph"

Conflict: The same page (/nodes) is called "Graph", "Knowledge Graph",
"Knowledge Index", and "the Archive" depending on context.
This is the single biggest terminology collision on the platform.
```

### Concept: "The Activity Feed Page"
```
Used as:
- Activity (navbar)
- Recent Changes (dashboard quick link)
- Chronicle (landing footer)
- Scholarly Chronicle (page title)
- Recent Changes (page URL: /recent-changes)

Appears in:
- navbar → "Activity"
- footer → "Chronicle"
- dashboard → "Recent Changes"
- page itself → "Scholarly Chronicle"
- recognition sidebar → "Recent Changes"

Conflict: Four different names for the same page.
"Activity" sounds like a social feed.
"Chronicle" sounds scholarly/institutional.
"Recent Changes" sounds wiki/operational.
"Scholarly Chronicle" is the page's own self-identity.
```

### Concept: "Subject Groups / Forums"
```
Used as:
- Forums (navbar, landing footer)
- Subject Groups (groups page badge, dashboard quick link)
- Scholarly Communities (groups page title)
- Community Groups (chronicle sidebar)
- Your Communities (dashboard sidebar)
- 🏛 Forums (topic sidebar)

Appears in:
- navbar → "Forums"
- footer → "Forums"
- dashboard → "Subject Groups"
- groups page → "Subject Groups" badge + "Scholarly Communities" heading
- topic sidebar → "Forums"
- chronicle sidebar → "Community Groups"

Conflict: "Forums" implies casual discussion.
"Subject Groups" implies structured academic organization.
"Scholarly Communities" implies collegial academic clusters.
These are philosophically different framings of the same feature.
```

### Concept: "Edges / Connections"
```
Used as:
- Doctrinal Relationships (edges page title, landing page, onboarding, topic sidebar)
- Network Relations (nodes inspector panel)
- Cross-references (topic page component name)
- Edges (URL path: /edges, code variable names)
- related concepts (inspector stats)
- Connections will appear... (inspector empty state)

Appears in:
- topic sidebar → "Doctrinal Relationships"
- edges page → "Doctrinal Relationships"
- nodes inspector → "Network Relations"
- code/URL → "edges"
- landing cartography → "Doctrinal Relationships"

Conflict: "Network Relations" in the inspector feels technical.
"Doctrinal Relationships" feels scholarly.
The URL uses "edges" (pure engineering term).
"Cross-references" is a different conceptual frame.
```

### Concept: "Articles / Topics / Nodes / Concepts"
```
Used as:
- Article (topic sidebar: "Back to Article", "Article View")
- Topic (URL: /topic/{slug}, page headers)
- Node (code, database, graph terminology)
- Concept (nodes sidebar: "New Concept", "Search concepts...", filter chips)
- Article (dashboard: "+ New Article")
- Pioneer the Node (dashboard search empty state)

Appears in:
- dashboard → "New Article"
- nodes page → "New Concept"
- topic page → references "article" and "page"
- history → "Back to Article"
- URL → /topic/
- database → "nodes" table

Conflict: "Article" suggests a wiki-like authored piece.
"Topic" suggests a subject area.
"Node" suggests a graph element.
"Concept" suggests an idea.
These are four different mental models for the same entity.
```

### Concept: "User Identity"
```
Used as:
- Scholar (dashboard: "Scholar Dashboard")
- Contributor (role system)
- User (code, generic fallback)
- Scholar Handle (signup form)
- @username (everywhere)

Hierarchy labels:
- Reader → Contributor → Recognized Contributor → Senior Scholar → Steward → Governance Council

Conflict: Landing page and onboarding treat everyone as "scholars,"
but the role system assigns "Reader" and "Contributor" as default.
A "Reader" being called a "Scholar" is aspirational but potentially confusing.
```

### Concept: "Dashboard"
```
Used as:
- Dashboard (user menu, quick links, sidebar navs)
- Scholar Dashboard (page title)
- My scholarly command center (first visit text)

Conflict: "Dashboard" is pure SaaS/product language.
"Scholar Dashboard" attempts a hybrid.
No scholarly institution calls anything a "Dashboard."
```

---

## 3. Engineering Language Audit

### Currently Exposed Engineering Terms

| Term | Location | User-Facing? | Suggested Scholarly Alternative |
|------|----------|-------------|-------------------------------|
| `Graph` | Navbar | ✅ Yes | "Archive" or "Knowledge Archive" |
| `node` | Dashboard: "Pioneer the Node" | ✅ Yes | "article" or "entry" |
| `edge` | URL path `/edges` | ✅ Yes (URL) | `/relationships` or `/connections` |
| `diff` | Recognition: "View Diff →" | ✅ Yes | "View Changes" or "Compare Revisions" |
| `metadata` | Topic sidebar: "Extracting metadata..." | ✅ Yes | "Extracting reference data..." |
| `AI-Derived` | Topic context panel | ✅ Yes | "Machine-extracted" or "Auto-derived from source" |
| `Dashboard` | User menu, multiple sidebars | ✅ Yes | "Scholarly Workspace" or "Your Desk" |
| `Activity Feed` | Dashboard section | ✅ Yes | "Knowledge Pulse" (already partially used) |
| `activity_type` | Code, leaks into filter labels | Partially | Use semantic names only |
| `Inline Tags` | Chronicle filter | ✅ Yes | "Editorial Annotations" |
| `Peer Reviews` | Chronicle filter | ✅ Yes | Acceptable (scholarly) |
| `Signal` | Edge data, some tooltips | Partially | "Judicial treatment signal" |
| `Delta` | Dashboard: "delta-badge" | ✅ CSS class only | — |
| `CRUD-like: Remove Relationship` | Edges page button | ✅ Yes | "Withdraw Proposal" |
| `Manage` | Not found in UI | ❌ | — (not present) |
| `Delete` | Not found in UI | ❌ | — (not present) |
| `Data Sync Interrupted` | Chronicle error state | ✅ Yes | "Unable to load the chronicle at this time." |
| `Filter` | Multiple filter sidebars | Partially | Acceptable in context |
| `Omnibar` | Dashboard search CSS class | ❌ Code only | — |
| `FAB` | Nodes page CSS class | ❌ Code only | — |
| `glass-panel` | CSS class everywhere | ❌ Code only | — |

### Summary of Critical Exposures

> [!WARNING]
> **6 user-facing engineering terms require immediate scholarly replacement:**
> 1. **"Graph"** in navbar → Users see "Graph" with no context of what it means
> 2. **"View Diff"** in recognition page → Pure git/engineering terminology
> 3. **"Pioneer the Node"** in dashboard → "Node" is not user language
> 4. **"Extracting metadata"** in topic sidebar → Technical process description
> 5. **"Data Sync Interrupted"** in chronicle → Infrastructure language
> 6. **"Inline Tags"** in chronicle filter → Users don't think in "inline tags"

> [!NOTE]
> **The URL structure `/topic/{slug}/edges` exposes engineering terminology directly in the browser address bar.** While not a UI text issue, users sharing links will send URLs containing "edges" — a term that means nothing to legal scholars.
