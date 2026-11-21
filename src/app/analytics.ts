/* analytics.ts — ONBOARD-P6 (2026-11-01): the app's ONE analytics door.
 *
 *  WHY A WRAPPER: index.html loads self-hosted Umami on the production origin
 *  only, so everywhere else `window.umami` is undefined. Every call site has to
 *  survive that, and exactly ONE file may know the tracker exists — otherwise a
 *  renamed event stops being recorded and nothing fails. Nothing else in src/
 *  may name it (checks/round-onboard-p6.mjs p6.1a).
 *
 *  WHAT MAY BE SENT is a CLOSED vocabulary: four event names, and for three of
 *  them one enumerated prop. NO FREE TEXT EVER — no board name, node label,
 *  file name, id, URL or error message. `track` refuses (drops) a call whose
 *  name, prop key or prop value is outside the tables below, so a careless call
 *  site cannot leak user content: it loses the event instead.
 *
 *  DEDUPE IS WHAT MAKES THE FUNNEL HONEST. `surface_view` fires once per
 *  surface per SESSION and `first_action` once per action FOREVER; without it
 *  `first_action` counts every node and the funnel is just a usage chart.
 *  `export` and `help_open` are deliberately NOT deduped — repetition is the
 *  signal (the value moment, and the counter-metric).
 *
 *  THE DEV QUEUE: in development every accepted call is also pushed to
 *  `window.__gt` as `[name, props]`, so a harness can read what WOULD have been
 *  sent on an origin where the tracker is not loaded. `import.meta.env.DEV` is
 *  replaced with `false` by the production build, so the queue does not ship. */

export type Surface = 'empty_state' | 'checklist' | 'help' | 'templates';
export type FirstAction = 'node' | 'edge' | 'label' | 'export' | 'board' | 'template';
/** `mermaid` is the export modal's sixth download. `embed` is the blog door,
 *  which has no in-app affordance yet — declared so it is already legal when it
 *  gets one. */
export type ExportFormat = 'svg' | 'png' | 'pdf' | 'json' | 'mermaid' | 'share' | 'embed';

export const EVENT_NAMES = ['surface_view', 'first_action', 'export', 'help_open'] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** The COMPLETE allowed prop set, per event. A key outside this row is refused. */
export const EVENT_PROPS: Record<EventName, readonly string[]> = {
  surface_view: ['surface'],
  first_action: ['action'],
  export: ['format'],
  help_open: [],
};

/** The COMPLETE allowed VALUES, per prop key — the schema's enums. */
export const PROP_VALUES: Record<string, readonly string[]> = {
  surface: ['empty_state', 'checklist', 'help', 'templates'],
  action: ['node', 'edge', 'label', 'export', 'board', 'template'],
  format: ['svg', 'png', 'pdf', 'json', 'mermaid', 'share', 'embed'],
};

type Umami = {track?: (name: string, props?: Record<string, string>) => void};

/** THE one function that touches the tracker. Anything the tables above do not
 *  allow is dropped, never sent and never queued — a refused call is a bug at
 *  the call site, and the harness is the tripwire. */
export function track(name: EventName, props: Record<string, string | undefined> = {}): void {
  const keys = EVENT_PROPS[name];
  if (!keys) return;
  const clean: Record<string, string> = {};
  for (const k of Object.keys(props)) {
    const v = props[k];
    if (!keys.includes(k) || v === undefined || !PROP_VALUES[k]?.includes(v)) return;
    clean[k] = v;
  }
  if (import.meta.env.DEV) {
    const w = window as unknown as {__gt?: [string, Record<string, string>][]};
    (w.__gt ??= []).push([name, clean]);
  }
  const u = (window as unknown as {umami?: Umami}).umami;
  if (u && typeof u.track === 'function') u.track(name, clean);
}

/** The in-memory half of the dedupe: a re-render must not even read storage
 *  again, and a BLOCKED storage still has this as its gate instead of firing on
 *  every render. */
const fired = new Set<string>();

function once(store: () => Storage, key: string, fire: () => void): void {
  if (fired.has(key)) return;
  fired.add(key);
  try {
    if (store().getItem(key)) return;
    store().setItem(key, '1');
  } catch { /* storage blocked — the set above is the gate */ }
  fire();
}

/** A guidance surface was SHOWN. Once per surface per session: this is the
 *  denominator for every other event. */
export function trackSurface(surface: Surface): void {
  once(() => sessionStorage, `diagram-studio:seen-${surface}`, () => track('surface_view', {surface}));
}

/** The FIRST time this browser performs `action`, forever — the activation
 *  funnel, in the checklist's own vocabulary. */
export function trackFirstAction(action: FirstAction): void {
  once(() => localStorage, `diagram-studio:did-${action}`, () => track('first_action', {action}));
}

/** Every export — NOT deduped: repetition is the value signal. It also settles
 *  the funnel's `export` row: the checklist's export task has NO tickTask call
 *  site anywhere in src/ (the panel shows it unticked even after an export), so
 *  the export itself is the only honest signal for `first_action{action:export}`.
 *  Idempotent — `first_action` is deduped forever inside trackFirstAction. */
export function trackExport(format: ExportFormat): void {
  trackFirstAction('export');
  track('export', {format});
}

/** The `?` sheet opened — THE counter-metric: help rising together with
 *  surface_view means the surfaces are not teaching. Not deduped. */
export function trackHelpOpen(): void {
  track('help_open');
}
