/**
 * ROUND BI — the feedback screenshot helper's ONE brain, PURE AND REACT-FREE
 * (a `feedbackIssueUrl.ts` / `roadmap.ts` peer, so the harness can bundle and
 * EXECUTE it instead of regexing source).
 *
 * THE PATTERN. The app already hands the user a prefilled GitHub new-issue
 * form; the missing piece was the picture of the board. A static app cannot
 * upload one — that would need a server and a secret it must not ship. So the
 * app puts the PNG on the user's CLIPBOARD and the user pastes it into the
 * issue body, where GITHUB's own uploader hosts it. The clipboard is a browser
 * API: the bytes never leave the machine on this path, and the only network
 * act in the whole feedback flow is still `window.open` on the issue URL.
 *
 * WHY THE RASTERISER IS INJECTED. `buildDataUrl` is App's own `buildPng` (SVG
 * emitter → `rasterise()`, ROUND AY) — this module must never grow a second
 * renderer, so it takes the finished data URL as a callback and only turns it
 * into a Blob and puts it on the clipboard.
 *
 * TWO BROWSER FACTS THIS FILE ENCODES:
 *  1. Safari rejects a `ClipboardItem` that was not constructed SYNCHRONOUSLY
 *     inside the user gesture — so nothing here awaits before `new CI(...)`.
 *     The item is given a PROMISE (`Promise<Blob>`), which both Chrome and
 *     Safari accept, so the rasterise keeps running after the click returns
 *     while the gesture is still valid.
 *  2. On a plain-http origin (a LAN dev server, `file://`) the browser exposes
 *     NEITHER `navigator.clipboard` NOR `ClipboardItem`: `clipboardUsable()`
 *     answers false and the dialog renders no button at all — no dead control,
 *     no broken promise.
 *
 * Every failure is an OUTCOME (`{ok:false, reason}`), never a throw: the
 * dialog's Send handler must not be able to break on a refused clipboard.
 */

/** Why a copy did or did not happen. `reason` is for tests/telemetry-free
 *  diagnostics — the UI shows ONE plain sentence regardless. */
export type CopyOutcome =
  | {ok: true}
  | {ok: false; reason: 'unsupported' | 'build' | 'denied'; detail?: string};

type ClipboardWriter = {write: (items: unknown[]) => Promise<void>};
type Navigatorish = {clipboard?: ClipboardWriter} | null | undefined;
type ClipboardItemCtor = new (data: Record<string, Promise<Blob>>) => unknown;

const errText = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/** The browser globals, read lazily so Node (the harness) can import this.
 *  `navigator.clipboard` is UNDEFINED on plain-http origins (a LAN dev server,
 *  `file://`) and in Node — it is read, never assumed. */
function browserGlobals(): {clipboard: ClipboardWriter | undefined; CI: ClipboardItemCtor | undefined} {
  const clipboard = typeof navigator === 'undefined'
    ? undefined
    : navigator.clipboard as unknown as ClipboardWriter | undefined;
  const CI = typeof window === 'undefined'
    ? undefined
    : window.ClipboardItem as unknown as ClipboardItemCtor | undefined;
  return {clipboard, CI};
}

/**
 * Can this browser take an image on the clipboard at all? TRUE only when BOTH
 * halves exist: the async clipboard API (`navigator.clipboard.write`) and the
 * `window.ClipboardItem` constructor. Anything less is a plain false, and the
 * caller renders nothing rather than a button that cannot work.
 *
 * The two arguments exist for the harness: passing them overrides the globals.
 */
export function clipboardUsable(nav?: Navigatorish, CI?: ClipboardItemCtor): boolean {
  const g = browserGlobals();
  const clipboard = nav === undefined ? g.clipboard : nav?.clipboard;
  const useCI = CI === undefined ? g.CI : CI;
  return !!clipboard && typeof clipboard.write === 'function' && typeof useCI === 'function';
}

/**
 * The canvas rasteriser's output (`toDataURL('image/png')`) → a PNG Blob.
 * Byte-exact: the base64 payload is decoded, never re-encoded through a string.
 * A non-PNG data URL THROWS — silently copying a JPEG under an `image/png`
 * type would hand GitHub the wrong format.
 */
export function pngBlobFromDataUrl(dataUrl: string): Blob {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl).trim());
  if (!m) throw new Error('not a base64 image/png data URL');
  const bin = atob(m[1].replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], {type: 'image/png'});
}

export type CopyDeps = {
  /** The board as a PNG data URL — App's existing export path (never a new
   *  renderer). Called SYNCHRONOUSLY, before any await. */
  buildDataUrl: () => Promise<string>;
  /** Injection seam for the harness; defaults to the browser globals. */
  nav?: Navigatorish;
  ClipboardItemCtor?: ClipboardItemCtor;
};

/**
 * Put the board's PNG on the clipboard. Resolves — never rejects — with a
 * `CopyOutcome`, and the `ClipboardItem` is constructed synchronously so
 * Safari's gesture check passes.
 */
export function copyPngToClipboard(o: CopyDeps): Promise<CopyOutcome> {
  const g = browserGlobals();
  const write = o.nav === undefined ? g.clipboard?.write : o.nav?.clipboard?.write;
  const CI = o.ClipboardItemCtor === undefined ? g.CI : o.ClipboardItemCtor;
  if (!CI || typeof write !== 'function') return Promise.resolve({ok: false, reason: 'unsupported'});

  /* 1. start the export — the promise is the ClipboardItem's VALUE, never an
   *    awaited result (awaiting here would lose the user gesture in Safari). */
  let buildFailed = '';
  let blob: Promise<Blob>;
  try {
    blob = Promise.resolve(o.buildDataUrl()).then(pngBlobFromDataUrl).catch((e: unknown) => {
      buildFailed = errText(e);
      throw e instanceof Error ? e : new Error(buildFailed);
    });
  } catch (e) {
    return Promise.resolve({ok: false, reason: 'build', detail: errText(e)});
  }

  /* 2. construct the item SYNCHRONOUSLY, inside the gesture. */
  let item: unknown;
  try {
    item = new CI({'image/png': blob});
  } catch (e) {
    return Promise.resolve({ok: false, reason: 'unsupported', detail: errText(e)});
  }

  /* 3. write it; a refusal is an outcome, not an exception. */
  return Promise.resolve(write([item])).then(
    () => ({ok: true} as CopyOutcome),
    (e: unknown) => ({
      ok: false,
      reason: buildFailed ? 'build' : 'denied',
      detail: buildFailed || errText(e),
    } as CopyOutcome),
  );
}
