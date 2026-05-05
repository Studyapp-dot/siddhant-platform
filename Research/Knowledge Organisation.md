

Content Architecture for Your Legal Education
Platform: Solving Overlap and Compression
## Problems
## The Fundamental Problem
Your challenge—compression of large topics into superficial reports versus fragmentation into numerous overlapping
small reports—is a classic content organization dilemma. It stems from trying to force legal knowledge into a single
granularity level. The solution is not to choose one approach, but to embrace multi-granularity content architecture
combined with cross-referencing over duplication and topic clustering over isolated articles.
## Core Principles
Based on research into Wikipedia,[^1^] legal encyclopedias,[^2^] and modular learning design,[^3^] the optimal system
rests on three pillars:
- Each article covers ONE complete, self-contained concept (natural breakpoints based on concept
boundaries, not word counts)
- Same topic exists at multiple depths (introductory, intermediate, advanced versions)
- Redundancy eliminated through cross-references, not duplicate content
Proposed Architecture: The "Legal Knowledge Graph with Topic
## Clusters"
- Hierarchical Taxonomy (The Tree Structure)
Create a clear, breadcrumb-style hierarchy inspired by both Wikipedia's category system[^4^] and the Library of
Congress Classification for law:[^5^]
Level 1: Major Legal Domains (Pillar Topics)
## ● Constitutional Law
## ● Criminal Law
● Civil Law (Torts, Contracts, Property)
● Procedural Law (CPC, CrPC, Evidence)
## ● Administrative Law
## ● Commercial Law
## ● Personal Laws
● Emerging Areas (Cyber Law, Environmental Law)
Level 2: Sub-Domains (Under each Pillar) Under Constitutional Law:
## ● Fundamental Rights
## ● Directive Principles
● Separation of Powers
## ● Emergency Provisions
## ● Federal Structure
Level 3: Specific Doctrines/Concepts Under Fundamental Rights → Right to Equality:
● Article 14 (Equality before law)
● Article 15 (Prohibition of discrimination)
● Article 16 (Equality of opportunity)
● Permissible classifications
● Negative vs positive rights
Level 4: Specific Applications/Case Law Under Article 14 → Permissible Classifications:
● Intelligible differentia

● Rational nexus test
● Landmark cases (E.P. Royappa, Ajay Hasia, etc.)
## Level 5: Bare Act Text + Commentary
● Actual Article 14 text
● Official explanations
● Comparative analysis with other jurisdictions
This creates a deep but navigable structure. Big topics get appropriate depth through multiple levels; small topics don't
get fragmented because they stop at the appropriate level.
- Topic Clusters with Cross-References
For overlapping areas (e.g., " tort " overlaps with "consumer protection", "contract" overlaps with "specific relief"), use
the Wikipedia model:
Create anchor/pillar pages at Level 2 that intentionally serve as cross-reference hubs. Example:
Pillar Page: "Tort Law in India"
● Brief overview of tort principles
● NOT comprehensive coverage
## ● Sections:
- "Core Tort Principles" → links to Level 3 pages for negligence, trespass, defamation
- "Statutory Overlaps" → links to Consumer Protection Act page
- "Connection to Contract Law" → link to Contract Law pillar
- "Remedies" → link to Specific Relief Act page
- "Key Cases" → individual case pages
The pillar page is short (800-1200 words), designed to orient students and connect them to the specific depth they
need. It does not attempt to exhaustively cover any single doctrine—that's what the Level 3+ pages do.
This solves the compression problem: Pillar pages don't get overloaded. It solves the fragmentation problem:
Students don't need 20 tiny articles; they get 3-5 well-connected ones.
- Multi-Granularity Content: Same Concept, Multiple Versions
This addresses the critical insight from research:[^6^] students need different levels of depth for the same topic.
Implement three depth tiers for major concepts:
Tier 1: Quick Reference (200-400 words)
● For revision, exam recall
● Plain language summary
● Always present on the main article page (first section)
● Also exists as standalone "cheat sheet" pages
Tier 2: Standard Study (1500-2500 words)
● Your "default" article
● Comprehensive but not exhaustive
● Includes: definition, elements, exceptions, landmark cases, critique
● This is what 80% of students need for 80% of topics
Tier 3: Deep Dive (5000+ words)
● For complex topics (Article 14, Section 304B, etc.)
● Historical evolution
● Comparative jurisprudence
● Academic debates
● Extensive case analysis
Implementation: Don't create separate pages for tiers. Instead, use collapsible sections on a single page:
## Quick Summary [Always visible]
<Brief 200-word overview>

<button>Expand to Standard Study</button>
<div hidden>
## ## Detailed Explanation
## ## Elements
## ## Case Law
## ...
## </div>


<button>Expand to Deep Dive</button>
<div hidden>
## ## Historical Context
## ## Comparative Analysis
## ## Academic Debates
## ...
## </div>

This eliminates overlap entirely: There's only one article per concept. Students choose their depth via UI interaction,
not by finding different pages. Search engines index the full content, but UI shows only the requested depth.
## 4. Addressing Overlapping Legal Areas
Some topics legitimately overlap (e.g., "Negligence" appears in Tort Law, Criminal Law (culpable homicide), Medical
Law, Consumer Protection). Here's the resolution system:
## Option A: Choose Primary Domain, Link Extensively
● Article placed under primary category (Negligence → Tort Law)
● Throughout the article, include boxes/sections:
○ "Also relevant in:" Criminal Law (IPC sections), Medical Law (consumer cases), etc.
○ "Cross-reference:" Distinguish from " rash negligence " in criminal context
● Each cross-reference links to the corresponding article's relevant section, not just the homepage
Option B: Disambiguation Pages (Wikipedia approach[^7^]) When topic name is genuinely ambiguous:
● Create a disambiguation page: "Negligence (disambiguation)"
## ● Lists:
○ Negligence (tort) → tort law article
○ Criminal negligence → criminal law article
○ Medical negligence → medical law article
● No content on disambiguation page—just navigation
Rule: Never duplicate content. If 100 words about "duty of care" apply equally to tort and medical negligence, write it
once in the tort article and link to that section from medical negligence article with attribution: "For the foundational
principles of duty of care, see Negligence (tort) § Duty of Care."
- Content Chunking Strategy: The "One Concept Per Article" Rule
Every article must answer: "What is the single, clear concept this article explains completely?"
Bad (overly broad): "Contract Law"
● Attempts to cover offer, acceptance, consideration, capacity, breach, remedies, specific contracts—should be
separate articles
Good (properly chunked):
● "Contract: Offer and Invitation to Treat" (one concept)
● "Contract: Communication of Acceptance" (one concept)
● "Contract: Consideration and Its Exceptions" (one concept)
● "Contract: Capacity to Contract" (one concept)
These chunked articles link to each other:
● Bottom of "Offer" article: "Next: Acceptance →"
● Sidebar: Contract Law pillar page listing all chunked articles in learning sequence
## Benefits:
● No compression (each concept gets full treatment)
● No fragmentation (chunks are logically connected, not scattered)
● Students can consume at their pace: one chunk per session
● Modular development: Different students/editors work on different chunks
- The "Graph" Not "Book" Mindset
Stop thinking "textbook chapters" and start thinking "knowledge graph nodes." Each article is a node with:
Metadata tags:
## ●
primary_category: Constitutional Law
## ●
secondary_categories: ["Human Rights", "Emergency Law"]
## ●
prerequisites: ["Article 19 Basics"]
## ●
next: ["Article 21: Procedure Established by Law"]

## ●
difficulty: intermediate
## ●
bare_act_references: ["Constitution of India, Article 21"]
This metadata enables:
● Dynamic learning paths: "Show me all Article 21 concepts in order of difficulty"
● Automatic overlap detection: System flags when two articles cover >40% same content
● Personalization: "Students who read this also need X, Y, Z"
● Gap analysis: "No content exists linking Tort and Consumer Protection—suggest creating bridge article"
- Handling "Core" vs "Comprehensive" Balance
You asked whether reports should be exhaustive. Answer: No single article should be exhaustive. Instead:
Build "Complete Coverage" through the graph:
● A student studying "Contract Law" goes through 12 chunked articles sequentially
● That collection equals a textbook chapter—but each piece is independently useful
● Students can jump to exactly what they need without wading through irrelevant content
The illusion of exhaustiveness comes from:
- Comprehensive interlinking (no gaps)
- Multiple depth tiers on each page
- Optional "Complete Study Pack" views that compile related articles
- Structure for Indian Law: The "Bare Act + Doctrine" Model
Indian legal education is built on Bare Acts.[^8^] Your structure should mirror this:
For each major Bare Act (e.g., Indian Penal Code):
- Act Overview Pillar Page (1000 words):
○ History, structure, key definitions
○ Links to all chapters
- Chapter Pages (each chapter as separate article):
○ IPC Chapter II (General Explanations)
○ IPC Chapter IV (General Exceptions)
- Section Pages (one per section):
## ○ Section 299-304: Culpable Homicide
○ Section 304A: Causing death by negligence
○ Each section page includes:
■ Bare Act text (boxed, highlighted)
■ Simple explanation
## ■ Ingredients (elements)
■ Distinction from similar sections (e.g., 299 vs 300 vs 304)
■ Landmark cases (summarized, with links to full case pages)
■ "Also see" (connections to other sections/acts)
- Case Law Pages (separate from section pages):
○ Each landmark case gets its own page
## ○ Structured: Facts, Issue, Arguments, Reasoning, Ratio, Significance
○ Links to which sections it interprets
○ Backlinks from section pages
This prevents the compression problem: Section 302 doesn't get lost in a 1000-page IPC overview. It also prevents
fragmentation: Section 302 is a complete, standalone unit that also connects to the chapter and act.
## Implementation Roadmap
Phase 1: Build the Taxonomy
- Define 8-12 Pillar Topics (Level 1) based on Indian law curriculum[^9^]
- For each pillar, list 5-8 Level 2 Sub-Domains
- For Level 2, identify 10-20 Level 3 Concepts
- Create disambiguation pages for ambiguous terms
- Establish primary category rules: Every concept assigned one primary domain

Phase 2: Create the First Pillar (Pilot)
Choose one pillar (e.g., Criminal Law) and build it completely:
● 1 pillar page
● 8-10 Level 2 pages
● 30-50 Level 3+ articles
● Test for:
○ Overlap detection (are two articles covering same ground?)
○ Navigation ease (can student get from A to B in ≤3 clicks?)
○ Completeness (are there gaps? Use "what links here" to find orphaned concepts)
Phase 3: Implement Multi-Granularity
On all created articles:
- Add Quick Summary at top (collapsible)
- Tag with
difficulty
levels
- Create "learning path" sequences
- Test with students: Do they find their desired depth?
Phase 4: Cross-Reference System
- In every article:
○ "Prerequisites" section (links to required foundational concepts)
○ "Further Reading" (links to next concepts)
○ "Also relevant" (cross-domain overlaps)
○ "Distinguish from" (clarify similar concepts)
- Automated tools:
○ Script that finds articles linking to same Bare Act section
○ Flag when two articles share >30% tags
○ Suggest cross-reference opportunities
## Phase 5: Community Contribution Guidelines
Write clear editorial guidelines for your Wikipedia-style community:
- Before creating new article:
○ Search for existing content on your topic
○ Check if topic fits in existing article's scope
○ If overlap exists, edit existing article OR create disambiguation
- When adding content:
○ Always ask: "Is this ONE complete concept?"
○ If topic has sub-topics, make them separate articles
○ Use standard templates (see below)
- Cross-reference mandatory:
○ Every article must link to:
■ Its parent category (upward)
■ 2-3 related concepts (horizontal)
## ■ Prerequisites (downward)
○ No orphaned articles allowed
Phase 6: Templates and Standards
Create reusable templates (like Wikipedia's infoboxes)[^10^]:
## Standard Article Template:
# Title [Include Bare Act section if applicable]

{{Quick Summary}} [collapsible, 200 words]

{{Infobox}}
## | Concept | [tort/contract/constitutional/etc.]
## | Primary Category | [link]

## | Secondary Categories | [list]
## | Bare Acts | [links]
## | Difficulty | [beginner/intermediate/advanced]
## | Prerequisites | [links]
## | Next Topics | [links]

## ## Detailed Explanation
[Main content]

## Elements/Ingredients
[Bulleted list]

## ## Case Law
## ### Landmark Cases
- [Case name] (year): [1-sentence summary] [link to full case]
## ### Recent Developments

## Cross-References
- **Also relevant in**: [other domains]
- **Distinguish from**: [similar concepts]
- **See also**: [related articles]

## ## References
[Standard citation format]

## ---
**Community Discussion**: [link to talk page]
**Edit History**: [link]

## Disambiguation Template:
{{Disambiguation}}
The following articles discuss concepts with similar names:
- [[Negligence (tort)]] - in the law of torts
- [[Criminal negligence]] - in Indian Penal Code
- [[Medical negligence]] - in consumer protection and medical law

## Avoiding Common Pitfalls
Pitfall 1: "Comprehensive" Means "Everything in One Page"
Solution: Resist this. A truly comprehensive resource is a well-linked network of focused articles, not one massive
page. Students seeking overview use the pillar + quick summaries. Students seeking detail drill down into specific
concept pages.
Pitfall 2: Creating Duplicate Coverage for Different Audiences
Solution: Use depth tiers on the same page, not separate pages. A "for beginners" and "for advanced" version of the
same concept creates maintenance nightmares and merge conflicts.
## Pitfall 3: Unclear Boundaries Between Topics
Solution: Document scope rules. Example:
● "Article 21 covers: life, personal liberty. Excludes: right to property (now Article 300A). For property rights, see..."
● "Criminal negligence (IPC 304A) covers: death by rash/negligent act. Excludes: hurt (IPC 338), grievous hurt
(IPC 325). For lesser injuries, see..."
Pitfall 4: Students Getting Lost in the Graph
## Solution: Implement Learning Paths:
● "Complete guide to Contract Law" → curated sequence of 15 articles

● "One-week IPC revision" → 7 most important sections
● "Bar Exam Fast Track" → 50 essential concepts These are saved searches, not separate content. They pull
from existing articles.
## Technical Implementation Notes
Your platform's database schema should reflect this architecture:
Article table:
- id
- title
- primary_category_id (FK to Category)
- depth_tier_data (JSON: {tier1: summary, tier2: section_ids, tier3: section_ids})
- status (draft/review/published)

Article_Categories table (for secondary categories):
- article_id
- category_id

Cross_References table:
- source_article_id
- target_article_id
- relationship_type (prerequisite/see_also/distinguish/also_in)
- anchor_text

Learning_Paths table:
- id
- name
- description
- Articles_in_Sequence (ordered list of article_ids)

When displaying an article:
- Load article by ID
- Fetch its cross-references (outgoing links)
- Show "Backlinks" (which other articles link here)
- Show related articles in same category
- If user profile indicates student level, auto-expand appropriate depth tier
## Measuring Success
Track these metrics:
● Overlap Score: Average shared tags between linked articles (target: <20%)
● Navigation Depth: Average clicks to find content (target: ≤3)
● Coverage Gaps: Orphaned concepts (no inbound links) should trend to zero
● User Satisfaction: "Did you find what you needed?" → Should improve as system matures
## Summary: Your Exact Content Arrangement Rules
- Single-concept articles only: Each page covers exactly ONE complete legal concept
- Three-tier depth on same page: Quick summary (always visible) + Standard Study (default) + Deep Dive
(optional expand)
- Hierarchical placement: Every article has one primary parent category; may have multiple secondary
categories
- Cross-reference, don't duplicate: When same content applies to multiple articles, write it once and link to it
from others
- Pillar pages as orientation hubs: Top-level pages provide overview and navigation, NOT exhaustive content
- Disambiguation pages for name collisions: When same term means different things, create disambiguation,
not duplicated coverage

- Chunk large topics: Break "Contract Law" into 15+ focused articles (Offer, Acceptance, Consideration, etc.)
linked in sequence
- Bare Act structure: Act → Chapter → Section → Case Law. Each gets its own page(s)
- Mandatory relationship metadata: Every article must specify prerequisites and related concepts
- Community guidelines enforced: No new article without scope justification and cross-reference plan
This system eliminates your compression/fragmentation problem by decoupling topic from depth and replacing
duplication with linking. It scales infinitely because each new article fits into an existing network structure rather than
bloating existing pages. It's exactly what Wikipedia does for general knowledge—you're applying it to Indian legal
education.
