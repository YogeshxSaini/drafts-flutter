import { useSyncExternalStore } from 'react';

type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
type GetState<T> = () => T;

export interface StoreApi<T> {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: () => void) => () => void;
  <U>(selector: (state: T) => U): U;
}

type StateCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a) as (keyof T)[];
  const kb = Object.keys(b) as (keyof T)[];
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.is(a[k], b[k])) return false;
  }
  return true;
}

export function create<T extends object>(creator: StateCreator<T>): StoreApi<T> {
  let state: T;
  const listeners = new Set<() => void>();

  const setState: SetState<T> = (partial) => {
    const next = typeof partial === 'function' ? (partial as (s: T) => Partial<T>)(state) : partial;
    if (shallowEqual(state, { ...state, ...next } as T)) return;
    state = { ...state, ...next } as T;
    listeners.forEach((l) => l());
  };

  const getState: GetState<T> = () => state;

  state = creator(setState, getState);

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const useStore = <U>(selector: (state: T) => U): U =>
    useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state)
    );

  const api: StoreApi<T> = Object.assign(useStore as unknown as StoreApi<T>, {
    getState,
    setState,
    subscribe
  });
  return api;
}
