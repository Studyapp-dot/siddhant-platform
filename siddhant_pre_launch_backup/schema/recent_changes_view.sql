-- Run this in Supabase SQL editor to create the unified activity view
-- This view aggregates Revisions, Discussions, and Inline Tags into a single feed.

create or replace view public.recent_changes_view as

-- 1. Revisions
select 
  r.id as activity_id,
  r.node_id,
  n.title as node_title,
  n.slug as node_slug,
  r.author_id,
  p.username as author_username,
  p.role as author_role,
  'revision' as activity_type,
  'committed edit: ' || r.commit_message as action_summary,
  r.created_at
from public.revisions r
join public.nodes n on r.node_id = n.id
join public.profiles p on r.author_id = p.id

union all

-- 2. Discussions
select 
  d.id as activity_id,
  d.node_id,
  n.title as node_title,
  n.slug as node_slug,
  d.author_id,
  p.username as author_username,
  p.role as author_role,
  'discussion' as activity_type,
  case 
    when d.parent_id is null then 'started discussion topic' 
    else 'replied in discussion thread' 
  end as action_summary,
  d.created_at
from public.discussions d
join public.nodes n on d.node_id = n.id
join public.profiles p on d.author_id = p.id

union all

-- 3. Inline Tags
select 
  t.id as activity_id,
  t.node_id,
  n.title as node_title,
  n.slug as node_slug,
  t.author_id,
  p.username as author_username,
  p.role as author_role,
  'inline_tag' as activity_type,
  'flagged issue: "' || replace(t.tag_type, '_', ' ') || '"' || 
    case when t.resolved then ' (resolved)' else ' (open)' end as action_summary,
  t.created_at
from public.inline_tags t
join public.nodes n on t.node_id = n.id
join public.profiles p on t.author_id = p.id;

-- Ensure an anonymous user can read this view
grant select on public.recent_changes_view to anon, authenticated;
