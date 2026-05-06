import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { submitRevision } from './actions';
import './edit.css';

function getReportContent(rev: { report_content?: string | null; tier1_content?: string | null } | null): string {
  if (!rev) return '';
  return rev.report_content || rev.tier1_content || '';
}

export default async function EditNodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?error=You must be logged in to edit.');
  }

  const { data: node } = await supabase.from('nodes').select('id, title').eq('slug', slug).single();

  if (!node) {
    redirect('/');
  }

  const { data: revisionRows } = await supabase
    .from('revisions')
    .select('report_content, tier1_content')
    .eq('node_id', node.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const revision = revisionRows?.[0] ?? null;
  const currentReport = getReportContent(revision);

  return (
    <div className="edit-layout">
      <form action={submitRevision} className="edit-container">
        <div className="authoring-canvas">
          <input type="hidden" name="node_id" value={node.id} />
          <input type="hidden" name="slug" value={slug} />

          <div className="canvas-header">
            <span className="workbench-badge">Editor</span>
            <h1 className="drafting-title-static">{node.title}</h1>

            <div className="slug-meta">
              <span>URL Slug:</span>
              <span className="slug-badge">{slug}</span>
            </div>
          </div>

          <div className="drafting-area">
            <textarea
              name="report_content"
              className="workbench-textarea"
              placeholder={"Expand on this topic here...\n\nReview the Summary, refine the Detailed Analysis, or provide more legal commentary."}
              defaultValue={currentReport}
              required
            />
          </div>

          <div className="drafting-footer">
            <div className="commit-box structured-commit-box">
              <label className="commit-label">Contribution Summary</label>
              
              <div className="commit-grid" style={{ marginBottom: '12px' }}>
                <div>
                  <label className="commit-sublabel">Contribution Type</label>
                  <select 
                    name="contribution_type" 
                    className="commit-input"
                    required
                    style={{ appearance: 'auto', background: 'rgba(0,0,0,0.2)' }}
                  >
                    <option value="" disabled selected>Select Type...</option>
                    <option value="Clarification">Clarification</option>
                    <option value="Expansion">Expansion</option>
                    <option value="Citation Addition">Citation Addition</option>
                    <option value="Contradiction Resolution">Contradiction Resolution</option>
                    <option value="Structural Reorganization">Structural Reorganization</option>
                    <option value="Jurisdictional Update">Jurisdictional Update</option>
                    <option value="Case Law Addition">Case Law Addition</option>
                    <option value="Doctrinal Refinement">Doctrinal Refinement</option>
                  </select>
                </div>
              </div>

              <label className="commit-sublabel">Scholarly Summary</label>
              <textarea
                name="scholarly_summary"
                className="commit-input"
                placeholder="Short explanation of the intent behind this contribution..."
                style={{ resize: 'vertical', minHeight: '60px' }}
                minLength={10}
                required
              />
            </div>

            <div className="drafting-actions">
              <button type="submit" className="submit-revision-btn">
                Publish Revision
              </button>
              <Link href={`/topic/${slug}`} className="cancel-btn">Discard</Link>
            </div>
          </div>
        </div>

        <aside className="guidance-sidebar">
          <div className="sidebar-card gold-scaffold">
            <h3>Structure Reference</h3>
            <ol className="structure-list">
              <li className="structure-item">
                <span className="item-num">01</span>
                <span className="item-text">
                  <span className="item-label">The Lead</span>
                  2 to 4 sentences defining the concept. The &quot;essential knowledge.&quot;
                </span>
              </li>
              <li className="structure-item">
                <span className="item-num">02</span>
                <span className="item-text">
                  <span className="item-label">Doctrine &amp; Authority</span>
                  Ground your claims. Cite landmark judgments, statutory text, and primary sources.
                </span>
              </li>
              <li className="structure-item">
                <span className="item-num">03</span>
                <span className="item-text">
                  <span className="item-label">Jurisprudence</span>
                  The evolution of the law. Legislative intent, exceptions, and academic commentary.
                </span>
              </li>
            </ol>
          </div>

          <div className="sidebar-card">
            <h3>Editing Guidelines</h3>
            <p>Every edit is a permanent contribution to your verifiable professional record.</p>
            <ul className="structure-list" style={{ opacity: 0.7, fontSize: '0.78rem' }}>
              <li>• <strong>Verifiability:</strong> Ground claims in reliable sources.</li>
              <li>• <strong>Neutrality:</strong> Summarize established law without bias.</li>
              <li>• <strong>Clarity:</strong> Write to make the law accessible to all.</li>
            </ul>

            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--surface-border)' }}>
              <Link
                href={`/topic/${slug}/edges`}
                style={{ color: 'var(--color-navy)', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Manage Doctrinal Relationships
              </Link>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
