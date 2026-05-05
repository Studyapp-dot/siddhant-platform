# Siddhant Platform: Visual Legend & Reference Guide

Welcome to the Siddhant Knowledge Graph! Because our platform maps complex legal concepts, we use colors, sizes, and shapes to give you immediate context at a glance.

This document is your "Cheat Sheet" for understanding what every color, line, and node means.

---

## 1. Nodes (The Dots/Circles)
Nodes represent the actual documents, cases, or concepts in the platform. They are color-coded based on the exact type of legal authority they represent.

| Node Type | Icon | Color Family | Visual Size | Description |
| :--- | :---: | :--- | :---: | :--- |
| **Statute / Act** | 📜 | **Purple** (#8b5cf6) | **1.40x** (Massive) | Entire legislative acts (e.g., The Competition Act). Anchors the graph. |
| **Chapter** | 📖 | **Indigo** (#6366f1) | **1.15x** (Large) | A structural grouping within a Statute (e.g., Chapter II). |
| **Constitutional Prov.**| 🏛 | **Sky Blue** (#0ea5e9) | **1.10x** (Large) | Articles of the Constitution of India. |
| **Judgment / Case** | ⚖️ | **Amber/Orange** (#f59e0b)| **1.05x** (Medium+) | Important court decisions (e.g., Maneka Gandhi). |
| **Section** | § | **Blue** (#3b82f6) | **1.00x** (Baseline) | Highly specific operative laws where the actual rules are written. |
| **Doctrine** | 💡 | **Emerald** (#10b981) | **0.95x** (Medium) | Court-created principles (e.g., Doctrine of Basic Structure). |
| **Concept** | 🧠 | **Pink** (#ec4899) | **0.90x** (Small) | Abstract legal ideas or academic theories. |
| **Topic** | 📝 | **Slate / Grey** (#64748b)| **0.85x** (Smallest) | General landing pages or unclassified broad categories. |

*Graph Physical Mechanics:* The platform automatically scales node sizes to visually communicate hierarchical weight. For instance, a **Statute** is visually designed to look like the "sun" holding together smaller orbiting **Sections** and **Judgments**, which naturally draws your eye to the primary, foundational source of law before moving into the specifics.

---

## 2. Relationships / Edges (The Lines)
Edges are the lines connecting two nodes. They represent *how* the two nodes interact. 
- The line is slightly **curved** so that you can see multiple relationships between the same two nodes.
- The arrow always points **from the citing source to the cited authority** (e.g., Judgment A ---> overruled ---> Judgment B).

The lines are color-coded by their "Family" of legal interaction. Here is the complete list of all 25 supported relationships:

### 🔴 Red/Pink (Negative Judicial Treatment)
Used when a court attacks or diminishes past precedent.
*   **overruled**: A higher bench has completely struck down the target case.
*   **doubted**: A court expressed reservations but didn't officially overrule.
*   **not_followed**: A court declined to apply a precedent without necessarily overturning it.

### 🟢 Green (Positive Judicial Treatment)
Used when a court affirms or relies heavily on past precedent.
*   **followed**: A direct application of the precedent's binding rule (ratio).
*   **applied**: Using the prior rule in a new factual context.
*   **approved**: Explicit endorsement of a lower court's decision.

### 🟡 Amber / Yellow (Neutral Judicial Context)
Used when a court engages with a precedent without destroying or entirely endorsing it.
*   **distinguished**: "That case is good law, but it doesn't apply to these different material facts."
*   **explained**: Clarifying the scope or meaning of an older case.
*   **referred_to**: Mentioned in passing without heavy reliance or substantive treatment.

### 🟣 Purple (Legislative & Authority Action)
Used when parliament modifies the law, or to show hierarchy of authority.
*   **amends**: Changing an existing Section / Act.
*   **replaces**: A new law taking the place of an old one.
*   **repeals**: Completely removing an older law from the books.
*   **overrides**: A statutory rule that explicitly knocks out a prior doctrine or rule.
*   **subordinate_to**: Used to show that rules/regulations draw their power from a parent Act.

### 🔵 Blue (Conceptual & Intellectual)
Used when cases interpret rules, or when abstract concepts relate to each other.
*   **interprets**: E.g., A Judgment interprets the meaning of a Section.
*   **establishes**: E.g., A Judgment establishes a new legal test or Doctrine.
*   **codifies**: E.g., A new Statute codifies a previously unwritten judge-made Doctrine.
*   **prerequisite**: A concept that must be proven before another can apply.
*   **distinguish_from**: Comparing two similar but distinct academic concepts.
*   **related_to**: A general intellectual link between topics.
*   **exception_to**: E.g., Section 300 Exception 1 is an exception to the general rule.
*   **governed_by**: E.g., A specific procedure is governed by a specific code.
*   **analogous_to**: Two concepts that act similarly in different domains of law.

### ⚪ Slate Grey (Structural)
Used purely for hierarchy and organization of the law itself.
*   **part_of**: E.g., Section 3 is Part Of Chapter I.
*   **grouped_with**: Items that sit alongside each other for administrative purposes.

---

## 3. Case Status (Judgment Pages)
When reading a **Judgment Page**, you will see a badge indicating whether it is safe to cite in court today.

*   ✅ **Good Law** (Green): Active and uncontested.
*   ⚠️ **Doubted** (Orange): Still technically valid, but on shaky ground.
*   🟡 **Partially Overruled** (Yellow): Specific parts of the judgment are dead; tread carefully.
*   🔴 **Overruled** (Red): Dead law. Avoid citing except for historical context.

---

## 4. Quality Reputations (Platform Content)
Because this platform is community-built, we measure the trustworthiness of an article based on how heavily the peer-review process has vetted it. 
Look below the title of any article for its Quality Tier:

1.  **Draft — Pending Community Review** (Orange): Written by 1 or 2 people. Has barely been double-checked. Read with caution!
2.  **Early Edits · Review Recommended** (Yellow): A few people have touched it. It's getting better, but still fresh.
3.  **Actively Maintained · Peer Reviewed** (Green): A dozen commits. Highly reliable and constantly updated by peers.
4.  **Stable · Extensively Reviewed** (Purple): The gold standard. Vigorously debated and locked-in by the community. You can take this to the bank.
