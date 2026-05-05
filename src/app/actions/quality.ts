'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { awardReputation } from '@/app/actions/reputation';
import { QUALITY_TIERS, TIER_ORDER } from '@/app/actions/quality-constants';

// ============================================================================
// SIDDHANT: Quality Tier Assessment — Server Actions
//
// Quality tiers are CONTENT-BASED, not activity-based.
// A node's quality is determined by human assessment of the actual content —
// accuracy, completeness, neutrality, and sourcing — not by edit count.
//
// Level gates:
//   Any editor (L2+) can assess: stub ↔ start ↔ c_class
//   Level 3+ can advance to: b_class
//   Level 3+ independent reviewer: good_article
//   Level 4+ multi-editor consensus: featured
// ============================================================================

// Level numbers for roles
const ROLE_LEVELS: Record<string, number> = {
  reader: 1,
  contributor: 2,
  recognized: 3,
  senior_scholar: 4,
  steward: 5,
  governance_council: 6,
};

/**
 * Assess a node's quality tier.
 * Enforces level gates and independence requirements.
 */
export async function assessQualityTier(
  nodeId: string,
  newTier: string,
  justification: string,
  confidence: 'high' | 'medium' | 'low' = 'high',
  slug?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Validate tier value
  if (!QUALITY_TIERS[newTier]) {
    return { error: 'Invalid quality tier' };
  }

  // Good Article and Featured require formal peer review — cannot be set via individual assessment
  if (newTier === 'good_article' || newTier === 'featured') {
    return { error: `"${QUALITY_TIERS[newTier].label}" requires formal peer review and cannot be assessed individually.` };
  }

  // Validate justification
  if (!justification || justification.trim().length < 10) {
    return { error: 'Please provide a justification (at least 10 characters)' };
  }

  // Get user's role and level
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) return { error: 'Profile not found' };

  const userLevel = ROLE_LEVELS[profile.role] || 1;
  const tierConfig = QUALITY_TIERS[newTier];

  // Level gate check
  if (userLevel < tierConfig.minLevel) {
    return { error: `Level ${tierConfig.minLevel}+ required to assess as "${tierConfig.label}"` };
  }

  // Independence check — for Good Article and Featured, assessor must not have contributed
  if (tierConfig.requiresIndependence) {
    const { count } = await supabase
      .from('revisions')
      .select('id', { count: 'exact', head: true })
      .eq('node_id', nodeId)
      .eq('author_id', user.id);

    if (count && count > 0) {
      return { error: `You cannot assess as "${tierConfig.label}" — you have contributed to this node. An independent reviewer is required.` };
    }
  }

  // Execute the assessment via RPC
  const { data, error } = await supabase.rpc('assess_quality_tier', {
    p_node_id: nodeId,
    p_assessor_id: user.id,
    p_new_tier: newTier,
    p_justification: justification.trim(),
    p_confidence: confidence,
  });

  if (error) return { error: error.message };

  const result = data as { success: boolean; previous_tier?: string; new_tier?: string; error?: string };
  if (!result?.success) return { error: result?.error || 'Assessment failed' };

  // If the tier advanced (not just changed), award reputation to contributors
  const oldTierIndex = TIER_ORDER.indexOf(result.previous_tier || 'stub');
  const newTierIndex = TIER_ORDER.indexOf(newTier);

  if (newTierIndex > oldTierIndex) {
    // Award proportional reputation to contributors of this node
    const { data: contributors } = await supabase
      .from('revisions')
      .select('author_id, content_size')
      .eq('node_id', nodeId);

    if (contributors && contributors.length > 0) {
      // Calculate total contribution size
      const totalSize = contributors.reduce((sum: number, c: any) => sum + (c.content_size || 0), 0);

      // Award points proportional to contribution — graduated base points
      // Higher tiers earn more to reflect the prestige of formal peer review
      const TIER_BASE_POINTS: Record<string, number> = {
        start: 5,         // Draft → Developing
        c_class: 8,       // Developing → Useful
        b_class: 12,      // Useful → Solid
        good_article: 25, // Solid → Good Article (formal peer review)
        featured: 40,     // Good Article → Featured (highest prestige)
      };
      const basePoints = TIER_BASE_POINTS[newTier] || 10;

      // Group by author and sum their contribution
      const authorContributions: Record<string, number> = {};
      contributors.forEach((c: any) => {
        const authorId = c.author_id;
        authorContributions[authorId] = (authorContributions[authorId] || 0) + (c.content_size || 0);
      });

      for (const [authorId, authorSize] of Object.entries(authorContributions)) {
        const proportion = totalSize > 0 ? authorSize / totalSize : 0;
        const points = Math.max(1, Math.round(basePoints * proportion));

        // Dedup check: prevent double-awarding if assessQualityTier is called
        // multiple times for the same tier transition. The SQL RPCs
        // (cast_quality_vote, close_review_cycle) have NOT EXISTS checks,
        // but this TypeScript path did not — until now.
        const tierDescription = `Node advanced from ${QUALITY_TIERS[result.previous_tier || 'stub']?.label || 'Unknown'} to ${tierConfig.label}`;
        const { count: existingBonus } = await supabase
          .from('reputation_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', authorId)
          .eq('source_id', nodeId)
          .eq('event_type', 'tier_advancement_bonus')
          .like('description', `%to ${tierConfig.label}%`);

        if (existingBonus && existingBonus > 0) {
          // Already awarded for this tier advancement — skip
          continue;
        }

        try {
          await awardReputation(
            authorId,
            'tier_advancement_bonus',
            nodeId,
            'node',
            tierDescription,
            points,
          );
        } catch (err) {
          console.error('[quality] Failed to award tier advancement rep:', err);
        }
      }
    }
  }

  if (slug) {
    revalidatePath(`/topic/${slug}`);
  }

  return { success: true, previousTier: result.previous_tier, newTier };
}


/**
 * Get quality assessment history for a node.
 */
export async function getQualityAssessments(nodeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('quality_assessments')
    .select(`
      id, previous_tier, new_tier, justification, confidence, created_at,
      profiles!quality_assessments_assessor_id_fkey ( username, role )
    `)
    .eq('node_id', nodeId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[quality] Assessment history error:', error);
    return [];
  }

  return data || [];
}
