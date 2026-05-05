import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Level 3+ roles that can resolve flags
const CAN_RESOLVE = ['recognized', 'senior_scholar', 'steward', 'governance_council'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check that the user has Level 3+ role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !CAN_RESOLVE.includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions — Level 3+ required to resolve flags' }, { status: 403 });
  }

  const { tag_id } = await request.json();
  if (!tag_id) {
    return NextResponse.json({ error: 'Missing tag_id' }, { status: 400 });
  }

  // Get the original flagger's ID before resolving (for reputation award)
  const { data: tag } = await supabase
    .from('inline_tags')
    .select('author_id, resolved')
    .eq('id', tag_id)
    .single();

  if (!tag) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  }

  if (tag.resolved) {
    return NextResponse.json({ error: 'Tag already resolved' }, { status: 400 });
  }

  // Resolve the flag
  const { error } = await supabase
    .from('inline_tags')
    .update({ resolved: true })
    .eq('id', tag_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Award +2 reputation to the original flagger (flag_resolved)
  // Only award if the flagger is not the person resolving
  if (tag.author_id && tag.author_id !== user.id) {
    try {
      // Use RPC to bypass RLS for cross-user reputation award
      await supabase.rpc('award_reputation_points', {
        p_user_id: tag.author_id,
        p_event_type: 'flag_resolved',
        p_points: 2,
        p_source_id: tag_id,
        p_source_type: 'inline_tag',
        p_description: 'Flagged issue was subsequently resolved by a reviewer',
      });
    } catch (err) {
      // Non-critical — don't fail the resolve action
      console.error('[resolve-tag] Failed to award flag reputation:', err);
    }
  }

  return NextResponse.json({ success: true });
}
