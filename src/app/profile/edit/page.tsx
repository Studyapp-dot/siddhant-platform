import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import ProfileEditForm from './ProfileEditForm';
import '../[username]/profile.css';
import './profile-edit.css';

const PROFILE_EDIT_SELECT = 'id, username, full_display_name, institution_name, scholarly_role, areas_of_interest, short_bio, profile_photo, linkedin_url';

export default async function EditProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(PROFILE_EDIT_SELECT)
    .eq('id', user.id)
    .maybeSingle();

  const fallbackUsername = user.user_metadata?.username || user.email?.split('@')[0] || 'Scholar';

  return (
    <main className="profile-edit-shell">
      <ProfileEditForm
        initialProfile={{
          id: user.id,
          username: profile?.username || fallbackUsername,
          full_display_name: profile?.full_display_name || user.user_metadata?.full_display_name || user.user_metadata?.full_name || user.user_metadata?.name || '',
          institution_name: profile?.institution_name || '',
          scholarly_role: profile?.scholarly_role || '',
          areas_of_interest: profile?.areas_of_interest || [],
          short_bio: profile?.short_bio || '',
          profile_photo: profile?.profile_photo || user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
          linkedin_url: profile?.linkedin_url || '',
        }}
      />
    </main>
  );
}
