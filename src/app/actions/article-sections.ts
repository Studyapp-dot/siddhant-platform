'use server';

import { createClient } from '@/utils/supabase/server';

export interface ArticleSection {
  id: string;
  slug: string;
  title: string;
  level: number;
  order_index: number;
}

export async function getNodeSections(nodeId: string): Promise<ArticleSection[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('article_sections')
    .select('id, slug, title, level, order_index')
    .eq('node_id', nodeId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Failed to fetch node sections:', error);
    return [];
  }

  return data as ArticleSection[];
}
