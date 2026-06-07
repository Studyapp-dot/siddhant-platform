'use client';

import React, { useState, useCallback } from 'react';
import { STRUCTURE_TEMPLATES } from '@/app/utils/structureTemplates';

// ============================================================================
// STRUCTURE TEMPLATE OFFER — Suggests pre-built article skeletons
//
// Appears when a node type is selected and content is empty.
// This is a core workflow feature: it removes both formatting friction
// and structural decision-making by offering proven article structures.
// ============================================================================

interface StructureTemplateOfferProps {
  nodeType: string;
  contentLength: number;
  onInsert: (template: string) => void;
}

export default function StructureTemplateOffer({
  nodeType,
  contentLength,
  onInsert,
}: StructureTemplateOfferProps) {
  const [dismissed, setDismissed] = useState(false);

  const template = STRUCTURE_TEMPLATES[nodeType];

  // Don't show if: no template for this type, dismissed, or content already typed
  if (!template || dismissed || contentLength > 20) return null;

  const handleInsert = useCallback(() => {
    onInsert(template.template);
  }, [template, onInsert]);

  return (
    <div className="structure-template-offer">
      <div className="template-offer-header">
        <span className="template-offer-icon">📋</span>
        <span className="template-offer-title">
          Recommended structure for {template.label}
        </span>
      </div>

      <div className="template-offer-sections">
        {template.sections.map((section, i) => (
          <span key={i} className="template-section-chip">
            {section}
          </span>
        ))}
      </div>

      <div className="template-offer-actions">
        <button
          type="button"
          className="template-insert-btn"
          onClick={handleInsert}
        >
          Insert Structure
        </button>
        <button
          type="button"
          className="template-dismiss-btn"
          onClick={() => setDismissed(true)}
        >
          Blank Canvas
        </button>
      </div>
    </div>
  );
}
