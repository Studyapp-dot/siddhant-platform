# Node Metadata Reference — Complete Specification (v2)

> [!NOTE]
> This document describes **exactly** what metadata is saved for each node type, how it gets there, and how it's displayed in the Quick Reference card on the Topic Page sidebar.
>
> **v2 Updates:** Added `legal_essence` across all major types, redesigned section/constitutional cards (removed bare act text wall), new chapter/concept cards, tightened essentials extraction, chip overflow system.

---

## How Metadata Works (The Pipeline)

```mermaid
flowchart LR
    A["User writes article\n(free-text)"] --> B["Node created\nmetadata = {}"]
    B --> C["AI Extraction\n(fire-and-forget)"]
    C --> D["Parsed JSON saved\nto nodes.metadata"]
    D --> E["Quick Reference Card\nrendered on Topic Page"]
    
    F["User edits article"] --> C
```

### Pipeline Steps

| Step | What Happens | Code Location |
|------|-------------|---------------|
| **1. Create** | User writes article text, picks a `node_type`. Node is inserted with `metadata = {}` | [actions.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/new/actions.ts) |
| **2. Extract** | `extractMetadata(nodeId)` is called fire-and-forget. AI reads the article and returns structured JSON | [extract-metadata.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/utils/ai/extract-metadata.ts) |
| **3. Store** | Extracted JSON is saved to `nodes.metadata` (JSONB column). System fields `_extracted_at`, `_extraction_model`, `_semantic_version`, `_suggested_edges` are appended | Same file |
| **4. Display** | Topic Page reads `node.metadata` and renders a type-specific Quick Reference card in the right sidebar | [page.tsx](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/page.tsx) |
| **5. Re-extract** | On every edit/revision, extraction re-runs and overwrites the metadata | [edit/actions.ts](file:///c:/Users/Nipun/OneDrive/Documents/Siddhant%20Save/Siddhant%20Save%2012/src/app/topic/%5Bslug%5D/edit/actions.ts) |

---

## Database Column

All metadata lives in a **single JSONB column** on the `nodes` table:

```sql
ALTER TABLE public.nodes 
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
```

The structure of the JSON varies by `node_type`. Every value below is **conditionally present** — the AI only includes fields it can extract from the article text.

---

## Design Principles

### Information Hierarchy (L1 → L4)

Every Quick Reference card follows this visual hierarchy:

| Level | Purpose | Example |
|-------|---------|---------|
| **L1 — Identity** | What is this? | Section 103, BNS |
| **L2 — Core Meaning** | Why does it matter? | `legal_essence` — one-line interpretation |
| **L3 — Classification** | How is it treated? | Cognizable, Non-bailable (subtle chips) |
| **L4 — Semantic Context** | How does it connect? | Key themes, essentials |

### Store More Than You Display

Not all metadata is shown in UI. Some metadata exists for AI systems, graph reasoning, retrieval, ranking, and future analytics. The sidebar shows only high-signal orientation information.

### Chip Overflow Rule

All chip arrays display max **3–5 visible items**. Overflow shows `+N more` as a muted pill.

---

## Node Types & Their Metadata

There are **8 node types**. Each has a different metadata schema extracted by AI and a different Quick Reference card layout.

---

### 1. `statute` — Act of Parliament / State Legislature

**Icon**: 📜 &nbsp; **Color**: `#8b5cf6` (purple)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `short_title` | `string` | `"BNS"` | Common abbreviation |
| `full_title` | `string` | `"The Bharatiya Nyaya Sanhita, 2023"` | Full official name |
| `act_number` | `string` | `"45 of 2023"` | Official Act number |
| `year` | `string` | `"2023"` | Enactment year |
| `date_of_enactment` | `string` (ISO date) | `"2023-12-25"` | Date passed by legislature |
| `date_of_enforcement` | `string` (ISO date) | `"2024-07-01"` | Date the Act came into force |
| `legislative_list` | `string` enum | `"concurrent"` | One of: `union`, `state`, `concurrent`, `residuary` |
| `status` | `string` enum | `"in_force"` | One of: `in_force`, `repealed`, `partially_repealed` |
| `replaces` | `string` | `"Indian Penal Code, 1860"` | Human-readable name of the Act it replaced |
| `key_themes` | `string[]` | `["criminal justice", "reform"]` | Main thematic tags (max 3–5) |

#### Quick Reference Card Display

The statute card displays when `nodeType === 'statute' && metadata.short_title` is truthy.

| Level | Card Row | Source Field |
|-------|----------|-------------|
| L1 | **Short Title** | `metadata.short_title` |
| L1 | **Act No.** | `metadata.act_number` (if present) |
| L2 | **Status** | `metadata.status` → colored status pill |
| L3 | **List** | `metadata.legislative_list` (if present, capitalized) |
| L3 | **Enacted** | `metadata.date_of_enactment` (if present) |
| L3 | **Replaces** | `metadata.replaces` (if present) |
| L4 | **Key Themes** | `metadata.key_themes` → chips (max 5, overflow hidden) |

> [!NOTE]
> `full_title`, `year`, `date_of_enforcement` are **saved but NOT displayed** in the Quick Reference card.

---

### 2. `chapter` — Structural Division Within a Statute

**Icon**: 📖 &nbsp; **Color**: `#6366f1` (indigo)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `chapter_number` | `string` | `"VI"` | Chapter/Part number |
| `chapter_title` | `string` | `"Offences Affecting the Human Body"` | Official chapter title |
| `parent_statute` | `string` | `"Bharatiya Nyaya Sanhita, 2023"` | Name of the parent Act |
| `key_themes` | `string[]` | `["homicide", "grievous hurt"]` | Main themes (max 3) |

#### Quick Reference Card Display

**New card** — displays when `nodeType === 'chapter' && metadata._extracted_at` is truthy.

| Level | Card Row | Source Field |
|-------|----------|-------------|
| L1 | **Chapter Number** | `metadata.chapter_number` |
| L1 | **Parent Statute** | `metadata.parent_statute` |
| L4 | **Key Themes** | `metadata.key_themes` → chips (max 3) |

---

### 3. `section` — Single Provision Within a Statute

**Icon**: § &nbsp; **Color**: `#3b82f6` (blue)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `section_number` | `string` | `"103"` | Section number within the Act |
| `legal_essence` | `string` | `"Punishes intentional causing of death."` | One-line compressed interpretation (max 15 words) |
| `bare_act_text` | `string` | `"Whoever causes death by doing an act with the intention..."` | Exact statutory text |
| `essentials` | `string[]` | `["Causing death", "Intention to cause death", ...]` | Each element/ingredient (max 5 items, 8–12 words each) |
| `punishment` | `string` | `"Death or imprisonment for life, and fine"` | Prescribed punishment |
| `cognizable` | `boolean` | `true` | Whether the offence is cognizable |
| `bailable` | `boolean` | `false` | Whether the offence is bailable |
| `compoundable` | `boolean` | `false` | Whether the offence is compoundable |
| `parent_statute` | `string` | `"Bharatiya Nyaya Sanhita, 2023"` | Name of parent Act |
| `enforcement_status` | `string` enum | `"in_force"` | One of: `in_force`, `repealed` |
| `legal_domains` | `string[]` | `["criminal"]` | Legal domains (max 3) |

#### Quick Reference Card Display

**Redesigned** — displays when `nodeType === 'section' && metadata._extracted_at` is truthy.

| Level | Card Row | Source Field |
|-------|----------|-------------|
| L1 | **Section Number** | `metadata.section_number` |
| L1 | **Parent Statute** | `metadata.parent_statute` |
| L2 | **Legal Essence** | `metadata.legal_essence` — italic, one-line |
| L3 | **Classification** | Cognizable / Bailable / Compoundable → subtle chips |
| L4 | **Essentials** | `metadata.essentials` → compressed bullet list (max 5) |
| Optional | **Punishment** | `metadata.punishment` |

> [!IMPORTANT]
> **`bare_act_text` is NO LONGER displayed in the sidebar.** It is still extracted and stored for the article body and future use, but removed from the Quick Reference card to reduce clutter and improve scannability.

---

### 4. `constitutional_provision` — Article / Schedule of the Constitution

**Icon**: 🏛 &nbsp; **Color**: `#0ea5e9` (sky blue)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `article_number` | `string` | `"21"` | Article number |
| `legal_essence` | `string` | `"Guarantees right to life and personal liberty."` | One-line compressed interpretation |
| `bare_text` | `string` | `"No person shall be deprived of his life..."` | Exact constitutional text |
| `part` | `string` | `"Part III — Fundamental Rights"` | Part/chapter of the Constitution |
| `amendment_details` | `string` | `"Inserted by Constitution (44th Amendment) Act, 1978"` | Relevant amendment info |
| `constitutional_principles` | `string[]` | `["Right to Life", "Due Process"]` | Key principles (max 2–3) |

#### Quick Reference Card Display

**Fixed and redesigned** — displays when `nodeType === 'constitutional_provision' && metadata._extracted_at` is truthy.

| Level | Card Row | Source Field |
|-------|----------|-------------|
| L1 | **Article Number** | `metadata.article_number` (with `metadata.section_number` fallback for legacy) |
| L1 | **Part** | `metadata.part` |
| L2 | **Legal Essence** | `metadata.legal_essence` |
| L3 | **Principles** | `metadata.constitutional_principles` → chips (max 3) |
| Optional | **Amendment** | `metadata.amendment_details` |

> [!NOTE]
> **Schema mismatch fixed.** The display code now reads `article_number` (with `section_number` fallback for legacy data). Full `bare_text` is stored but NOT shown in sidebar.

---

### 5. `judgment` — Court Decision

**Icon**: ⚖️ &nbsp; **Color**: `#f59e0b` (amber)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `case_name` | `string` | `"Maneka Gandhi v. Union of India"` | Full case name |
| `legal_essence` | `string` | `"Expanded Article 21 into substantive due process."` | One-line compressed interpretation |
| `citations` | `string[]` | `["AIR 1978 SC 597", "(1978) 1 SCC 248"]` | Standard legal citations |
| `court` | `string` | `"Supreme Court of India"` | Normalized court name |
| `bench_type` | `string` enum | `"Constitution Bench"` | One of: `Single Judge`, `Division Bench`, `Full Bench`, `Constitution Bench` |
| `bench_strength` | `number` | `7` | Number of judges on the bench |
| `judges` | `string[]` | `["M.H. Beg CJ", "Y.V. Chandrachud", ...]` | Names of judges |
| `date_of_judgment` | `string` (ISO date) | `"1978-01-25"` | Date the judgment was delivered |
| `ratio_decidendi` | `string` | `"The right to travel abroad is part of personal liberty..."` | Core legal principle (1–2 sentences) |
| `case_status` | `string` enum | `"good_law"` | One of: `good_law`, `overruled`, `partially_overruled`, `doubted` |
| `significance` | `string` | `"Expanded Article 21 from a narrow, literal interpretation..."` | Why this case matters |
| `related_doctrines` | `string[]` | `["Doctrine of Due Process"]` | Doctrines established or applied (max 2–3) |

#### Quick Reference Card Display

The judgment card is the **most detailed** card. Displays when `nodeType === 'judgment' && metadata._extracted_at` is truthy:

| Level | Card Row | Source Field |
|-------|----------|-------------|
| L1 | **Case** | `metadata.case_name` |
| L2 | **Legal Essence** | `metadata.legal_essence` — subtle italic line |
| L1 | **Citation** | `metadata.citations` (array joined) or `metadata.citation` (string fallback) |
| L3 | **Court** | `metadata.court` |
| L3 | **Bench** | `metadata.bench_type` or `metadata.bench`, plus `(N Judges)` |
| L3 | **Date** | `metadata.date_of_judgment` (formatted) |
| L3 | **Status** | `metadata.case_status` → colored pill badge |
| L2 | **Ratio Decidendi** | `metadata.ratio_decidendi` (highlighted box) |

**Case Status Badges:**

| Status | Label | Color |
|--------|-------|-------|
| `good_law` | ✅ Good Law | `#34d399` (green) |
| `overruled` | 🔴 Overruled | `#f87171` (red) |
| `partially_overruled` | 🟡 Partially Overruled | `#fbbf24` (yellow) |
| `doubted` | ⚠️ Doubted | `#fb923c` (orange) |

> [!NOTE]
> `judges`, `significance`, and `related_doctrines` are **saved but NOT displayed** in the Quick Reference card.

---

### 6. `doctrine` — Judicial Principle from Case Law

**Icon**: 💡 &nbsp; **Color**: `#10b981` (emerald)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `doctrine_name` | `string` | `"Doctrine of Basic Structure"` | Name of the doctrine |
| `legal_essence` | `string` | `"Limits Parliament's power to amend the Constitution."` | One-line compressed interpretation |
| `origin_case` | `string` | `"Kesavananda Bharati v. State of Kerala (1973)"` | Case where first established |
| `applicable_domains` | `string[]` | `["constitutional"]` | Legal domains where applicable |
| `key_elements` | `string[]` | `["Supremacy of the Constitution", ...]` | Core elements (max 3–4) |
| `current_status` | `string` | `"Well-established"` | Current legal standing |
| `constitutional_basis` | `string[]` | `["Article 368"]` | Constitutional provisions grounded in (max 2) |

#### Quick Reference Card Display

**Expanded** — displays when `nodeType === 'doctrine' && metadata._extracted_at` is truthy:

| Level | Card Row | Source Field |
|-------|----------|-------------|
| L1 | **Doctrine Name** | `metadata.doctrine_name` |
| L2 | **Legal Essence** | `metadata.legal_essence` |
| L3 | **Origin Case** | `metadata.origin_case` |
| L3 | **Status** | `metadata.current_status` → status pill |
| L4 | **Key Elements** | `metadata.key_elements` → bullet list (max 4, overflow hidden) |

> [!NOTE]
> `applicable_domains` and `constitutional_basis` are **saved but NOT displayed** in the Quick Reference card.

---

### 7. `concept` — Abstract Legal Idea

**Icon**: 🧠 &nbsp; **Color**: `#ec4899` (pink)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `concept_name` | `string` | `"Mens Rea"` | Name of the concept |
| `legal_essence` | `string` | `"Intent or knowledge of wrongdoing."` | One-line compressed interpretation |
| `translation` | `string` | `"Guilty Mind"` | Plain-English translation |
| `explanation_summary` | `string` | `"Mens rea refers to the mental element..."` | 2–3 sentences in plain language |
| `applicable_domains` | `string[]` | `["criminal"]` | Legal domains where relevant |
| `related_maxims` | `string[]` | `["Actus non facit reum nisi mens sit rea"]` | Related legal maxims (max 3) |
| `related_doctrines` | `string[]` | `["Doctrine of Strict Liability"]` | Related doctrines (max 2) |

#### Quick Reference Card Display

**New card** — displays when `nodeType === 'concept' && metadata._extracted_at` is truthy:

| Level | Card Row | Source Field |
|-------|----------|-------------|
| L1 | **Concept Name** | `metadata.concept_name` |
| L1 | **Translation** | `metadata.translation` — italic |
| L2 | **Legal Essence** | `metadata.legal_essence` |
| L3 | **Explanation** | `metadata.explanation_summary` |
| L4 | **Related Maxims** | `metadata.related_maxims` → chips (max 3, overflow hidden) |

> [!NOTE]
> `applicable_domains` and `related_doctrines` are **saved but NOT displayed** in the Quick Reference card.

---

### 8. `topic` — Study-Oriented Grouping (Default)

**Icon**: 📝 &nbsp; **Color**: `#64748b` (slate)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `key_themes` | `string[]` | `["self-defence", "proportionality", "imminent threat"]` | Main themes covered |
| `related_statutes` | `string[]` | `["Bharatiya Nyaya Sanhita, 2023"]` | Statutes mentioned in article |
| `related_cases` | `string[]` | `["Kesavananda Bharati v. State of Kerala"]` | Cases mentioned in article |
| `learning_level` | `string` enum | `"intermediate"` | One of: `introductory`, `intermediate`, `advanced` |

#### Quick Reference Card Display

**No card.** The entire Quick Reference panel is **hidden** for topic nodes:

```tsx
{nodeType !== 'topic' && (
  <div className="sidebar-quick-ref"> ... </div>
)}
```

---

## System Fields (All Node Types)

These are added by the extraction pipeline (not by AI) after a successful extraction:

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `_extracted_at` | `string` (ISO datetime) | `"2026-04-01T14:30:00.000Z"` | When extraction ran |
| `_extraction_model` | `string` | `"google/gemini-2.5-flash"` | Which AI model was used |
| `_semantic_version` | `string` | `"1.0"` | Schema version for future compatibility |
| `_suggested_edges` | `object[]` | See below | AI-suggested connections to other nodes |

### `_suggested_edges` Format

```json
[
  {
    "target_title": "Name of related node",
    "relationship_type": "interprets",
    "reason": "This case provides the leading interpretation of this section"
  }
]
```

Valid relationship types for suggestions: `interprets`, `establishes`, `codifies`, `prerequisite`, `distinguish_from`, `related_to`, `exception_to`, `governed_by`, `analogous_to`, `replaces`, `followed`, `applied`, `overruled`, `distinguished`, `explained`, `referred_to`.

> [!IMPORTANT]
> Suggested edges are **stored in metadata** but are **NOT automatically created** as actual edges in the `cross_references` table. They are currently not surfaced in the UI at all. Planned for future graph intelligence layer.

---

## Complete Field Matrix

A summary of what's saved vs. what's displayed:

| Node Type | Fields Saved | Fields Displayed | Display Condition |
|-----------|:---:|:---:|---|
| `statute` | 10 | 7 + theme chips | `metadata.short_title` exists |
| `chapter` | 4 | 3 + theme chips | `metadata._extracted_at` exists |
| `section` | 11 | 6 + essentials list | `metadata._extracted_at` exists |
| `constitutional_provision` | 6 | 4 + principle chips | `metadata._extracted_at` exists |
| `judgment` | 12 | 8 + ratio box | `metadata._extracted_at` exists |
| `doctrine` | 7 | 5 + elements list | `metadata._extracted_at` exists |
| `concept` | 7 | 5 + maxim chips | `metadata._extracted_at` exists |
| `topic` | 4 | 0 | Card hidden entirely |

---

## Extraction Quality Rules

### Essentials (Section Nodes)
- Max **5 items**
- Each item **8–12 words**
- **Noun/action structure** preferred
- **No full sentences** or explanations

✅ Good: `"Dishonest intention"`, `"Movable property"`, `"Without consent"`  
❌ Bad: `"The accused must have dishonestly taken property from another person…"`

### Legal Essence (All Major Types)
- **One compressed sentence**, max 15 words
- Captures the core legal meaning
- Not a summary — an interpretation-oriented label

✅ Good: `"Punishes intentional causing of death."`  
❌ Bad: `"This section deals with the offence of murder under the new criminal code."`

---

## Resolved Issues (from v1)

> [!NOTE]
> **1. ~~`constitutional_provision` field mismatch~~** — FIXED. Display code now reads `article_number` (with `section_number` fallback for legacy data). No more dual naming.

> [!NOTE]
> **2. ~~Many extracted fields invisible~~** — RESOLVED. Essentials, classification chips, key elements, concept translations, and related maxims are now all displayed in their respective cards.

> [!NOTE]
> **3. ~~`concept` and `chapter` have no card~~** — FIXED. Both now have dedicated Quick Reference cards.

> [!NOTE]
> **4. Suggested edges remain dormant.** Stored but not surfaced in UI. Planned for future graph intelligence layer.
