-- Migration: 20261124000001_create_suggestions_table.sql
-- Create suggestions table for genuine user feedback, feature requests, and complaints
-- Support for contact validation (genuine email or Indian mobile starting with 6-9) and Cloudflare Turnstile

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value text not null,
  category text not null default 'suggestion' check (category in ('suggestion', 'feature_request', 'bug_report', 'complaint', 'other')),
  message text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'in_progress', 'resolved', 'archived')),
  admin_notes text null,
  turnstile_verified boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

-- Enable Row Level Security
alter table public.suggestions enable row level security;

-- Drop any existing policies if re-run
drop policy if exists "Allow public insert to suggestions" on public.suggestions;
drop policy if exists "Allow select suggestions" on public.suggestions;
drop policy if exists "Allow update suggestions" on public.suggestions;
drop policy if exists "Allow delete suggestions" on public.suggestions;

-- Policies for anon & authenticated
create policy "Allow public insert to suggestions"
  on public.suggestions
  for insert
  to anon, authenticated
  with check (true);

create policy "Allow select suggestions"
  on public.suggestions
  for select
  to anon, authenticated
  using (true);

create policy "Allow update suggestions"
  on public.suggestions
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Allow delete suggestions"
  on public.suggestions
  for delete
  to anon, authenticated
  using (true);
