-- Inkwell notes table for cloud sync
-- Apply via Supabase Studio SQL editor, or:
--   supabase db push  (if linked)
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_notes.sql

create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  tags text[] not null default '{}',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  is_deleted boolean not null default false,
  deleted_at bigint null,
  created_at bigint not null,
  updated_at bigint not null,
  field_versions jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  tombstone boolean not null default false
);

create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at);

create index if not exists notes_user_id_idx
  on public.notes (user_id, id);

-- Row-level security: every row is scoped to its owner.
alter table public.notes enable row level security;

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own"
  on public.notes for select
  using (auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own"
  on public.notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Realtime broadcasts filtered by user_id require an explicit publication entry.
-- The SupabaseTransport subscribes with filter: user_id=eq.<auth.uid()>.
alter publication supabase_realtime add table public.notes;
