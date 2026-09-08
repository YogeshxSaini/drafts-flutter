import { db } from '../data/db';

export type AuthState =
  | { status: 'signed-out'; user: null; error: null }
  | { status: 'signing-in'; user: null; error: null }
  | { status: 'signed-in'; user: { id: string; email: string | null }; error: null }
  | { status: 'error'; user: null; error: string };

export interface AuthConfig {
  url: string;
  anonKey: string;
}

let supabase: { auth: unknown } | null = null;
let config: AuthConfig | null = null;
const listeners = new Set<(state: AuthState) => void>();
let state: AuthState = { status: 'signed-out', user: null, error: null };

function setState(next: AuthState) {
  state = next;
  for (const l of listeners) l(state);
}

export function onAuthChange(listener: (state: AuthState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export function getAuthState(): AuthState {
  return state;
}

async function getSupabase() {
  if (supabase) return supabase;
  if (!config) throw new Error('Supabase auth not configured');
  const mod = await import('@supabase/supabase-js');
  const create = (mod as { createClient: (url: string, key: string) => { auth: unknown } }).createClient;
  supabase = create(config.url, config.anonKey);
  return supabase;
}

export function configureAuth(cfg: AuthConfig) {
  config = cfg;
}

export async function initAuth(): Promise<void> {
  if (!config) return;
  try {
    const sb = await getSupabase();
    const auth = sb.auth as {
      getSession: () => Promise<{ data: { session: { user: { id: string; email: string | null } } | null } }>;
      onAuthStateChange: (cb: (event: string, session: { user: { id: string; email: string | null } } | null) => void) => { data: { subscription: { unsubscribe: () => void } } };
      signInWithPassword: (creds: { email: string; password: string }) => Promise<{ error: { message: string } | null }>;
      signInWithOAuth: (opts: { provider: 'google' | 'apple' | 'github' }) => Promise<{ error: { message: string } | null }>;
      signOut: () => Promise<{ error: { message: string } | null }>;
    };
    const { data } = await auth.getSession();
    if (data.session?.user) {
      setState({ status: 'signed-in', user: { id: data.session.user.id, email: data.session.user.email }, error: null });
    }
    auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState({ status: 'signed-in', user: { id: session.user.id, email: session.user.email }, error: null });
      } else {
        setState({ status: 'signed-out', user: null, error: null });
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState({ status: 'error', user: null, error: message });
  }
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  setState({ status: 'signing-in', user: null, error: null });
  try {
    const sb = await getSupabase();
    const auth = sb.auth as {
      signInWithPassword: (creds: { email: string; password: string }) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await auth.signInWithPassword({ email, password });
    if (error) {
      setState({ status: 'error', user: null, error: error.message });
      throw new Error(error.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState({ status: 'error', user: null, error: message });
    throw err;
  }
}

export async function signInWithOAuth(provider: 'google' | 'apple' | 'github'): Promise<void> {
  setState({ status: 'signing-in', user: null, error: null });
  try {
    const sb = await getSupabase();
    const auth = sb.auth as {
      signInWithOAuth: (opts: { provider: 'google' | 'apple' | 'github' }) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await auth.signInWithOAuth({ provider });
    if (error) {
      setState({ status: 'error', user: null, error: error.message });
      throw new Error(error.message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setState({ status: 'error', user: null, error: message });
    throw err;
  }
}

export async function signOut(): Promise<void> {
  try {
    const sb = await getSupabase();
    const auth = sb.auth as { signOut: () => Promise<{ error: { message: string } | null }> };
    await auth.signOut();
  } catch {
    // ignore network errors on sign-out; we still wipe locally
  }
  await wipeLocalDatabase();
  setState({ status: 'signed-out', user: null, error: null });
}

export async function wipeLocalDatabase(): Promise<void> {
  await db.transaction('rw', db.notes, db.tags, db.outbox, db.meta, async () => {
    await db.notes.clear();
    await db.tags.clear();
    await db.outbox.clear();
    const all = await db.meta.toArray();
    for (const m of all) {
      if (m.key.startsWith('sync_cursor_')) {
        await db.meta.delete(m.key);
      }
    }
  });
}
