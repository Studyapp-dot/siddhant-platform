'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
  LEGAL_INTEREST_OPTIONS,
  SCHOLARLY_ROLE_OPTIONS,
  initialFor,
  normalizeOptionalUrl,
} from '@/app/utils/scholarlyIdentity';

interface EditableProfile {
  id: string;
  username: string;
  full_display_name: string;
  institution_name: string;
  scholarly_role: string;
  areas_of_interest: string[];
  short_bio: string;
  profile_photo: string;
  linkedin_url: string;
}

interface ProfileEditFormProps {
  initialProfile: EditableProfile;
}

export default function ProfileEditForm({ initialProfile }: ProfileEditFormProps) {
  const router = useRouter();
  const [fullDisplayName, setFullDisplayName] = useState(initialProfile.full_display_name);
  const [institution, setInstitution] = useState(initialProfile.institution_name);
  const [scholarlyRole, setScholarlyRole] = useState(initialProfile.scholarly_role);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(initialProfile.areas_of_interest || []);
  const [shortBio, setShortBio] = useState(initialProfile.short_bio);
  const [profilePhoto, setProfilePhoto] = useState(initialProfile.profile_photo);
  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile.linkedin_url);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const previewIdentity = useMemo(() => ({
    username: initialProfile.username,
    full_display_name: fullDisplayName,
    profile_photo: profilePhoto,
  }), [fullDisplayName, initialProfile.username, profilePhoto]);

  const toggleInterest = (area: string) => {
    setSelectedInterests(prev =>
      prev.includes(area)
        ? prev.filter(item => item !== area)
        : [...prev, area]
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');

    const normalizedLinkedinUrl = normalizeOptionalUrl(linkedinUrl);
    const normalizedProfilePhoto = normalizeOptionalUrl(profilePhoto);
    const updates = {
      full_display_name: fullDisplayName.trim() || null,
      institution_name: institution.trim() || null,
      scholarly_role: scholarlyRole || null,
      areas_of_interest: selectedInterests,
      short_bio: shortBio.trim() || null,
      profile_photo: normalizedProfilePhoto,
      linkedin_url: normalizedLinkedinUrl,
    };

    try {
      const supabase = createClient();
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', initialProfile.id);

      if (profileError) throw profileError;

      await supabase.auth.updateUser({
        data: {
          ...updates,
          onboarding_completed: true,
        },
      });

      router.push(`/profile/${initialProfile.username}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Profile could not be saved.');
      setIsSaving(false);
    }
  };

  return (
    <form className="profile-edit-form" onSubmit={handleSubmit}>
      <header className="profile-edit-header">
        <div>
          <span className="context-label">Profile Settings</span>
          <h1 className="scholarly-title">Edit Profile</h1>
        </div>
        <Link href={`/profile/${initialProfile.username}`} className="profile-edit-secondary">
          View Profile
        </Link>
      </header>

      <section className="profile-edit-grid">
        <aside className="profile-edit-preview">
          <div
            className="profile-edit-avatar"
            style={profilePhoto ? { backgroundImage: `url(${profilePhoto})` } : undefined}
          >
            {!profilePhoto && initialFor(previewIdentity)}
          </div>
          <h2>{fullDisplayName.trim() || initialProfile.username}</h2>
          <p>@{initialProfile.username}</p>
        </aside>

        <div className="profile-edit-fields">
          <label className="profile-edit-field">
            <span>Full Name</span>
            <input
              type="text"
              value={fullDisplayName}
              onChange={event => setFullDisplayName(event.target.value)}
              placeholder="Vipin Gupta"
            />
          </label>

          <label className="profile-edit-field">
            <span>University / Institution</span>
            <input
              type="text"
              value={institution}
              onChange={event => setInstitution(event.target.value)}
              placeholder="Faculty of Law, Delhi University"
            />
          </label>

          <div className="profile-edit-field">
            <span>Scholarly Role</span>
            <div className="profile-edit-options">
              {SCHOLARLY_ROLE_OPTIONS.map(role => (
                <button
                  key={role}
                  type="button"
                  className={scholarlyRole === role ? 'selected' : ''}
                  onClick={() => setScholarlyRole(scholarlyRole === role ? '' : role)}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="profile-edit-field">
            <span>Constitutional and Legal Interests</span>
            <div className="profile-edit-interest-grid">
              {LEGAL_INTEREST_OPTIONS.map(area => (
                <button
                  key={area}
                  type="button"
                  className={selectedInterests.includes(area) ? 'selected' : ''}
                  onClick={() => toggleInterest(area)}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <label className="profile-edit-field">
            <span>Short Scholarly Bio</span>
            <textarea
              value={shortBio}
              onChange={event => setShortBio(event.target.value)}
              rows={4}
              placeholder="Briefly describe your scholarly orientation or current legal interests."
            />
          </label>

          <label className="profile-edit-field">
            <span>Profile Photo URL</span>
            <input
              type="text"
              value={profilePhoto}
              onChange={event => setProfilePhoto(event.target.value)}
              placeholder="https://..."
            />
          </label>

          <label className="profile-edit-field">
            <span>LinkedIn URL</span>
            <input
              type="text"
              value={linkedinUrl}
              onChange={event => setLinkedinUrl(event.target.value)}
              placeholder="https://www.linkedin.com/in/..."
            />
          </label>

          {errorMessage && (
            <div className="profile-edit-error" role="alert">
              {errorMessage}
            </div>
          )}

          <div className="profile-edit-actions">
            <button type="submit" className="profile-edit-primary" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}
