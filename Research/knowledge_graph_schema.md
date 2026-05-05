# Knowledge Graph Schema for Indian Law — Siddhant Platform

## Overview

This document defines the knowledge graph schema that powers Siddhant's "Living Legal Graph." It specifies:
- **8 Node Types** — the entities in the graph
- **20 Relationship Types** — the edges connecting them, grounded in Indian legal practice
- **Category Taxonomy** — subject-based classification for browsing

---

## Node Types (8)

Every node in the graph represents a "legal knowledge unit" that a student would search for, study, and contribute to.

### The Test
> **Would a student search for this?** Would it have its own page on Siddhant? Would the community write revisions for it?
> If no → it's metadata inside another node, not a node itself.

### 1. `statute`
An Act of Parliament or State Legislature.
- **Examples**: Bharatiya Nyaya Sanhita 2023, Indian Contract Act 1872, Consumer Protection Act 2019
- **Metadata**: full_title, short_title, act_number, enacted_by, date_of_enactment, date_of_enforcement, legislative_list (union/state/concurrent), total_sections, total_chapters, status (in_force/repealed)
- **What the page shows**: Act overview, structure, purpose, history, link to all chapters

### 2. `chapter`
A structural division within a statute or Part of the Constitution.
- **Examples**: BNS Chapter VI (Offences Affecting the Human Body), Constitution Part III (Fundamental Rights)
- **Metadata**: chapter_number, chapter_title, parent_act
- **Parent**: Always a `statute` or root Constitution node
- **What the page shows**: Chapter overview, list of sections/articles within it, key themes

### 3. `section`
A single operative provision within a statute.
- **Examples**: BNS Section 103 (Murder), IPC Section 302 (repealed)
- **Metadata**: section_number, bare_act_text, sub_sections[], provisos[], explanations[], illustrations[], essentials[], punishment, cognizable, bailable, compoundable, enforcement_status
- **Parent**: Always a `chapter` node
- **What the page shows**: Bare act text in highlighted box, essentials list, case law connections

### 4. `constitutional_provision`
An Article, Schedule, or amendment of the Constitution.
- **Examples**: Article 14, Article 21, Seventh Schedule, 42nd Amendment
- **Metadata**: article_number, bare_text, part, amendment_details
- **Parent**: A `chapter` node (which represents a Part of the Constitution)
- **What the page shows**: Constitutional text, judicial evolution, landmark interpretations

### 5. `judgment`
A court decision.
- **Examples**: Kesavananda Bharati v. State of Kerala (1973), Maneka Gandhi v. Union of India (1978)
- **Metadata**: case_name, citations[], court, bench_type (Single Judge/Division Bench/Full Bench/Constitution Bench), bench_strength, judges[], date_of_judgment, petitioner, respondent, case_status (good_law/overruled/partially_overruled/doubted), ratio_decidendi, significance
- **No parent** (judgments don't belong to a structural hierarchy)
- **What the page shows**: Facts, Issues, Arguments, Ratio, Significance, Case Status badge

### 6. `doctrine`
A judicial principle that emerged from case law or constitutional interpretation.
- **Examples**: Doctrine of Basic Structure, Doctrine of Eclipse, Doctrine of Pith & Substance, Doctrine of Severability
- **Metadata**: doctrine_name, origin_case, applicable_domains[], current_status, key_elements[]

### 7. `concept`
An abstract legal idea that spans multiple sources.
- **Examples**: Mens Rea, Actus Reus, Vicarious Liability, Natural Justice, Res Judicata
- **Metadata**: concept_name, translation (if Latin/legal term), applicable_domains[], related_maxims[]

### 8. `topic`
A study-oriented grouping — the default type and backward-compatible with existing nodes.
- **Examples**: "Culpable Homicide vs Murder", "Self-Defence under BNS", "Writ Jurisdiction"
- **Metadata**: none required (content lives in revisions)
- **This is your existing node type.** New nodes default to this unless a more specific type is chosen.

---

## Relationship Types (20)

### Family 1: Structural (2)

| Edge | Direction | Example | Description |
|------|-----------|---------|-------------|
| `part_of` | Child → Parent | BNS Sec 103 → Chapter VI | Section belongs to chapter, chapter belongs to statute |
| `grouped_with` | Sibling ↔ Sibling | BNS Sec 100 ↔ Sec 103 | Sections commonly studied together |

### Family 2: Legislative Lineage (5)

| Edge | Direction | Example | Description |
|------|-----------|---------|-------------|
| `replaces` | New → Old | BNS Sec 103 → IPC Sec 302 | New provision replaces old one |
| `amends` | Amendment → Original | Criminal Law Amendment 2018 → IPC | Amendment modifies existing Act |
| `repeals` | New Act → Old Act | BNS → IPC | Complete repeal of one statute by another |
| `subordinate_to` | Rule → Parent Act | IT Rules → IT Act | Delegated legislation under parent statute |
| `overrides` | Central → State | Central Act → State Act | Article 254: Central law prevails on concurrent subjects |

### Family 3: Judicial Treatment (9)

These map exactly to SCC Online / Manupatra citator terminology.

| Edge | Direction | Signal | Meaning |
|------|-----------|--------|---------|
| `followed` | Later → Earlier | ✅ Positive | Ratio applied, facts similar |
| `applied` | Later → Earlier | ✅ Positive | Principle used to decide |
| `approved` | Higher → Lower | ✅ Positive | Higher court endorses reasoning |
| `explained` | Later → Earlier | 🟡 Neutral | Scope/meaning clarified |
| `referred_to` | Later → Earlier | 🟡 Neutral | Mentioned without heavy reliance |
| `distinguished` | Later → Earlier | 🟡 Cautionary | Facts/law materially different |
| `doubted` | Later → Earlier | 🔴 Negative | Correctness questioned |
| `not_followed` | Later → Earlier | 🔴 Negative | Declined to apply |
| `overruled` | Later/Higher → Earlier | 🔴 Negative | Declared incorrect, no longer valid |

### Family 4: Conceptual (9)

| Edge | Direction | Example | Description |
|------|-----------|---------|-------------|
| `interprets` | Judgment → Provision | Maneka Gandhi → Art. 21 | Case provides authoritative interpretation |
| `establishes` | Judgment → Doctrine | Kesavananda → Basic Structure | Case creates a new legal principle |
| `codifies` | Statute → Doctrine | Consumer Protection Act → Tort principles | Statute formalizes judge-made law |
| `prerequisite` | B → A | "Culpable Homicide" → "Mens Rea" | Must understand A before B |
| `distinguish_from` | A ↔ B | Sec 100 ↔ Sec 103 | Commonly confused concepts |
| `related_to` | A ↔ B | Negligence tort ↔ Consumer Protection | Connected but distinct |
| `exception_to` | Exception → Rule | Right of Private Defence → Murder | General exceptions to specific offences |
| `governed_by` | Topic → Statute | Workplace Harassment → POSH Act | Primary governing legislation |
| `analogous_to` | A ↔ B | BNS 103 ↔ IPC 302 | Same-purpose provisions across acts |

---

## Category Taxonomy

### What is the Taxonomy?

The taxonomy is a **subject classification system** — like library shelves. It answers: "What area of law is this about?"

This is DIFFERENT from the graph hierarchy:
- **Graph hierarchy** (parent_node_id): BNS → Chapter VI → Section 103 *(where it sits in the statute)*
- **Taxonomy** (categories): Criminal Law → Offences Against Person → Homicide *(what subject it belongs to)*

A node can belong to multiple categories (e.g., Medical Negligence is both Criminal Law AND Consumer Protection).

### Level 1 Domains (Based on BCI/NLU Curriculum)

- Constitutional Law
- Criminal Law (Substantive)
- Criminal Procedure
- Civil Law (Contracts, Torts, Property)
- Family / Personal Law
- Procedural Law (CPC, Evidence)
- Administrative Law
- Commercial & Corporate Law
- Labour & Industrial Law
- Environmental Law
- Cyber Law / IT Law
- Tax Law
- International Law
- Jurisprudence & Legal Theory

---

## One Graph, Not Many

All 8 node types live in ONE single graph. Indian law is inherently interconnected:
- Article 21 (Constitutional) connects to BNS Section 103 (Criminal) connects to Bachan Singh case (Judgment) connects to "Rarest of Rare" doctrine.
- The taxonomy provides filtered views of this single graph, not separate graphs.
