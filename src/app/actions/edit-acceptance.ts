'use server';

import { createClient } from '@/utils/supabase/server';

// ============================================================================
// SIDDHANT: Edit Acceptance — Lazy Evaluation System
//
// The 72-hour acceptance window works through "lazy evaluation":
// Every time a relevant page loads, we check for un-accepted edits
// older than 72h and auto-accept them via the RPC function.
//
// This avoids the need for a cron job or scheduled function.
// Edits may be processed slightly after 72h (e.g. 73h, 80h) depending
// on page visit patterns — this is acceptable for the current scale.
// ============================================================================

/**
 * Process pending edit acceptances.
 * Calls the process_edit_acceptance RPC function which:
 * 1. Finds all unprocessed revisions older than 72h
 * 2. Marks them as accepted
 * 3. Awards reputation (+2 minor, +5 substantive based on char delta)
 * 4. Increments accepted_edits_count on the author's profile
 *
 * Returns the number of edits processed.
 * Safe to call frequently — idempotent via acceptance_processed flag.
 */
export async function processEditAcceptance(): Promise<{ processed: number }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('process_edit_acceptance', {
      p_hours_threshold: 72,
    });

    if (error) {
      // Expected during development if the RPC or a dependency function
      // (e.g., award_reputation_points) hasn't been deployed. Safe to ignore.
      if (error.message.includes('does not exist')) {
        // Silent — this fires on every page load; noisy warns are not helpful.
        // Actual error: error.message (check Supabase for function deployment)
      } else {
        console.error('[edit-acceptance] RPC error:', error.message);
      }
      return { processed: 0 };
    }

    const result = data as { processed: number } | null;
    if (result && result.processed > 0) {
      console.log(`[edit-acceptance] Processed ${result.processed} edits`);

      // After processing acceptances, check level advancement for affected users
      // We do this by finding users whose accepted_edits_count just changed
      const { checkLevelAdvancement } = await import('@/app/actions/reputation');

      // Get distinct authors of recently-accepted revisions
      const { data: recentlyAccepted } = await supabase
        .from('revisions')
        .select('author_id')
        .eq('acceptance_processed', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (recentlyAccepted) {
        const uniqueAuthors = [...new Set(recentlyAccepted.map(r => r.author_id))];
        for (const authorId of uniqueAuthors) {
          try {
            await checkLevelAdvancement(authorId);
          } catch (err) {
            // Non-critical — don't block acceptance processing
            console.error('[edit-acceptance] Level check failed for', authorId, err);
          }
        }
      }
    }

    return { processed: result?.processed ?? 0 };
  } catch (err) {
    console.error('[edit-acceptance] Exception:', err);
    return { processed: 0 };
  }
}
