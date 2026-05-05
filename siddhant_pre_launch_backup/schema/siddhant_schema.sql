-- Siddhant: The Living Legal Graph
-- Production Database Schema

-- Enable UUID extension for secure unique identifiers
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Maps to Supabase Auth Users)
-- This natively extends the authentication system to handle our Trust Tiers.
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique not null,
  role text default 'registered' check (role in ('registered', 'senior_validator', 'admin')),
  reputation_score integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) for profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Function to handle new user signup automatically and create a profile
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for auth.users to run the function when a user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. NODES (The canonical topics, e.g., "BNS Section 106")
create table public.nodes (
  id uuid default uuid_generate_v4() primary key,
  slug text unique not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.nodes enable row level security;
create policy "Nodes are viewable by everyone." on nodes for select using (true);
create policy "Registered users can insert nodes." on nodes for insert with check (auth.role() = 'authenticated');

-- 3. REVISIONS (The permanent edit history - Radical Transparency)
create table public.revisions (
  id uuid default uuid_generate_v4() primary key,
  node_id uuid references public.nodes on delete cascade not null,
  author_id uuid references public.profiles not null,
  report_content text,                -- Primary content column (unified report format)
  tier1_content text,                 -- Legacy: migrated into report_content
  tier2_content text,                 -- Legacy: migrated into report_content
  tier3_content text,                 -- Legacy: migrated into report_content
  commit_message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.revisions enable row level security;
create policy "Revisions are viewable by everyone." on revisions for select using (true);
create policy "Registered users can insert revisions." on revisions for insert with check (auth.role() = 'authenticated');

-- 4. DISCUSSIONS (Community consensus platform)
create table public.discussions (
  id uuid default uuid_generate_v4() primary key,
  node_id uuid references public.nodes on delete cascade not null,
  author_id uuid references public.profiles not null,
  content text not null,
  parent_id uuid references public.discussions on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.discussions enable row level security;
create policy "Discussions are viewable by everyone." on discussions for select using (true);
create policy "Registered users can insert discussions." on discussions for insert with check (auth.role() = 'authenticated');

-- 5. CROSS_REFERENCES (The edges of the Knowledge Graph)
-- Run this in Supabase SQL editor after initial setup.
create table public.cross_references (
  id uuid default uuid_generate_v4() primary key,
  source_node_id uuid references public.nodes on delete cascade not null,
  target_node_id uuid references public.nodes on delete cascade not null,
  relationship_type text check (relationship_type in ('prerequisite', 'related', 'distinguish', 'also_in')) not null,
  created_by uuid references public.profiles,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(source_node_id, target_node_id, relationship_type)
);

alter table public.cross_references enable row level security;
create policy "Cross-refs viewable by everyone." on cross_references for select using (true);
create policy "Registered users can add cross-refs." on cross_references for insert with check (auth.role() = 'authenticated');
create policy "Registered users can delete cross-refs." on cross_references for delete using (auth.role() = 'authenticated');

-- 6. WATCHLIST (Follow a Node — primary retention mechanism)
-- Empirical basis: Zhang (2025) — reactive editors (those who return to the same content)
-- are 3x more likely to drive revision activity than first-time contributors.
create table public.watchlist (
  user_id uuid references public.profiles on delete cascade not null,
  node_id uuid references public.nodes on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, node_id)
);

alter table public.watchlist enable row level security;
create policy "Users see own watchlist." on watchlist for select using (auth.uid() = user_id);
create policy "Users manage own watchlist." on watchlist for insert with check (auth.uid() = user_id);
create policy "Users can unwatch." on watchlist for delete using (auth.uid() = user_id);

-- 7. INLINE_TAGS (Lowest-barrier contribution pathway)
-- Empirical basis: Research.md Sec 13 — inline tagging should be first-class,
-- lowering contribution barrier to under 5 minutes.
create table public.inline_tags (
  id uuid default uuid_generate_v4() primary key,
  node_id uuid references public.nodes on delete cascade not null,
  tier smallint check (tier in (1, 2, 3)) not null,
  tag_type text check (tag_type in ('citation_needed', 'outdated', 'unclear', 'disputed')) not null,
  context_quote text,
  author_id uuid references public.profiles not null,
  resolved boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.inline_tags enable row level security;
create policy "Tags viewable by everyone." on inline_tags for select using (true);
create policy "Registered users can add tags." on inline_tags for insert with check (auth.role() = 'authenticated');
create policy "Validators and admins can resolve tags." on inline_tags for update using (
  exists (select 1 from profiles where id = auth.uid() and role in ('senior_validator', 'admin'))
);

-- 8. CONSENSUS_VOTES (Social interaction — strongest retention driver per Mustafa et al. 2022)
-- Allows community members to explicitly support a discussion point,
-- building visible consensus for content decisions.
create table public.consensus_votes (
  user_id uuid references public.profiles on delete cascade not null,
  discussion_id uuid references public.discussions on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, discussion_id)
);

alter table public.consensus_votes enable row level security;
create policy "Votes are viewable by everyone." on consensus_votes for select using (true);
create policy "Registered users can vote." on consensus_votes for insert with check (auth.uid() = user_id);
create policy "Users can remove own vote." on consensus_votes for delete using (auth.uid() = user_id);
