import { createClient } from '@/utils/supabase/server';
import NodesContainer from './NodesContainer';
import './nodes.css';

export default async function NodesIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch all nodes with type info
  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, slug, title, created_at, node_type')
    .order('title', { ascending: true });

  const allNodes = nodes ?? [];

  // Fetch all edges
  const { data: edgesData } = await supabase
    .from('cross_references')
    .select('source_node_id, target_node_id, relationship_type');
  
  const allEdges = edgesData ?? [];

  // Batch fetch latest revision for each node
  const nodeIds = allNodes.map(n => n.id);
  const { data: latestRevisions } = nodeIds.length > 0
    ? await supabase
        .from('revisions')
        .select('node_id, created_at, report_content, profiles!revisions_author_id_fkey ( username )')
        .in('node_id', nodeIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  // Build revMap (latest revision per node) and summaryMap (first sentence)
  const revMap: Record<string, any> = {};
  const summaryMap: Record<string, string> = {};

  for (const rev of (latestRevisions ?? [])) {
    if (!revMap[rev.node_id]) {
      revMap[rev.node_id] = rev;

      // Extract summary: first sentence of report_content
      if (rev.report_content) {
        const text = rev.report_content
          .replace(/^#+\s.*/gm, '')     // strip markdown headings
          .replace(/[*_\[\]`]/g, '')     // strip formatting chars
          .trim();
        const firstSentence = text.split(/[.!?]\s/)[0];
        summaryMap[rev.node_id] = (firstSentence || text).substring(0, 150);
      }
    }
  }

  return (
    <NodesContainer
      nodes={allNodes}
      edges={allEdges as any}
      revMap={revMap}
      summaryMap={summaryMap}
      isLoggedIn={!!user}
    />
  );
}
