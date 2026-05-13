# Siddhant — Architectural Invariants

These invariants define the institutional boundaries of the Siddhant platform.
They must be preserved across all future development. Any proposed change that
violates an invariant requires explicit governance review and documented justification.

---

## Revision Invariants

1. **Formatting-only changes do not create revisions.**
   Infrastructure tokens (section slugs, whitespace normalization) and formatting
   mutations are not revision-worthy. If no visible scholarly content changes,
   no revision exists.

2. **Infrastructure-only mutations do not affect reputation.**
   Reputation metrics reflect scholarly contribution, not persistence metadata.
   Section slug injection, whitespace collapse, and markdown normalization are
   invisible to the reputation system.

3. **Revisions reflect visible scholarly contribution.**
   The `content_size` column measures visible text after stripping markdown syntax
   and infrastructure tokens. This is the canonical metric for contribution size.

4. **Authority deletions are auditable.**
   Authority anchors use soft delete (`deleted_at`, `deleted_by`). Hard deletion
   of scholarly grounding references is prohibited. The audit trail is permanent.

5. **Ontology mutations require governance.**
   Node type reclassification requires Level 3+ (Recognized Contributor) permission.
   This prevents uncontrolled topology changes in the knowledge graph.

6. **Heading renames preserve section identity.**
   Section slugs are infrastructure identifiers, not display labels. When an author
   renames a heading, the slug persists — protecting cross-references, edge
   stability, and section history continuity.

---

## AI Invariants

7. **AI never mutates authored prose.**
   AI extraction produces derived metadata only. It does not modify, rewrite,
   or inject content into the authored markdown layer.

8. **AI extraction is derived-only.**
   All AI-produced data (`metadata`, `revision_semantics`) is regenerable from
   the authored content. Loss of AI-derived data does not constitute data loss.

9. **AI metadata is replaceable and regenerable.**
   If AI extraction produces incorrect results, the metadata can be re-extracted
   from the same content without loss. Authored content remains the canonical
   source of truth.

10. **Authored content remains canonical.**
    The `revisions.report_content` field is the single source of truth for
    scholarly content. All derived data (metadata, semantics, embeddings) flows
    from this field and can be reconstructed from it.

11. **Infrastructure mutation never triggers AI.**
    Changes that only affect infrastructure tokens (section slugs, whitespace,
    markdown formatting) must never trigger metadata extraction, semantic
    extraction, hash updates, or any AI-derived computation. The authored
    scholarly layer and infrastructure layer are separated.

---

## Content Identity Invariants

12. **Visible-text identity determines revision identity.**
    Two revisions with identical normalized visible text are considered the
    same contribution. The normalization strips section slugs and collapses
    whitespace so that infrastructure churn doesn't create phantom revisions.

13. **Content hash is computed on normalized visible text.**
    The SHA-256 hash used for AI gating is derived from visible text after
    stripping markdown syntax and infrastructure tokens — not from raw markdown.
    This ensures formatting changes don't invalidate the hash.

---

## Infrastructure Separation

14. **Section slugs are hidden from the editor UI.**
    Authors edit clean prose. Infrastructure identifiers (`{#sec_xxxx}`) are
    stripped before editor hydration and reattached on save using position-based
    mapping from the original heading order.

15. **Infrastructure tokens are excluded from visible contribution metrics.**
    Because revisions should reflect scholarly prose, not persistence metadata.
    Character counts, content hashes, and delta calculations all operate on
    the visible text layer, not the raw stored markdown.
