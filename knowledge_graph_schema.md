# Knowledge Graph Schema for Indian Law — Revised

> [!IMPORTANT]
> This is a ground-up redesign. The previous version had structural problems: it modeled things that aren't knowledge units (benches, regulatory bodies, obiter dicta), it mixed up metadata with graph entities, and it proposed relationship types that don't reflect how Indian law actually works. This version is rebuilt from first principles.

---

## Part 1: What Does a Student Actually Navigate To?

Before defining entities, we need to ask: **what does a law student in India actually search for, click on, and study?** Not abstract categories — actual units of knowledge.

A law student would study:
- **"BNS Section 103 — Murder"** → a specific statutory provision with its bare act text, essentials/ingredients, explanations, illustrations, and key cases
- **"Kesavananda Bharati v. State of Kerala"** → a complete case analysis: facts, issues, arguments, ratio, significance
- **"Doctrine of Basic Structure"** → a principle that emerged from cases and governs constitutional interpretation
- **"Article 21 — Right to Life and Personal Liberty"** → a constitutional provision with its judicial evolution
- **"Bharatiya Nyaya Sanhita, 2023"** → an overview of an entire statute: its structure, purpose, history
- **"Culpable Homicide vs. Murder"** → a conceptual comparison (an extremely common study pattern in Indian law)
- **"Negligence under Tort Law"** → a doctrinal concept spanning multiple sources

A student would **NOT** study:
- "A bench" — that's metadata about a case, not a knowledge unit
- "An obiter dictum" — that's a part of a judgment, not a standalone entity
- "A dissenting opinion" — same; it lives inside the case, not as its own node
- "A regulatory body" — that's reference data
- "A limitation period" — that's metadata about a remedy
- "A jurisdiction rule" — that's a fact about a court

**The test for whether something is a node**: Would a student search for it? Would it have its own report page on Siddhant? Would the community write revisions for it?

---

## Part 2: Node Types (What Belongs in the Graph)

### 2.1 Statutory Provisions — The Backbone of Indian Legal Education

Indian law is overwhelmingly codified. Students study **Bare Acts section by section**. This is the single most important node type.

| Node Type | What It Represents | Example | Why It's a Node |
|-----------|-------------------|---------|-----------------|
| `statute` | An Act of Parliament or State Legislature | Bharatiya Nyaya Sanhita, 2023 | Students need an overview page: history, structure, key definitions, purpose |
| `section` | A single operative provision within a statute | BNS Section 103 (Murder) | This is the atomic unit of Indian legal study. Every section gets broken down into: bare act text, essentials/ingredients, explanations, illustrations, exceptions, case law |
| `constitutional_provision` | An Article, Schedule, or Part of the Constitution | Article 21, Seventh Schedule | The Constitution is special — it's both a statute and the supreme law. Articles are studied the same way as sections but with more doctrinal weight |

**Why not `chapter`, `sub-section`, `clause`, `proviso`, `explanation`, `illustration`?**

These are **structural components OF a section**, not independent knowledge units. A student doesn't study "Proviso to Section 103" as a standalone topic — they study Section 103 and the proviso is part of that study. These should be structured data *within* the section node, not separate nodes:

```
Section 103 (node) contains:
  ├── bare_act_text (the raw statutory text)
  ├── sub_sections[] (numbered sub-divisions)
  ├── provisos[] (conditions/exceptions within the section)
  ├── explanations[] (statutory clarifications)
  ├── illustrations[] (statutory examples)
  └── essentials[] (ingredients/elements extracted from the text)
```

> [!NOTE]
> **Exception**: If a proviso, explanation, or exception is so significant that it deserves its own community report (e.g., "General Exceptions under BNS Chapter IV" — Sections 14-33 which cover right of private defence, necessity, insanity, etc.), it should be promoted to a `section` or `concept` node. The platform should support this organically — if the community writes enough content about a sub-component, it can be "promoted" to its own node.

### 2.2 Judicial Decisions

| Node Type | What It Represents | Example | Why It's a Node |
|-----------|-------------------|---------|-----------------|
| `judgment` | A court decision | *Maneka Gandhi v. Union of India* (1978) | Students study cases as complete units: Facts → Issues → Arguments → Ratio → Obiter → Significance. The ratio, obiter, and dissents are **parts of this node**, not separate nodes. |

A judgment node carries rich metadata:

```
Judgment node contains:
  ├── citation (e.g., "AIR 1978 SC 597", "(1978) 1 SCC 248")
  ├── court ("Supreme Court of India", "Delhi High Court")
  ├── bench_type ("Constitution Bench", "Division Bench", "Single Judge")
  ├── bench_strength (e.g., 7)
  ├── judges[] (names of judges on the bench)
  ├── date_of_judgment
  ├── petitioner, respondent
  ├── case_status ("good_law", "overruled", "partially_overruled", "doubted")
  └── provisions_interpreted[] (which sections/articles this case interprets)
```

> [!WARNING]
> **The `case_status` field is critical.** In Indian law, a judgment can be "overruled" by a larger bench of the same court or a higher court. Knowing whether a case is still "good law" is essential. SCC Online and Manupatra both track this. The knowledge graph should too.

### 2.3 Doctrines and Principles

| Node Type | What It Represents | Example | Why It's a Node |
|-----------|-------------------|---------|-----------------|
| `doctrine` | A judicial principle that emerged from case law | Doctrine of Basic Structure, Doctrine of Eclipse, Doctrine of Pith & Substance | Students study these as standalone topics. They have origin cases, scope, application, and evolution. |
| `concept` | An abstract legal idea that spans multiple sources | Mens Rea, Actus Reus, Vicarious Liability, Natural Justice | Core building blocks of legal understanding that appear across multiple statutes and cases |
| `legal_test` | A specific judicial framework for analysis | Rational Nexus Test (Art. 14), Wednesbury Unreasonableness, Rarest of Rare (death penalty) | Students need to know these as applied tools — what are the factors, how courts apply them |

### 2.4 Topics (The Study Unit)

| Node Type | What It Represents | Example | Why It's a Node |
|-----------|-------------------|---------|-----------------|
| `topic` | A study-oriented grouping of related material | "Self-Defence under BNS", "Culpable Homicide vs. Murder", "Writ Jurisdiction" | This is the node type from your *existing* schema. It bundles sections + cases + concepts into a coherent study unit for a student. |

**This is what your current `nodes` table mostly contains** — topic-level study units like "BNS Section 106." The knowledge graph expands this by adding the other node types (statutes, judgments, doctrines) as first-class entities that topics connect to.

---

## Part 3: The Full Node Type Summary

```
Node Types (7 total):
  ├── statute          — An Act of Parliament/State Legislature
  ├── section          — A provision within a statute (with sub-sections, provisos, etc. as structured data)
  ├── constitutional_provision — An Article/Part/Schedule of the Constitution
  ├── judgment         — A court decision (with ratio, obiter, dissent as structured data inside)
  ├── doctrine         — A judicial principle (Basic Structure, Eclipse, Severability, etc.)
  ├── concept          — An abstract legal idea (Mens Rea, Natural Justice, etc.)
  └── topic            — A study-oriented grouping (your existing node type)
```

That's **7 node types**. Not 28. Every one of them passes the test: a student would search for it, it would have its own page, and the community would write content for it.

---

## Part 4: Relationship Types (How Indian Law Actually Connects)

### 4.1 What the Previous Schema Got Wrong

The old schema proposed edges like `sunset_clause`, `effective_from`, and `applies_test`. These are problems:

- **`sunset_clause`** — This is extraordinarily rare in Indian law. TADA (1985) is one of the only examples. It's not worth a first-class relationship type.
- **`effective_from`** — This is a **date property on a node**, not a relationship between two nodes. A section doesn't have a relationship with a date; it *has* a date.
- **`applies_test`** — This is just a sub-case of `interprets`/`establishes`. Not distinct enough for its own edge type.

### 4.2 The Real Relationships — Grounded in Indian Legal Practice

I've organized these into four families based on how they actually function in Indian law.

#### Family 1: Structural Hierarchy (How law is organized)

These model the **containment** structure of Indian legislation.

| Edge Type | Direction | Example | When to Use |
|-----------|-----------|---------|-------------|
| `part_of` | Child → Parent | BNS Section 103 `part_of` BNS | A section belongs to a statute. An article belongs to the Constitution. |
| `grouped_with` | Sibling ↔ Sibling | BNS Sec 299 `grouped_with` BNS Sec 300 | Sections that are studied together (Culpable Homicide and Murder are always taught as a group) |

> [!NOTE]
> **Why no `contains` edge?** Because `part_of` already captures the hierarchy, and containment is the inverse. Having both creates redundancy. Pick one direction and query bidirectionally.

#### Family 2: Legislative Lineage (How law evolves over time)

India just did a massive code replacement in 2023. These edges model that.

| Edge Type | Direction | Example | When to Use |
|-----------|-----------|---------|-------------|
| `replaces` | New → Old | BNS Sec 103 `replaces` IPC Sec 302 | The 2023 criminal law reform: BNS replaces IPC, BNSS replaces CrPC, BSA replaces Indian Evidence Act |
| `amends` | Amendment → Original | Criminal Law (Amendment) Act, 2018 `amends` IPC | When an amendment act modifies sections of an existing act |
| `repeals` | New Act → Old Act | BNS `repeals` IPC | Complete repeal of one statute by another |
| `subordinate_to` | Rule/Regulation → Parent Act | Income Tax Rules `subordinate_to` Income Tax Act | Delegated legislation derives authority from a parent Act |
| `overrides` | Central Law → State Law | Central Act `overrides` State Act on Concurrent List | Article 254: When central and state laws conflict on Concurrent List subjects |

#### Family 3: Judicial Treatment (How courts treat precedent)

This is where my previous schema was most superficial. Indian legal databases (SCC Online, Manupatra) use **standardized citator treatment types**. The knowledge graph should use the same vocabulary:

| Edge Type | Direction | Meaning | Signal |
|-----------|-----------|---------|--------|
| `followed` | Later Case → Earlier Case | Court applied the ratio of the earlier case because facts/law are similar | ✅ **Positive** — the case is good law |
| `applied` | Later Case → Earlier Case | Court accepted and used the principle of the earlier case to decide | ✅ **Positive** — active application |
| `approved` | Higher Court → Lower Court | Higher court explicitly endorsed the lower court's reasoning | ✅ **Positive** — strengthens authority |
| `explained` | Later Case → Earlier Case | Court clarified the scope or meaning of the earlier decision | 🟡 **Neutral** — elaboration, not endorsement or rejection |
| `referred_to` | Later Case → Earlier Case | Case mentioned without heavy reliance | 🟡 **Neutral** — citation only |
| `distinguished` | Later Case → Earlier Case | Court found the facts/law materially different, so the precedent doesn't apply here | 🟡 **Cautionary** — limits scope |
| `doubted` | Later Case → Earlier Case | Court questioned the correctness without formally overruling | 🔴 **Negative** — reliability warning |
| `not_followed` | Later Case → Earlier Case | Court declined to follow the precedent | 🔴 **Negative** — practical rejection |
| `overruled` | Later/Higher Court → Earlier Case | Explicitly declared incorrect and no longer valid law | 🔴 **Negative** — the case is "bad law" |

These 9 edge types are **not invented** — they're the standard terms used by every Indian legal database. Using them makes the platform interoperable with professional legal research tools.

#### Family 4: Conceptual Connections (The Learning Graph)

These are the edges that power the student experience — navigation, study paths, and understanding.

| Edge Type | Direction | Example | When to Use |
|-----------|-----------|---------|-------------|
| `interprets` | Judgment → Provision | *Maneka Gandhi* `interprets` Article 21 | A case that provides authoritative interpretation of a statutory provision |
| `establishes` | Judgment → Doctrine | *Kesavananda Bharati* `establishes` Basic Structure Doctrine | A landmark case that creates a new legal principle |
| `codifies` | Statute → Doctrine/Concept | Consumer Protection Act `codifies` tort principles | When a statute gives statutory form to previously judge-made law |
| `prerequisite` | Concept B → Concept A | "Culpable Homicide" `prerequisite` "General Exceptions" | Must understand A before studying B |
| `distinguish_from` | Concept ↔ Concept | "Culpable Homicide" `distinguish_from` "Murder" | Frequently confused concepts. **This is the single most important pedagogical edge in Indian law.** Exam questions constantly ask "Distinguish between X and Y." |
| `related_to` | Any ↔ Any | "Tort of Negligence" `related_to` "Consumer Protection Act" | Connected but distinct — useful for cross-domain discovery |
| `exception_to` | Exception → General Rule | "Right of Private Defence" `exception_to` "Murder" | General Exceptions (BNS Chapter IV) are exceptions TO specific offences. This models that relationship. |
| `governed_by` | Topic → Statute | "Workplace Harassment" `governed_by` "POSH Act, 2013" | Which Act is the primary governing legislation for a topic |
| `analogous_to` | Provision ↔ Provision | BNS Sec 103 `analogous_to` IPC Sec 302 | Provisions across different acts that serve the same purpose (especially useful for old code → new code comparisons) |

---

## Part 5: The Complete Relationship Summary

```
Relationship Types (20 total, in 4 families):

Structural (2):
  ├── part_of           — Section belongs to statute, article to constitution
  └── grouped_with      — Sections studied together (299+300, 319+320)

Legislative Lineage (5):
  ├── replaces           — BNS Sec 103 replaces IPC Sec 302
  ├── amends             — Amendment Act modifies existing Act
  ├── repeals            — New Act repeals old Act entirely
  ├── subordinate_to     — Rules/Regulations under parent Act
  └── overrides          — Central law overrides conflicting State law (Art. 254)

Judicial Treatment (9):
  ├── followed           — ✅ Ratio applied, facts similar
  ├── applied            — ✅ Principle used to decide
  ├── approved           — ✅ Higher court endorses lower court
  ├── explained          — 🟡 Scope/meaning clarified
  ├── referred_to        — 🟡 Mentioned without heavy reliance
  ├── distinguished      — 🟡 Facts/law materially different
  ├── doubted            — 🔴 Correctness questioned
  ├── not_followed       — 🔴 Declined to apply
  └── overruled          — 🔴 Declared incorrect, no longer valid

Conceptual (9):
  ├── interprets          — Case interprets a provision
  ├── establishes         — Case creates a doctrine
  ├── codifies            — Statute formalizes judge-made law
  ├── prerequisite        — Must understand A before B
  ├── distinguish_from    — Commonly confused concepts (exam gold)
  ├── related_to          — Connected but distinct
  ├── exception_to        — General exceptions to specific offences
  ├── governed_by         — Topic's primary governing statute
  └── analogous_to       — Same-purpose provisions across different acts
```

---

## Part 6: The Taxonomy (How Subjects Are Organized)

Based on **Bar Council of India syllabus**, **NLU curriculum**, and the **Seventh Schedule** of the Constitution, here is the subject-level taxonomy. This is what the `categories` table should contain:

### Level 1: Major Legal Domains

```
Indian Law
├── Constitutional Law
├── Criminal Law (Substantive)
├── Criminal Procedure
├── Civil Law
│   ├── Law of Contract
│   ├── Law of Torts
│   ├── Property Law
│   └── Family / Personal Law
├── Procedural Law
│   ├── Civil Procedure (CPC)
│   └── Law of Evidence
├── Administrative Law
├── Commercial & Corporate Law
│   ├── Company Law
│   ├── Banking & Insurance Law
│   └── Intellectual Property
├── Labour & Industrial Law
├── Environmental Law
├── Cyber Law / IT Law
├── Tax Law
├── International Law
│   ├── Public International Law
│   └── Private International Law / Conflict of Laws
└── Jurisprudence & Legal Theory
```

### The Personal Law Problem

Personal law is unique to India and doesn't fit neatly into a single branch:

```
Personal / Family Law
├── Hindu Law
│   ├── Hindu Marriage Act, 1955
│   ├── Hindu Succession Act, 1956
│   ├── Hindu Adoption and Maintenance Act, 1956
│   └── Hindu Minority and Guardianship Act, 1956
├── Muslim Personal Law
│   ├── Muslim Personal Law (Shariat) Application Act, 1937
│   ├── Dissolution of Muslim Marriages Act, 1939
│   └── Muslim Women (Protection of Rights on Divorce) Act, 1986
├── Christian Law
│   ├── Indian Christian Marriage Act, 1872
│   └── Indian Divorce Act, 1869
├── Parsi Law
│   └── Parsi Marriage and Divorce Act, 1936
└── Secular / Uniform
    └── Special Marriage Act, 1954
```

### The Seventh Schedule Dimension

For constitutional law purposes, every statute should carry metadata about its legislative competence:

```
legislative_list: "union" | "state" | "concurrent" | "residuary"
```

This is metadata on the `statute` node, **not** a separate node or edge. Criminal law, for example, is on the **Concurrent List** — meaning both Parliament and State Legislatures can make laws on it, but central law prevails in case of conflict (Article 254).

---

## Part 7: The Proposed PostgreSQL Schema

### 7.1 Enhanced Nodes Table

```sql
-- Evolution of existing 'nodes' table
-- Your existing nodes are essentially 'topic' type nodes

ALTER TABLE public.nodes 
  ADD COLUMN IF NOT EXISTS node_type text DEFAULT 'topic'
  CHECK (node_type IN (
    'statute', 'section', 'constitutional_provision',
    'judgment', 'doctrine', 'concept', 'topic'
  ));

-- Structured, type-specific metadata
ALTER TABLE public.nodes 
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Structural hierarchy (Section → Statute, Article → Constitution)
ALTER TABLE public.nodes 
  ADD COLUMN IF NOT EXISTS parent_node_id uuid REFERENCES public.nodes;
```

**What goes in `metadata` for each type:**

```jsonc
// statute
{
  "full_title": "The Bharatiya Nyaya Sanhita, 2023",
  "short_title": "BNS",
  "act_number": "45 of 2023",
  "enacted_by": "Parliament of India",         // "Parliament" | "State Legislature of {state}"
  "date_of_enactment": "2023-12-25",
  "date_of_enforcement": "2024-07-01",
  "legislative_list": "concurrent",             // "union" | "state" | "concurrent" | "residuary"
  "replaces": "Indian Penal Code, 1860",        // human-readable (the edge has the formal link)
  "total_sections": 358,
  "total_chapters": 20, 
  "status": "in_force"                          // "in_force" | "repealed" | "partially_repealed"
}

// section
{
  "section_number": "103",
  "chapter": "VI — Of Offences Affecting the Human Body",
  "bare_act_text": "Whoever causes death by doing an act with the intention...",
  "sub_sections": [
    { "number": "(1)", "text": "..." },
    { "number": "(2)", "text": "..." }
  ],
  "provisos": ["Provided that..."],
  "explanations": ["Explanation 1 — For the purposes of..."],
  "illustrations": ["(a) A shoots Z with the intention of killing..."],
  "essentials": [
    "Causing death of a person",
    "Act done with intention of causing death",
    "Or with intention of causing bodily injury likely to cause death",
    "Or with knowledge that the act is likely to cause death"
  ],
  "punishment": "Death or imprisonment for life, and fine",
  "cognizable": true,
  "bailable": false,
  "compoundable": false,
  "enforcement_status": "active"                // "active" | "repealed" | "substituted"
}

// judgment
{
  "case_name": "Maneka Gandhi v. Union of India",
  "citations": ["AIR 1978 SC 597", "(1978) 1 SCC 248"],
  "court": "Supreme Court of India",
  "bench_type": "Constitution Bench",           // "Single Judge" | "Division Bench" | "Full Bench" | "Constitution Bench"
  "bench_strength": 7,
  "judges": ["M.H. Beg CJ", "Y.V. Chandrachud", "P.N. Bhagwati", "V.R. Krishna Iyer", "N.L. Untwalia", "S. Murtaza Fazal Ali", "P.S. Kailasam"],
  "date_of_judgment": "1978-01-25",
  "petitioner": "Maneka Gandhi",
  "respondent": "Union of India",
  "case_status": "good_law",                    // "good_law" | "overruled" | "partially_overruled" | "doubted"
  "ratio_decidendi": "The right to travel abroad is part of personal liberty under Article 21. The procedure established by law must be just, fair, and reasonable.",
  "significance": "Expanded Article 21 from a narrow, literal interpretation to include due process. Overruled the narrow reading in A.K. Gopalan."
}

// doctrine
{
  "doctrine_name": "Doctrine of Basic Structure",
  "origin_case": "Kesavananda Bharati v. State of Kerala (1973)",
  "applicable_domains": ["constitutional"],
  "current_status": "firmly_established",
  "key_elements": [
    "Supremacy of the Constitution",
    "Republican and Democratic form of government",
    "Secular character of the Constitution",
    "Separation of powers",
    "Federal character of the Constitution"
  ]
}

// concept
{
  "concept_name": "Mens Rea",
  "translation": "Guilty Mind",
  "applicable_domains": ["criminal"],
  "related_maxims": ["Actus non facit reum nisi mens sit rea"]
}
```

### 7.2 Edges Table (Replacing cross_references)

```sql
-- Drop old constraint and expand relationship types
ALTER TABLE public.cross_references 
  DROP CONSTRAINT IF EXISTS cross_references_relationship_type_check;

ALTER TABLE public.cross_references 
  ADD CONSTRAINT cross_references_relationship_type_check 
  CHECK (relationship_type IN (
    -- Structural
    'part_of', 'grouped_with',
    -- Legislative Lineage
    'replaces', 'amends', 'repeals', 'subordinate_to', 'overrides',
    -- Judicial Treatment (maps to SCC Online / Manupatra citator terms)
    'followed', 'applied', 'approved', 'explained', 'referred_to',
    'distinguished', 'doubted', 'not_followed', 'overruled',
    -- Conceptual
    'interprets', 'establishes', 'codifies',
    'prerequisite', 'distinguish_from', 'related_to',
    'exception_to', 'governed_by', 'analogous_to'
  ));

-- Add description for human-readable context on an edge
ALTER TABLE public.cross_references 
  ADD COLUMN IF NOT EXISTS description text;

-- Add treatment signal for quick filtering  
ALTER TABLE public.cross_references 
  ADD COLUMN IF NOT EXISTS signal text 
  CHECK (signal IN ('positive', 'neutral', 'cautionary', 'negative'));
-- Auto-derivable from relationship_type, but useful for fast queries
```

### 7.3 Category Taxonomy

```sql
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES public.categories ON DELETE CASCADE,
  depth_level integer NOT NULL CHECK (depth_level BETWEEN 1 AND 4),
  -- Level 1: Constitutional Law, Criminal Law, etc.
  -- Level 2: Fundamental Rights, Offences Against Person, etc.
  -- Level 3: Right to Equality, Right to Freedom, etc.
  -- Level 4: Article 14, Article 19(1)(a), etc.
  description text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories viewable by everyone." ON categories FOR SELECT USING (true);

-- Many-to-many: nodes belong to categories
CREATE TABLE IF NOT EXISTS public.node_categories (
  node_id uuid REFERENCES public.nodes ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.categories ON DELETE CASCADE NOT NULL,
  is_primary boolean DEFAULT false,
  PRIMARY KEY (node_id, category_id)
);

-- Enforce exactly one primary category per node
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_category 
  ON public.node_categories (node_id) WHERE is_primary = true;
```

### 7.4 Learning Paths

```sql
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  category_id uuid REFERENCES public.categories, -- which subject area
  difficulty text CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  exam_relevance text[], -- e.g., ['judicial_services', 'CLAT', 'AIBE', 'university']
  estimated_hours integer,
  created_by uuid REFERENCES public.profiles,
  is_official boolean DEFAULT false, -- platform-curated vs. community-curated
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.learning_path_nodes (
  path_id uuid REFERENCES public.learning_paths ON DELETE CASCADE NOT NULL,
  node_id uuid REFERENCES public.nodes ON DELETE CASCADE NOT NULL,
  sequence_order integer NOT NULL,
  PRIMARY KEY (path_id, node_id)
);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learning paths viewable by everyone." ON learning_paths FOR SELECT USING (true);
```

---

## Part 8: How the Layers Connect

Your existing platform already has the Content Layer (revisions), Social Layer (discussions, consensus votes), and Quality Layer (inline tags). The knowledge graph is the **Structural Layer** underneath all of them.

```
┌──────────────────────────────────────────────────────────┐
│                    QUALITY LAYER                         │
│  inline_tags (citation_needed, outdated, disputed, etc.) │
├──────────────────────────────────────────────────────────┤
│                    SOCIAL LAYER                          │
│  discussions + consensus_votes + community profiles      │
├──────────────────────────────────────────────────────────┤
│                    CONTENT LAYER                         │
│  revisions (Tier 1 / Tier 2 / Tier 3 report content)    │
├──────────────────────────────────────────────────────────┤
│                  STRUCTURAL LAYER (NEW)                  │
│  nodes (7 types) + edges (20 types) + categories         │
│                                                          │
│  statute ──part_of──▶ section ◀──interprets── judgment   │
│                           │                      │       │
│                     distinguish_from         establishes  │
│                           │                      │       │
│                       section            doctrine/concept │
│                                                          │
│  All layers attach TO nodes:                             │
│    revision.node_id → node                               │
│    discussion.node_id → node                             │
│    inline_tag.node_id → node                             │
│    watchlist.node_id → node                              │
└──────────────────────────────────────────────────────────┘
```

---

## Part 9: What This Enables (Practical Queries)

Here are real queries this schema supports:

1. **"Show me all sections of BNS that replaced IPC sections"**
   ```sql
   SELECT n1.title as new_section, n2.title as old_section
   FROM cross_references cr
   JOIN nodes n1 ON cr.source_node_id = n1.id
   JOIN nodes n2 ON cr.target_node_id = n2.id
   WHERE cr.relationship_type = 'replaces'
   AND n1.metadata->>'act' = 'BNS';
   ```

2. **"Is Kesavananda Bharati still good law?"**
   ```sql
   SELECT cr.relationship_type, n.title as subsequent_case, cr.signal
   FROM cross_references cr
   JOIN nodes n ON cr.source_node_id = n.id
   WHERE cr.target_node_id = '<kesavananda-id>'
   AND cr.relationship_type IN ('overruled', 'doubted', 'not_followed')
   ORDER BY n.created_at DESC;
   -- Empty result = still good law
   ```

3. **"What doctrines apply to Article 14?"**
   ```sql
   SELECT n.title, cr.relationship_type
   FROM cross_references cr
   JOIN nodes n ON cr.source_node_id = n.id
   WHERE cr.target_node_id = '<article-14-id>'
   AND n.node_type = 'doctrine';
   ```

4. **"Distinguish between Culpable Homicide and Murder"**
   ```sql
   SELECT n1.title, n2.title, cr.description
   FROM cross_references cr
   JOIN nodes n1 ON cr.source_node_id = n1.id
   JOIN nodes n2 ON cr.target_node_id = n2.id
   WHERE cr.relationship_type = 'distinguish_from'
   AND (n1.slug = 'bns-section-103' OR n2.slug = 'bns-section-103');
   ```

5. **"Learning path for Criminal Law (Judicial Services exam)"**
   ```sql
   SELECT n.title, n.node_type, lpn.sequence_order
   FROM learning_path_nodes lpn
   JOIN nodes n ON lpn.node_id = n.id
   JOIN learning_paths lp ON lpn.path_id = lp.id
   WHERE lp.slug = 'criminal-law-judicial-services'
   ORDER BY lpn.sequence_order;
   ```

---

## Part 10: Open Design Decisions

> [!IMPORTANT]
> **Decision 1: Granularity of Sections**
> Should every single section of every act be a node from day one? BNS alone has 358 sections. If you add CPC (158 orders), CrPC (484 sections → now BNSS 531 sections), Evidence Act (167 sections → now BSA 170 sections), you're looking at **1,500+ section nodes** just from procedural and criminal codes. 
>
> **My recommendation**: Start with the sections that are commonly studied (maybe 200-300 across all codes) and let the community organically create nodes for the rest. Your existing "node creation" workflow already supports this.

> [!IMPORTANT]
> **Decision 2: Judgment Depth**
> The Supreme Court alone has delivered **80,000+ judgments**. How many should be first-class nodes? 
>
> **My recommendation**: Only "landmark" judgments that are commonly studied in law school deserve their own node (~500-1000 across all subjects). For the rest, case references can live as metadata within section nodes (the `provisions_interpreted` field handles this).

> [!WARNING]
> **Decision 3: Community-Created Edges**
> Should any registered user be able to create edges (like they can currently create cross-references)? Or should judicial treatment edges (followed, overruled, etc.) require senior validator approval? 
>
> Getting a `case_status` wrong (marking a good-law case as "overruled") could mislead students significantly. I'd recommend requiring validator review for judicial treatment edges.

> [!NOTE]
> **Decision 4: `topic` vs. `section` Tension**
> Your existing nodes are mostly `topic` types (e.g., "BNS Section 106"). When you add `section` as a node type, what happens? Does "BNS Section 106" become a `section` node with the bare act text in metadata, and the existing report content stays in the `revisions` table? Or do `topic` and `section` nodes coexist with a `governed_by` edge between them?
>
> **My recommendation**: Migrate existing nodes to be `section` or `topic` nodes based on their actual content. If a node's slug starts with a section reference, it's probably a `section` node.

---

## Part 11: Migration Path

You don't need to rebuild anything. The evolution is:

1. **Phase 0 (Now)**: Add `node_type`, `metadata`, `parent_node_id` columns to `nodes`. All existing nodes get `node_type = 'topic'` by default.
2. **Phase 1**: Expand `cross_references` relationship types. Drop the old constraint, add the new one.
3. **Phase 2**: Create `categories` and `node_categories` tables. Populate the taxonomy tree.
4. **Phase 3**: Start adding `statute` and `section` nodes for BNS (your primary focus area). Link them with `part_of` edges.
5. **Phase 4**: Add `judgment` nodes for landmark cases, linked with `interprets` edges to the sections they interpret.
6. **Phase 5**: Community naturally creates `doctrine`, `concept`, and `legal_test` nodes as the platform grows.
7. **Phase 6**: Add `learning_paths` for curated study sequences.
