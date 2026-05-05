# Node Metadata Reference — Complete Specification

> [!NOTE]
> This document describes **exactly** what metadata is saved for each node type, how it gets there, and how it's displayed in the Quick Reference card on the Topic Page sidebar.

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
| **1. Create** | User writes article text, picks a `node_type`. Node is inserted with `metadata = {}` | [actions.ts](file:///c:/Users/Nipun/OneDrive/Desktop/Legal%20Platfrom%20-%20AG/src/app/topic/new/actions.ts) |
| **2. Extract** | `extractMetadata(nodeId)` is called fire-and-forget. AI reads the article and returns structured JSON | [extract-metadata.ts](file:///c:/Users/Nipun/OneDrive/Desktop/Legal%20Platfrom%20-%20AG/src/utils/ai/extract-metadata.ts) |
| **3. Store** | Extracted JSON is saved to `nodes.metadata` (JSONB column). System fields `_extracted_at`, `_extraction_model`, `_suggested_edges` are appended | Same file, lines 256–265 |
| **4. Display** | Topic Page reads `node.metadata` and renders a type-specific Quick Reference card in the right sidebar | [page.tsx](file:///c:/Users/Nipun/OneDrive/Desktop/Legal%20Platfrom%20-%20AG/src/app/topic/%5Bslug%5D/page.tsx) |
| **5. Re-extract** | On every edit/revision, extraction re-runs and overwrites the metadata | [edit/actions.ts](file:///c:/Users/Nipun/OneDrive/Desktop/Legal%20Platfrom%20-%20AG/src/app/topic/%5Bslug%5D/edit/actions.ts) |

---

## Database Column

All metadata lives in a **single JSONB column** on the `nodes` table:

```sql
ALTER TABLE public.nodes 
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
```

The structure of the JSON varies by `node_type`. Every value below is **conditionally present** — the AI only includes fields it can extract from the article text.

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
| `date_of_enactment` | `string` (ISO date) | `"2023-12-25"` | Date passed by legislature |
| `date_of_enforcement` | `string` (ISO date) | `"2024-07-01"` | Date the Act came into force |
| `legislative_list` | `string` enum | `"concurrent"` | One of: `union`, `state`, `concurrent`, `residuary` |
| `status` | `string` enum | `"in_force"` | One of: `in_force`, `repealed`, `partially_repealed` |
| `replaces` | `string` | `"Indian Penal Code, 1860"` | Human-readable name of the Act it replaced |

#### Quick Reference Card Display

The statute card displays when `nodeType === 'statute' && metadata.short_title` is truthy. Fields shown:

| Card Row | Source Field |
|----------|-------------|
| **Short Title** | `metadata.short_title` |
| **Act No.** | `metadata.act_number` (if present) |
| **List** | `metadata.legislative_list` (if present, capitalized) |
| **Enacted** | `metadata.date_of_enactment` (if present) |

> [!NOTE]
> `full_title`, `date_of_enforcement`, `status`, and `replaces` are **saved but NOT displayed** in the Quick Reference card currently.

---

### 2. `chapter` — Structural Division Within a Statute

**Icon**: 📖 &nbsp; **Color**: `#6366f1` (indigo)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `chapter_number` | `string` | `"VI"` | Chapter/Part number |
| `chapter_title` | `string` | `"Offences Affecting the Human Body"` | Official chapter title |
| `parent_statute` | `string` | `"Bharatiya Nyaya Sanhita, 2023"` | Name of the parent Act |

#### Quick Reference Card Display

**No dedicated card.** Chapter nodes do not have a specific Quick Reference card template. If metadata exists, it falls through with no special rendering.

---

### 3. `section` — Single Provision Within a Statute

**Icon**: § &nbsp; **Color**: `#3b82f6` (blue)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `section_number` | `string` | `"103"` | Section number within the Act |
| `bare_act_text` | `string` | `"Whoever causes death by doing an act with the intention..."` | Exact statutory text |
| `essentials` | `string[]` | `["Causing death", "Intention to cause death", ...]` | Each element/ingredient of the provision |
| `punishment` | `string` | `"Death or imprisonment for life, and fine"` | Prescribed punishment |
| `cognizable` | `boolean` | `true` | Whether the offence is cognizable |
| `bailable` | `boolean` | `false` | Whether the offence is bailable |
| `compoundable` | `boolean` | `false` | Whether the offence is compoundable |
| `parent_statute` | `string` | `"Bharatiya Nyaya Sanhita, 2023"` | Name of parent Act |
| `enforcement_status` | `string` enum | `"in_force"` | One of: `in_force`, `repealed` |

#### Quick Reference Card Display

The section card displays when `nodeType === 'section' && metadata.bare_act_text` is truthy. Fields shown:

| Card Row | Source Field |
|----------|-------------|
| **Header** | `"§ Provision"` + `"Section {metadata.section_number}"` |
| **Bare Act Text** | `metadata.bare_act_text` (full text block) |
| **Punishment** | `metadata.punishment` (if present) |

> [!NOTE]
> `essentials`, `cognizable`, `bailable`, `compoundable`, `parent_statute`, and `enforcement_status` are **saved but NOT displayed** in the Quick Reference card currently.

---

### 4. `constitutional_provision` — Article / Schedule of the Constitution

**Icon**: 🏛 &nbsp; **Color**: `#0ea5e9` (sky blue)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `article_number` | `string` | `"21"` | Article number |
| `bare_text` | `string` | `"No person shall be deprived of his life..."` | Exact constitutional text |
| `part` | `string` | `"Part III — Fundamental Rights"` | Part/chapter of the Constitution |
| `amendment_details` | `string` | `"Inserted by Constitution (44th Amendment) Act, 1978"` | Relevant amendment info |

> [!IMPORTANT]
> Note the field is `bare_text` (not `bare_act_text`). But the display code checks for `metadata.bare_act_text`. This means the constitutional provision card **may not render correctly** unless the AI happens to use `bare_act_text` instead of `bare_text`.

#### Quick Reference Card Display

Shares the same card template as `section`. Displays when `nodeType === 'constitutional_provision' && metadata.bare_act_text` is truthy:

| Card Row | Source Field |
|----------|-------------|
| **Header** | `"🏛 Article"` + `"Art. {metadata.section_number}"` |
| **Bare Act Text** | `metadata.bare_act_text` (full text block) |
| **Punishment** | `metadata.punishment` (if present — typically N/A for articles) |

> [!WARNING]
> There is a field naming mismatch: the AI extraction schema uses `article_number` and `bare_text`, but the display code reads `section_number` and `bare_act_text`. This is a known inconsistency.

---

### 5. `judgment` — Court Decision

**Icon**: ⚖️ &nbsp; **Color**: `#f59e0b` (amber)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `case_name` | `string` | `"Maneka Gandhi v. Union of India"` | Full case name |
| `citations` | `string[]` | `["AIR 1978 SC 597", "(1978) 1 SCC 248"]` | Standard legal citations |
| `court` | `string` | `"Supreme Court of India"` | Normalized court name |
| `bench_type` | `string` enum | `"Constitution Bench"` | One of: `Single Judge`, `Division Bench`, `Full Bench`, `Constitution Bench` |
| `bench_strength` | `number` | `7` | Number of judges on the bench |
| `judges` | `string[]` | `["M.H. Beg CJ", "Y.V. Chandrachud", ...]` | Names of judges |
| `date_of_judgment` | `string` (ISO date) | `"1978-01-25"` | Date the judgment was delivered |
| `ratio_decidendi` | `string` | `"The right to travel abroad is part of personal liberty..."` | Core legal principle (1–2 sentences) |
| `case_status` | `string` enum | `"good_law"` | One of: `good_law`, `overruled`, `partially_overruled`, `doubted` |
| `significance` | `string` | `"Expanded Article 21 from a narrow, literal interpretation..."` | Why this case matters |

> [!NOTE]
> The AI prompt also asks for `petitioner` and `respondent`, but these are **not in the extraction schema prompt** sent to the model — they are only in the design document. The extraction prompt schema for `judgment` does NOT include them.

#### Quick Reference Card Display

The judgment card is the **most detailed** card. Displays when `nodeType === 'judgment' && metadata._extracted_at` is truthy:

| Card Row | Source Field |
|----------|-------------|
| **Case** | `metadata.case_name` |
| **Citation** | `metadata.citations` (array joined with `, `) or `metadata.citation` (string fallback) |
| **Court** | `metadata.court` |
| **Bench** | `metadata.bench_type` or `metadata.bench`, plus `({bench_strength} Judges)` if present |
| **Date** | `metadata.date_of_judgment` (formatted as `25 Jan 1978`) |
| **Status** | `metadata.case_status` → mapped to a colored pill badge |
| **Ratio Decidendi** | `metadata.ratio_decidendi` (separate highlighted box) |

**Case Status Badges:**

| Status | Label | Color |
|--------|-------|-------|
| `good_law` | ✅ Good Law | `#34d399` (green) |
| `overruled` | 🔴 Overruled | `#f87171` (red) |
| `partially_overruled` | 🟡 Partially Overruled | `#fbbf24` (yellow) |
| `doubted` | ⚠️ Doubted | `#fb923c` (orange) |

> [!NOTE]
> `judges`, `significance`, `petitioner`, and `respondent` are **saved but NOT displayed** in the Quick Reference card.

---

### 6. `doctrine` — Judicial Principle from Case Law

**Icon**: 💡 &nbsp; **Color**: `#10b981` (emerald)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `doctrine_name` | `string` | `"Doctrine of Basic Structure"` | Name of the doctrine |
| `origin_case` | `string` | `"Kesavananda Bharati v. State of Kerala (1973)"` | Case where first established |
| `applicable_domains` | `string[]` | `["constitutional"]` | Legal domains where applicable |
| `key_elements` | `string[]` | `["Supremacy of the Constitution", ...]` | Core elements of the doctrine |
| `current_status` | `string` | `"Well-established"` | Current legal standing |

#### Quick Reference Card Display

Displays when `nodeType === 'doctrine'`. A minimal card:

| Card Row | Source Field |
|----------|-------------|
| **Header** | `"💡 Doctrine Details"` |
| **Origin Case** | `metadata.origin_case` (if present) |

> [!NOTE]
> `doctrine_name`, `applicable_domains`, `key_elements`, and `current_status` are **saved but NOT displayed** in the Quick Reference card.

---

### 7. `concept` — Abstract Legal Idea

**Icon**: 🧠 &nbsp; **Color**: `#ec4899` (pink)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `concept_name` | `string` | `"Mens Rea"` | Name of the concept |
| `translation` | `string` | `"Guilty Mind"` | Plain-English translation |
| `applicable_domains` | `string[]` | `["criminal"]` | Legal domains where relevant |
| `related_maxims` | `string[]` | `["Actus non facit reum nisi mens sit rea"]` | Related legal maxims |

#### Quick Reference Card Display

**No dedicated card template.** Concept nodes do not have a specific Quick Reference card. The sidebar just doesn't render anything for this type.

---

### 8. `topic` — Study-Oriented Grouping (Default)

**Icon**: 📝 &nbsp; **Color**: `#64748b` (slate)

#### Metadata Fields Saved

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `key_themes` | `string[]` | `["self-defence", "proportionality", "imminent threat"]` | Main themes covered |
| `related_statutes` | `string[]` | `["Bharatiya Nyaya Sanhita, 2023"]` | Statutes mentioned in article |
| `related_cases` | `string[]` | `["Kesavananda Bharati v. State of Kerala"]` | Cases mentioned in article |

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
> Suggested edges are **stored in metadata** but are **NOT automatically created** as actual edges in the `cross_references` table. They are currently not surfaced in the UI at all.

---

## Complete Field Matrix

A summary of what's saved vs. what's displayed:

| Node Type | Fields Saved | Fields Displayed | Display Condition |
|-----------|-------------|-----------------|-------------------|
| `statute` | 8 | 4 | `metadata.short_title` exists |
| `chapter` | 3 | 0 | No card template |
| `section` | 9 | 3 | `metadata.bare_act_text` exists |
| `constitutional_provision` | 4 | 3 | `metadata.bare_act_text` exists ⚠️ |
| `judgment` | 10 | 7 + ratio box | `metadata._extracted_at` exists |
| `doctrine` | 5 | 1 | Always (if not `topic`) |
| `concept` | 4 | 0 | No card template |
| `topic` | 3 | 0 | Card hidden entirely |

---

## Known Issues & Gaps

> [!WARNING]
> **1. `constitutional_provision` field mismatch:** The AI extraction schema uses `article_number` and `bare_text`, but the display code reads `section_number` and `bare_act_text`. The card may not render unless the AI coincidentally uses the section-style field names.

> [!NOTE]
> **2. Many extracted fields are invisible:** Essentials (for sections), judges list, key elements (for doctrines), concept translations, and related maxims are all extracted and saved but never shown to the user.

> [!NOTE]
> **3. Suggested edges are dormant:** The AI extracts `suggested_edges` on every node but they are stored in metadata and never surfaced in the UI or used to create actual graph edges.

> [!NOTE]
> **4. `concept` and `chapter` have no card:** These node types get metadata extracted but have no Quick Reference card template, so the sidebar shows nothing for them.
