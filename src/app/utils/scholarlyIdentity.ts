export interface ScholarlyIdentity {
  username?: string | null;
  full_display_name?: string | null;
  institution_name?: string | null;
  scholarly_role?: string | null;
  areas_of_interest?: string[] | null;
  short_bio?: string | null;
  profile_photo?: string | null;
  linkedin_url?: string | null;
}

export const SCHOLARLY_ROLE_OPTIONS = [
  'Law Student',
  'Advocate',
  'Academic',
  'Researcher',
  'Independent Scholar',
] as const;

export type ScholarlyRole = (typeof SCHOLARLY_ROLE_OPTIONS)[number];

export function displayNameFor(identity: ScholarlyIdentity): string {
  return identity.full_display_name?.trim()
    || identity.username?.trim()
    || 'Siddhant contributor';
}

export function handleFor(identity: ScholarlyIdentity): string {
  return identity.username ? `@${identity.username}` : '@contributor';
}

export function initialFor(identity: ScholarlyIdentity): string {
  return displayNameFor(identity).charAt(0).toUpperCase();
}

export function identityLineFor(identity: ScholarlyIdentity): string {
  return [
    identity.institution_name?.trim(),
    identity.scholarly_role?.trim(),
  ].filter(Boolean).join(' - ');
}

export function interestLineFor(identity: ScholarlyIdentity, limit = 3): string {
  return (identity.areas_of_interest || [])
    .map(area => area.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(' - ');
}

export function hasProfileDepth(identity: ScholarlyIdentity): boolean {
  return Boolean(
    identity.full_display_name?.trim()
    || identity.institution_name?.trim()
    || identity.scholarly_role?.trim()
    || identity.short_bio?.trim()
    || (identity.areas_of_interest && identity.areas_of_interest.length > 0)
  );
}

export function normalizeOptionalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
