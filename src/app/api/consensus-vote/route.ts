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

  // Check if the user has already voted
  const { data: existing } = await supabase
    .from('consensus_votes')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('discussion_id', discussion_id)
    .maybeSingle();

  if (existing) {
    // Toggle off — remove the vote
    const { error } = await supabase
      .from('consensus_votes')
      .delete()
      .eq('user_id', user.id)
      .eq('discussion_id', discussion_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return updated count
    const { count } = await supabase
      .from('consensus_votes')
      .select('user_id', { count: 'exact', head: true })
      .eq('discussion_id', discussion_id);

    return NextResponse.json({ voted: false, count: count ?? 0 });
  } else {
    // Insert vote
    const { error } = await supabase
      .from('consensus_votes')
      .insert({ user_id: user.id, discussion_id });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count } = await supabase
      .from('consensus_votes')
      .select('user_id', { count: 'exact', head: true })
      .eq('discussion_id', discussion_id);

    return NextResponse.json({ voted: true, count: count ?? 0 });
  }
}
