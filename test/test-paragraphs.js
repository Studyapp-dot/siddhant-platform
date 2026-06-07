// ============================================================================
// PARAGRAPH SYSTEM — End-to-end database test
// 
// Tests: create, edit, revision, history, revert, renumbering
// Uses Supabase service_role to bypass RLS for test setup/teardown
// ============================================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually (no dotenv dependency)
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.substring(0, eqIdx);
  const value = trimmed.substring(eqIdx + 1);
  process.env[key] = value;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Use a real node and user from the database (foreign key compliance)
const TEST_NODE_ID = '705aebcd-4c30-4bdf-9e90-a78dcad82277'; // trade-mark-law
const TEST_USER_ID = 'f215484a-81f3-4a14-b120-98e3a9ddd7f4';

function generateStableId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'p_';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function checkTablesExist() {
  const { data, error } = await supabase
    .from('paragraphs')
    .select('id')
    .limit(1);
  
  if (error && error.code === '42P01') {
    console.error('ERROR: paragraphs table does not exist.');
    console.error('Please run paragraph_schema.sql in Supabase SQL Editor first.');
    process.exit(1);
  }
  if (error && error.message.includes('does not exist')) {
    console.error('ERROR: paragraphs table does not exist.');
    console.error('Please run paragraph_schema.sql in Supabase SQL Editor first.');
    process.exit(1);
  }
  console.log('✓ paragraphs table exists');
  
  const { error: revError } = await supabase
    .from('paragraph_revisions')
    .select('id')
    .limit(1);
  
  if (revError && (revError.code === '42P01' || revError.message.includes('does not exist'))) {
    console.error('ERROR: paragraph_revisions table does not exist.');
    process.exit(1);
  }
  console.log('✓ paragraph_revisions table exists');
}

async function cleanup() {
  // Delete test data from previous runs
  await supabase.from('paragraph_revisions').delete().eq('node_id', TEST_NODE_ID);
  await supabase.from('paragraphs').delete().eq('node_id', TEST_NODE_ID);
  console.log('✓ Cleaned up previous test data');
}

async function createParagraph(content, marginalNote, groupLabel, orderIndex) {
  const stableId = generateStableId();
  const { data, error } = await supabase
    .from('paragraphs')
    .insert({
      node_id: TEST_NODE_ID,
      stable_id: stableId,
      display_number: orderIndex,
      marginal_note: marginalNote,
      content: content,
      group_label: groupLabel,
      order_index: orderIndex,
      created_by: TEST_USER_ID,
    })
    .select()
    .single();
  
  if (error) throw new Error(`Create failed: ${error.message}`);
  
  // Create initial revision
  await supabase.from('paragraph_revisions').insert({
    paragraph_id: data.id,
    node_id: TEST_NODE_ID,
    author_id: TEST_USER_ID,
    content: content,
    marginal_note: marginalNote,
    commit_message: 'New paragraph created',
    revision_type: 'creation',
    content_size: content.length,
  });
  
  return data;
}

async function printParagraphs(label) {
  const { data } = await supabase
    .from('paragraphs')
    .select('id, stable_id, display_number, order_index, marginal_note, content, deleted_at')
    .eq('node_id', TEST_NODE_ID)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });
  
  console.log(`\n── ${label} ──`);
  console.log('┌──────────┬──────────┬─────────┬───────┬────────────────────────────────────┐');
  console.log('│ ¶ Number │ stable   │ order   │ note  │ content (first 30 chars)           │');
  console.log('├──────────┼──────────┼─────────┼───────┼────────────────────────────────────┤');
  for (const p of data) {
    const num = String(p.display_number).padEnd(8);
    const sid = p.stable_id.padEnd(8);
    const oi = String(p.order_index).padEnd(7);
    const note = (p.marginal_note || '—').substring(0, 5).padEnd(5);
    const content = p.content.substring(0, 34).padEnd(34);
    console.log(`│ ¶${num}│ ${sid} │ ${oi} │ ${note} │ ${content} │`);
  }
  console.log('└──────────┴──────────┴─────────┴───────┴────────────────────────────────────┘');
  return data;
}

async function printRevisions(paragraphId, label) {
  const { data } = await supabase
    .from('paragraph_revisions')
    .select('id, revision_type, commit_message, content, marginal_note, created_at')
    .eq('paragraph_id', paragraphId)
    .order('created_at', { ascending: false });
  
  console.log(`\n── ${label} ──`);
  console.log(`   (${data.length} revision(s))`);
  for (const r of data) {
    const type = r.revision_type.padEnd(18);
    const msg = (r.commit_message || '').substring(0, 40);
    const content = r.content.substring(0, 30);
    console.log(`   ${type} │ "${msg}" │ "${content}..."`);
  }
  return data;
}

// ============================================================================
// TEST 1: End-to-end database test
// ============================================================================
async function test1_endToEnd() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('  TEST 1: End-to-end — Create, Edit, Revision, Revert');
  console.log('════════════════════════════════════════════════════════');
  
  // Step 1: Create a paragraph
  console.log('\n[Step 1] Creating paragraph...');
  const para = await createParagraph(
    'Article 14 guarantees equality before the law.',
    'Equality guarantee',
    'Fundamental Rights',
    1
  );
  console.log(`   Created: id=${para.id}, stable_id=${para.stable_id}`);
  await printParagraphs('After creation');
  
  // Step 2: Edit the paragraph
  console.log('\n[Step 2] Editing paragraph...');
  const newContent = 'Article 14 guarantees equality before the law and equal protection of the laws within the territory of India.';
  const { error: editErr } = await supabase
    .from('paragraphs')
    .update({
      content: newContent,
      marginal_note: 'Equality & equal protection',
      updated_at: new Date().toISOString(),
    })
    .eq('id', para.id);
  
  if (editErr) throw new Error(`Edit failed: ${editErr.message}`);
  
  // Create edit revision
  await supabase.from('paragraph_revisions').insert({
    paragraph_id: para.id,
    node_id: TEST_NODE_ID,
    author_id: TEST_USER_ID,
    content: newContent,
    marginal_note: 'Equality & equal protection',
    commit_message: 'Expanded to include equal protection clause',
    revision_type: 'content_edit',
    content_size: newContent.length,
  });
  console.log('   ✓ Paragraph edited + revision created');
  await printParagraphs('After edit');
  
  // Step 3: View history (revisions)
  console.log('\n[Step 3] Viewing revision history...');
  const revisions = await printRevisions(para.id, `Revisions for ¶1 (stable_id: ${para.stable_id})`);
  
  // Step 4: Revert to original
  console.log('\n[Step 4] Reverting to original content...');
  const originalRevision = revisions[revisions.length - 1]; // oldest
  
  await supabase
    .from('paragraphs')
    .update({
      content: originalRevision.content,
      marginal_note: originalRevision.marginal_note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', para.id);
  
  await supabase.from('paragraph_revisions').insert({
    paragraph_id: para.id,
    node_id: TEST_NODE_ID,
    author_id: TEST_USER_ID,
    content: originalRevision.content,
    marginal_note: originalRevision.marginal_note,
    commit_message: 'Reverted to original',
    revision_type: 'revert',
    content_size: originalRevision.content.length,
  });
  console.log('   ✓ Reverted + revert revision created');
  await printParagraphs('After revert');
  await printRevisions(para.id, `Revisions after revert`);
  
  return para;
}

// ============================================================================
// TEST 2: Renumbering test
// ============================================================================
async function test2_renumbering() {
  console.log('\n\n════════════════════════════════════════════════════════');
  console.log('  TEST 2: Renumbering — Insert between ¶2 and ¶3');
  console.log('════════════════════════════════════════════════════════');
  
  // Clean first
  await cleanup();
  
  // Create 5 paragraphs
  console.log('\n[Step 1] Creating 5 paragraphs...');
  const paras = [];
  const contents = [
    'Paragraph one: Introduction to Article 14.',
    'Paragraph two: Text of the provision.',
    'Paragraph three: Classification doctrine.',
    'Paragraph four: Arbitrariness doctrine.',
    'Paragraph five: Judicial developments.',
  ];
  const notes = ['Introduction', 'Provision text', 'Classification', 'Arbitrariness', 'Judicial'];
  
  for (let i = 0; i < 5; i++) {
    const p = await createParagraph(contents[i], notes[i], null, i + 1);
    paras.push(p);
  }
  
  const beforeData = await printParagraphs('5 paragraphs created');
  
  // Record stable_ids before insertion
  console.log('\n   Stable IDs before insertion:');
  for (const p of beforeData) {
    console.log(`   ¶${p.display_number} → ${p.stable_id}`);
  }
  
  // Step 2: Insert between ¶2 and ¶3
  console.log('\n[Step 2] Inserting new paragraph between ¶2 and ¶3...');
  
  // Shift order_index of paragraphs after position 2 (from highest down to avoid conflicts)
  const { data: toShift } = await supabase
    .from('paragraphs')
    .select('id, order_index, display_number')
    .eq('node_id', TEST_NODE_ID)
    .is('deleted_at', null)
    .gt('order_index', 2)
    .order('order_index', { ascending: false });
  
  // Shift both order_index AND display_number from top down to avoid unique constraint
  for (const p of toShift) {
    await supabase
      .from('paragraphs')
      .update({ order_index: p.order_index + 1, display_number: p.display_number + 1 })
      .eq('id', p.id);
  }
  
  // Insert new paragraph at order_index 3 with display_number 3
  const newPara = await createParagraph(
    'NEW: Reasonable classification requires intelligible differentia.',
    'New insertion',
    null,
    3
  );
  console.log(`   Inserted: id=${newPara.id}, stable_id=${newPara.stable_id}`);
  
  const afterData = await printParagraphs('After insertion + renumbering');
  
  // Step 3: Verify stable_ids unchanged
  console.log('\n[Step 3] Verifying stable_ids unchanged...');
  console.log('   Before → After:');
  
  let allStable = true;
  for (const before of beforeData) {
    const after = afterData.find(a => a.stable_id === before.stable_id);
    if (after) {
      const changed = before.display_number !== after.display_number ? ' (renumbered)' : '';
      console.log(`   ${before.stable_id}: ¶${before.display_number} → ¶${after.display_number}${changed}`);
    } else {
      console.log(`   ${before.stable_id}: ¶${before.display_number} → MISSING!`);
      allStable = false;
    }
  }
  // Show the new one
  const newInAfter = afterData.find(a => a.stable_id === newPara.stable_id);
  console.log(`   ${newPara.stable_id}: (new) → ¶${newInAfter.display_number}`);
  
  console.log(`\n   Stable IDs preserved: ${allStable ? '✓ YES' : '✗ NO'}`);
  console.log(`   Total paragraphs: ${afterData.length} (expected 6)`);
  console.log(`   New paragraph at ¶${newInAfter.display_number} (expected ¶3)`);
  
  // Verify sequential numbering
  const numbers = afterData.map(p => p.display_number);
  const expected = [1, 2, 3, 4, 5, 6];
  const sequential = JSON.stringify(numbers) === JSON.stringify(expected);
  console.log(`   Sequential numbering: ${sequential ? '✓ YES' : '✗ NO'} (${numbers.join(', ')})`);
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  PARAGRAPH SYSTEM — Operational Validation          ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  
  try {
    await checkTablesExist();
    await cleanup();
    await test1_endToEnd();
    await test2_renumbering();
    
    // Final cleanup
    await cleanup();
    console.log('\n\n✓ All tests completed. Test data cleaned up.');
  } catch (err) {
    console.error('\n✗ TEST FAILED:', err.message);
    process.exit(1);
  }
}

main();
