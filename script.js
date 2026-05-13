
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data: anchors } = await supabase.from('authority_anchors').select('*');
  console.log(JSON.stringify(anchors, null, 2));
}
run();

