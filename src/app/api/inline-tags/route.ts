import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const node_id = formData.get('node_id') as string;
  const tier = parseInt(formData.get('tier') as string);
  const tag_type = formData.get('tag_type') as string;
  const context_quote = formData.get('context_quote') as string | null;

  if (!node_id || !tier || !tag_type) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { error } = await supabase.from('inline_tags').insert({
    node_id,
    author_id: user.id,
    tier,
    tag_type,
    context_quote: context_quote || null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
