# Supabase setup

Inkwell stores notes locally in IndexedDB and syncs them to Supabase when the
following env vars are set. Without them the app runs in offline-only mode
backed by an in-memory `FakeRemote` (used for development and tests).

## 1. Create a Supabase project

Use the Supabase dashboard or CLI. Note the project URL and the **publishable
key** (Settings → API). The publishable key replaces the older "anon" key.

## 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your values:

```sh
cp .env.example .env.local
# edit .env.local
```

Vite reads `VITE_*` env vars at build/dev time. Never commit `.env.local`.

## 3. Apply the notes table migration

The `notes` table schema lives in `supabase/migrations/0001_notes.sql`. Apply
it once per environment. Easiest path: paste it into the Supabase Studio SQL
editor and run. With the Supabase CLI linked to your project:

```sh
supabase db push
```

The migration:

- creates `public.notes` with the columns the transport writes
- adds row-level security policies scoped to `auth.uid() = user_id`
- adds the table to the `supabase_realtime` publication so the
  `postgres_changes` channel in `SupabaseTransport` receives updates

## 4. Auth

`src/sync/auth.ts` wires email/password and OAuth (Google/Apple/GitHub) via
`@supabase/supabase-js`. Enable the providers you want under
**Authentication → Providers** in the Supabase dashboard.

## 5. Verify

With env vars set and the migration applied, `npm run dev` should:

1. Show the Supabase auth UI on first load (when you wire one in)
2. On sign-in, drain the outbox and pull remote rows for the signed-in user
3. On sign-out, wipe the local IndexedDB
