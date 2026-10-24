/* ROUND BJ (bundle hygiene) — the AT-1 boot probe, EXTRACTED from boards.ts
 * into a leaf module so src/library.ts can read the memoised decision without
 * statically importing boards.ts (which drags presets → @xyflow/react into
 * library's dependency cone — exactly what the dead dynamic import it replaced
 * was avoiding, and what broke checks/round-at-local-store.mjs's §6 bundle).
 *
 * boards.ts RE-EXPORTS everything here under the names it always had
 * (`StorageMode`, `PROBE_TIMEOUT`, `decideStorageMode`, `probeServerModeOnce`),
 * so no other importer changes. The probe is DOM-free (injected `fetch`) and
 * has no imports at all — the same decision table
 * checks/round-at-local-store.mjs drives in Node keeps working verbatim. */

/** Probe outcome for the boards backend (AT-1). 'server' = the /api/boards
 *  JSON API answered; 'local' = this browser owns the boards (IndexedDB). */
export type StorageMode = 'server' | 'local';

/** Timeout for the boot probe. ~3× a LAN round-trip and well under the
 *  800 ms autosave's human timescale: a hung connection must never hang boot. */
export const PROBE_TIMEOUT = 2500;

/** The boot probe (AT-1). Injected `fetch` (defaults to the global) keeps it
 *  DOM-free-testable: checks/round-at-local-store.mjs drives all six rows of
 *  the decision table in Node.
 *
 *  SERVER only when the answer is PROOF our API replied: ok + JSON content-
 *  type + an Array body (`listBoards()` returns BoardMeta[] and nothing else
 *  on this origin ever will). Any other outcome — SPA-fallback HTML on a
 *  static host (measured: `vite preview` answers 200 text/html), a 404/5xx,
 *  non-array JSON, a network rejection (`file://` origin), a hung connection
 *  — converges on LOCAL. The user never sees a broken board list. */
export async function decideStorageMode(
  fetchImpl: typeof fetch = fetch,
): Promise<StorageMode> {
  try {
    const ctrl = new AbortController();
    /* The deadline REJECTS (and aborts) — racing it against the fetch means a
       connection that never answers (and a stub that ignores the signal)
       still converges on LOCAL at PROBE_TIMEOUT instead of hanging boot. */
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, PROBE_TIMEOUT);
    });
    let res: Response;
    try {
      res = await Promise.race([fetchImpl('/api/boards', {signal: ctrl.signal}), deadline]);
    } finally {
      clearTimeout(timer);
    }
    if (!(res && res.ok && /json/i.test(res.headers?.get?.('content-type') ?? ''))) return 'local';
    const body: unknown = await res.json();
    return Array.isArray(body) ? 'server' : 'local';
  } catch {
    return 'local';
  }
}

/* The session-wide decision. First call runs the probe; every later call
   awaits the SAME promise — one probe, one mode, for the whole session
   (AT-1: no mid-session flipping; a board saved mid-session goes to the
   mode chosen at boot). */
let modePromise: Promise<StorageMode> | null = null;
export function probeServerModeOnce(fetchImpl?: typeof fetch): Promise<StorageMode> {
  modePromise ??= decideStorageMode(fetchImpl);
  return modePromise;
}
