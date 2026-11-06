/* PACKAGE-S §S-1 — USER PREFERENCES (the one persistence path for Settings).

   Every persisted Settings value goes through `loadPref` / `savePref`, under the
   one `diagram-studio:pref:` key prefix. The shape copies `theme.ts`'s
   try/catch-and-ignore discipline: localStorage can throw (private mode, quota),
   and a preference that cannot persist must never take the app down — the app
   runs on defaults instead.

   THE LAZY-INIT CONTRACT (house rule, PACKAGE-M): a setting writes NOTHING until
   the user makes an explicit choice. `loadPref` only READS; the very first visit
   finds no keys and every Settings control renders its built-in default without
   planting one. Persistence begins at the first explicit pick. */

const PREFIX = 'diagram-studio:pref:';

/** Read a stored preference. Returns `fallback` when absent, malformed, or
 *  unreachable — a corrupted value is the same as no value (stale persisted
 *  state is cleared, never migrated). JSON-encoded so any JSON value works,
 *  not just strings. */
export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Persist a preference. Failures are swallowed by design — see the header. */
export function savePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore: a preference that cannot persist must not break the app */
  }
}
