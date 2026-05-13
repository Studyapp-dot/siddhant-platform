'use server';

import { createClient } from '@/utils/supabase/server';

export interface NodePreviewData {
  title: string;
  node_type: string;
  excerpt: string | null;
}

export async function getNodePreview(slug: string): Promise<NodePreviewData | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('nodes')
      .select('title, node_type, metadata')
      .eq('slug', slug)
      .single();

    if (error || !data) return null;

    // Determine the best 1-line excerpt from metadata
    let excerpt = null;
    const meta = data.metadata || {};
    
    if (meta.legal_essence) {
      excerpt = meta.legal_essence;
    } else if (meta.explanation_summary) {
      excerpt = meta.explanation_summary;
    } else if (meta.significance) {
      excerpt = meta.significance;
    }

    return {
      title: data.title,
      node_type: data.node_type || 'topic',
      excerpt,
    };
  } catch (err) {
    console.error('[getNodePreview] Error fetching preview:', err);
    return null;
  }
}
