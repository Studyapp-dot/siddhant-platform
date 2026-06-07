// ============================================================================
// STRUCTURE TEMPLATES — Per-node-type article skeletons
//
// Separated from the UI component so templates can be updated
// without touching component code. Add, remove, or reorder sections
// by editing the template strings below.
// ============================================================================

export interface StructureTemplate {
  /** Human-readable label for the template card */
  label: string;
  /** Short preview of sections (shown as chips) */
  sections: string[];
  /** The full markdown template inserted into the editor */
  template: string;
}

/**
 * Templates keyed by node_type value.
 * Node types without a template (e.g., 'topic', 'chapter') intentionally
 * omit an entry — the editor will not offer a template for those types.
 */
export const STRUCTURE_TEMPLATES: Record<string, StructureTemplate> = {
  section: {
    label: 'Section / Provision',
    sections: ['Bare Text', 'Explanation', 'Essentials', 'Key Cases', 'Exceptions'],
    template: `## Bare Text

:::legal

:::

## Explanation

## Essentials

## Key Cases

## Exceptions
`,
  },

  judgment: {
    label: 'Judgment / Case',
    sections: ['Facts', 'Issues', 'Arguments', 'Judgment', 'Reasoning', 'Ratio Decidendi', 'Obiter Dicta'],
    template: `## Facts

## Issues

## Arguments

## Judgment

## Reasoning

## Ratio Decidendi

## Obiter Dicta
`,
  },

  statute: {
    label: 'Statute / Act',
    sections: ['Overview', 'Object and Scope', 'Key Provisions', 'Amendments', 'Judicial Interpretation'],
    template: `## Overview

## Object and Scope

## Key Provisions

## Amendments

## Judicial Interpretation
`,
  },

  constitutional_provision: {
    label: 'Constitutional Provision',
    sections: ['Text', 'Historical Context', 'Scope and Application', 'Key Judgments'],
    template: `## Text

:::legal

:::

## Historical Context

## Scope and Application

## Key Judgments
`,
  },

  doctrine: {
    label: 'Doctrine',
    sections: ['Origin', 'Principle', 'Elements', 'Application', 'Key Cases', 'Criticism'],
    template: `## Origin

## Principle

## Elements

## Application

## Key Cases

## Criticism
`,
  },

  concept: {
    label: 'Concept',
    sections: ['Definition', 'Elements', 'Application', 'Related Concepts', 'Key Cases'],
    template: `## Definition

## Elements

## Application

## Related Concepts

## Key Cases
`,
  },
};
