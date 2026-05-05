'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface WelcomeFlowProps {
  username: string;
}

const AREAS_OF_INTEREST = [
  'Constitutional Law',
  'Criminal Law',
  'Jurisprudence',
  'Competition Law',
  'Administrative Law',
  'Human Rights',
  'Environmental Law',
  'Cyber Law',
  'Family Law',
  'Labour Law',
  'International Law',
  'Intellectual Property',
];

export default function WelcomeFlow({ username }: WelcomeFlowProps) {
  const router = useRouter();
  const [layer, setLayer] = useState<1 | 2 | 3>(1);
  const [fadeClass, setFadeClass] = useState('welcome-layer-enter');

  // Layer 3 state
  const [participationRole, setParticipationRole] = useState<string>('');
  const [institution, setInstitution] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const transitionTo = (nextLayer: 1 | 2 | 3) => {
    setFadeClass('welcome-layer-exit');
    setTimeout(() => {
      setLayer(nextLayer);
      setFadeClass('welcome-layer-enter');
    }, 400);
  };

  const handleEnterSiddhant = () => {
    router.push('/explore');
  };

  const handleSaveAndEnter = async () => {
    setIsSaving(true);
    try {
      const supabase = createClient();
      const metadata: Record<string, unknown> = {};
      if (participationRole) metadata.participation_role = participationRole;
      if (institution.trim()) metadata.institution = institution.trim();
      if (selectedInterests.length > 0) metadata.areas_of_interest = selectedInterests;
      metadata.onboarding_completed = true;

      await supabase.auth.updateUser({ data: metadata });
    } catch {
      // Non-blocking — don't prevent entry
    }
    router.push('/explore');
  };

  const handleSkip = () => {
    router.push('/explore');
  };

  const toggleInterest = (area: string) => {
    setSelectedInterests(prev =>
      prev.includes(area)
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  return (
    <div className="welcome-container">
      {/* ===== LAYER 1 — INSTITUTIONAL WELCOME ===== */}
      {layer === 1 && (
        <div className={`welcome-layer ${fadeClass}`}>
          <div className="welcome-institutional">
            <div className="welcome-emblem">§</div>

            <h1 className="welcome-title">Welcome to Siddhant</h1>

            <div className="welcome-philosophy">
              <p>
                Indian law is not static.
              </p>
              <p>
                It evolves through interpretation, disagreement, precedent,
                and doctrinal development.
              </p>
              <p className="welcome-philosophy-emphasis">
                Siddhant documents that evolution collaboratively —
                revision by revision, relationship by relationship.
              </p>
            </div>

            <button
              className="welcome-cta"
              onClick={() => transitionTo(2)}
              id="welcome-enter-archive"
            >
              Enter the Living Archive
              <span className="welcome-cta-arrow">→</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== LAYER 2 — ONE CONTINUOUS JURISPRUDENTIAL NARRATIVE ===== */}
      {layer === 2 && (
        <div className={`welcome-layer ${fadeClass}`}>
          <div className="welcome-narrative">
            <div className="welcome-narrative-header">
              <div className="welcome-section-label">How Legal Meaning Evolves</div>
              <p className="welcome-narrative-intro">
                Constitutional provisions are written once. But their meaning is continuously 
                reinterpreted through judicial reasoning. Siddhant traces that evolution.
              </p>
            </div>

            {/* Constitutional Moment 1 — Origin */}
            <div className="welcome-moment">
              <div className="welcome-moment-era">Constitution, 1950</div>
              <h3 className="welcome-moment-title">Article 21 — Right to Life</h3>
              <blockquote className="welcome-moment-quote">
                &ldquo;No person shall be deprived of his life or personal liberty 
                except according to procedure established by law.&rdquo;
              </blockquote>
              <p className="welcome-moment-note">
                Originally interpreted narrowly — procedural compliance alone sufficed, 
                regardless of whether the procedure itself was fair.
              </p>
            </div>

            {/* Constitutional Moment 2 — Interpretive Shift */}
            <div className="welcome-moment">
              <div className="welcome-moment-era">Maneka Gandhi v. Union of India, 1978</div>
              <h3 className="welcome-moment-title">Procedure Must Be Fair, Just, and Reasonable</h3>
              <p className="welcome-moment-note">
                The Supreme Court held that &ldquo;procedure established by law&rdquo; must satisfy 
                the test of reasonableness — transforming Article 21 from a procedural safeguard 
                into a substantive guarantee of liberty.
              </p>

              {/* Interpretive diff — Siddhant's signature */}
              <div className="welcome-diff">
                <div className="welcome-diff-label">Interpretive Evolution</div>
                <code className="welcome-diff-line removed">
                  Art. 21 requires only that a &quot;procedure established by law&quot; exists.
                </code>
                <code className="welcome-diff-line added">
                  Art. 21 requires that procedure be fair, just, and reasonable — not arbitrary.
                </code>
                <code className="welcome-diff-line added">
                  The right to life includes the right to live with dignity.
                </code>
              </div>

              <aside className="welcome-diff-annotation">
                This is how Siddhant records interpretive evolution — every shift is preserved, compared, and traceable.
              </aside>
            </div>

            {/* Constitutional Moment 3 — Expansion */}
            <div className="welcome-moment">
              <div className="welcome-moment-era">K.S. Puttaswamy v. Union of India, 2017</div>
              <h3 className="welcome-moment-title">Privacy as Intrinsic to Liberty</h3>
              <p className="welcome-moment-note">
                A nine-judge bench unanimously recognized the right to privacy as a fundamental 
                right under Article 21 — privacy of body, mind, information, and choice became 
                constitutionally protected.
              </p>
            </div>

            {/* Doctrinal Relationship Map */}
            <div className="welcome-cartography">
              <div className="welcome-diff-label">Doctrinal Relationships</div>
              <div className="welcome-cartography-flow">
                <div className="welcome-cartography-node primary">
                  <span className="welcome-cartography-icon">🏛</span>
                  Article 21 — Right to Life
                </div>
                
                <div className="welcome-cartography-edge">
                  <div className="welcome-cartography-line" />
                  interpreted by
                  <div className="welcome-cartography-line" />
                </div>

                <div className="welcome-cartography-branches">
                  <div className="welcome-cartography-node">
                    <span className="welcome-cartography-icon">⚖️</span>
                    Maneka Gandhi
                  </div>
                  <div className="welcome-cartography-connector">expanded by</div>
                  <div className="welcome-cartography-node">
                    <span className="welcome-cartography-icon">⚖️</span>
                    Puttaswamy
                  </div>
                  <div className="welcome-cartography-connector">applied in</div>
                  <div className="welcome-cartography-node">
                    <span className="welcome-cartography-icon">⚖️</span>
                    Navtej Johar
                  </div>
                </div>
              </div>

              <p className="welcome-cartography-explanation">
                Legal meaning develops through relationships between authorities. 
                Siddhant maps these connections — making jurisprudential lineage visible and navigable.
              </p>
            </div>

            {/* Contribution Culture */}
            <div className="welcome-contribution-culture">
              <div className="welcome-diff-label">Scholarly Participation</div>
              <div className="welcome-culture-grid">
                <div className="welcome-culture-item">
                  <span className="welcome-culture-icon">✍️</span>
                  <div>
                    <strong>Revise Interpretations</strong>
                    <p>Every contribution becomes part of the permanent scholarly record.</p>
                  </div>
                </div>
                <div className="welcome-culture-item">
                  <span className="welcome-culture-icon">⚖️</span>
                  <div>
                    <strong>Review Doctrinal Claims</strong>
                    <p>Your judgment shapes the quality and credibility of the archive.</p>
                  </div>
                </div>
                <div className="welcome-culture-item">
                  <span className="welcome-culture-icon">🔗</span>
                  <div>
                    <strong>Map Jurisprudential Lineage</strong>
                    <p>Establish the interpretive threads that bind legal concepts together.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="welcome-narrative-actions">
              <button
                className="welcome-cta"
                onClick={() => transitionTo(3)}
                id="welcome-continue-identity"
              >
                Continue
                <span className="welcome-cta-arrow">→</span>
              </button>
              <button
                className="welcome-skip"
                onClick={handleEnterSiddhant}
                id="welcome-skip-to-archive"
              >
                Enter Siddhant →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== LAYER 3 — IDENTITY FORMATION (OPTIONAL) ===== */}
      {layer === 3 && (
        <div className={`welcome-layer ${fadeClass}`}>
          <div className="welcome-identity">
            <div className="welcome-section-label">Scholarly Identity</div>
            <h2 className="welcome-identity-title">
              How would you like to participate in Siddhant?
            </h2>
            <p className="welcome-identity-subtitle">
              This helps us understand our scholarly community. 
              All fields are optional — you can update these later.
            </p>

            {/* Participation Role */}
            <div className="welcome-roles">
              {[
                { value: 'law_student', label: 'Law Student' },
                { value: 'advocate', label: 'Advocate' },
                { value: 'academic', label: 'Academic / Professor' },
                { value: 'researcher', label: 'Researcher' },
                { value: 'public_contributor', label: 'Public Contributor' },
              ].map(role => (
                <button
                  key={role.value}
                  className={`welcome-role-btn ${participationRole === role.value ? 'selected' : ''}`}
                  onClick={() => setParticipationRole(
                    participationRole === role.value ? '' : role.value
                  )}
                  type="button"
                >
                  {role.label}
                </button>
              ))}
            </div>

            {/* Institution */}
            <div className="welcome-field">
              <label className="welcome-field-label">Your Institution</label>
              <input
                type="text"
                className="welcome-field-input"
                placeholder="e.g. National Law School, Bangalore"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
              />
            </div>

            {/* Areas of Interest */}
            <div className="welcome-interests">
              <label className="welcome-field-label">Areas of Interest</label>
              <div className="welcome-interest-grid">
                {AREAS_OF_INTEREST.map(area => (
                  <button
                    key={area}
                    className={`welcome-interest-chip ${selectedInterests.includes(area) ? 'selected' : ''}`}
                    onClick={() => toggleInterest(area)}
                    type="button"
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="welcome-identity-actions">
              <button
                className="welcome-cta"
                onClick={handleSaveAndEnter}
                disabled={isSaving}
                id="welcome-save-enter"
              >
                {isSaving ? 'Saving…' : 'Enter Siddhant'}
                {!isSaving && <span className="welcome-cta-arrow">→</span>}
              </button>
              <button
                className="welcome-skip"
                onClick={handleSkip}
                id="welcome-skip-identity"
              >
                Continue to the Archive →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
