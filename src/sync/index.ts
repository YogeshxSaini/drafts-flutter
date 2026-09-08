import { FakeRemote } from './fakeTransport';
import { SupabaseTransport } from './supabaseTransport';
import { SyncEngine } from './engine';
import { configureAuth, initAuth, onAuthChange } from './auth';
import { app } from '../state/appStore';
import { wipeLocalDatabase } from './auth';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '';

const transport = SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY ? null : new FakeRemote({ heartbeat: true });

let activeTransport: ReturnType<typeof getTransport>;
function getTransport(userId: string) {
  if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
    return new SupabaseTransport({ url: SUPABASE_URL, anonKey: SUPABASE_PUBLISHABLE_KEY, userId });
  }
  return transport!;
}

export const engine = new SyncEngine({
  transport: new (class {
    push = (...args: Parameters<FakeRemote['push']>) => activeTransport.push(...args);
    pullSince = (...args: Parameters<FakeRemote['pullSince']>) => activeTransport.pullSince(...args);
    subscribe = (...args: Parameters<FakeRemote['subscribe']>) => activeTransport.subscribe(...args);
    heartbeat = () => activeTransport.heartbeat();
  })(),
  onRemoteChange: () => {
    void app.getState().refresh();
  }
});

if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
  configureAuth({ url: SUPABASE_URL, anonKey: SUPABASE_PUBLISHABLE_KEY });
}

export async function bootSync(): Promise<void> {
  if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
    await initAuth();
    onAuthChange((s) => {
      if (s.status === 'signed-in') {
        activeTransport = getTransport(s.user.id);
        engine.setUser(s.user.id);
        void engine.start();
      } else {
        engine.setUser(null);
        void wipeLocalDatabase();
        void app.getState().refresh();
      }
    });
  } else {
    const localUserId = 'local-user';
    activeTransport = new FakeRemote({ heartbeat: true });
    engine.setUser(localUserId);
    void engine.start();
  }
}
