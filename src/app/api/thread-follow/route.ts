import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { discussion_id } = await request.json();
  if (!discussion_id) {
    return NextResponse.json({ error: 'Missing discussion_id' }, { status: 400 });
  }

  // Check if already following
  const { data: existing } = await supabase
    .from('thread_follows')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('discussion_id', discussion_id)
    .maybeSingle();

  if (existing) {
    // Toggle off — unfollow
    const { error } = await supabase
      .from('thread_follows')
      .delete()
      .eq('user_id', user.id)
      .eq('discussion_id', discussion_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ following: false });
  } else {
    // Follow
    const { error } = await supabase
      .from('thread_follows')
      .insert({ user_id: user.id, discussion_id });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ following: true });
  }
}
