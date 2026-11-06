/* tips.ts — ONBOARD-P5 (2026-11-01): ONE-LINE TIPS AT FIRST USE.

   A tip is ONE sentence attached to the FIRST time the user performs an action.
   It is not a tour, not a step chain and not a modal, and it never appears on
   load: the trigger is the user's own act (the evidence behind the whole
   onboarding arc — pull revelation beats a pushed tour, docs/DAP-TOUR-RESEARCH.md
   §4 E5).

   THE FOUR GATES ARE THE CONTRACT, and they live HERE rather than in App so a
   harness can execute them (`checks/round-onboard-p5.mjs` bundles this module and
   runs it against a Map-backed storage stub — a source read proves nothing about
   which branch runs first):

     1. ONE tip per SESSION      — `sessionStorage` presence. A new tab is a new
                                   session; the same tab reloading is not.
     2. EACH tip once EVER       — one `localStorage` key per id.
     3. CLAIMED ON SHOW          — `takeTip` marks BOTH keys as it hands the line
                                   back, so "it showed" and "it is spent" cannot
                                   disagree. The × writes the same forever key,
                                   which makes dismissing permanent for free.
     4. A SETTINGS SWITCH        — default ON; off schedules nothing at all.

   A REFUSED TIP IS NEVER SPENT. Every gate returns BEFORE the claim, so a group
   created during a session that already showed the edge tip still fires its own
   tip in a later session. Claiming first and refusing after would silently eat
   three of the four tips in the first session.

   The registry names the file that fires each tip. That is not documentation:
   the harness asserts `fireTip('<id>')` really exists in that file, so a tip with
   no trigger is RED rather than dead data.
   `site` stays a PATH, not a function name — the same App call site serves the
   palette insert for group and table, so naming a function would over-promise. */

import {loadPref, savePref} from '../board/prefs';

export type TipId = 'edge' | 'group' | 'table' | 'export';

export type Tip = {
  id: TipId;
  /** ONE sentence, naming something the user cannot see on screen at that
   *  moment. No exclamation mark, never "click here". */
  line: string;
  /** The file that fires it — asserted by the harness. */
  site: string;
};

export const TIPS: Tip[] = [
  {id: 'edge', site: 'src/hooks/useConnections.ts',
    line: 'Labels sit on the line — select the edge and type in the Inspector.'},
  {id: 'group', site: 'src/app/App.tsx',
    line: 'Drag a node into the boundary to make it a child of the group.'},
  {id: 'table', site: 'src/app/App.tsx',
    line: 'Type in a cell to add a column; mark keys as pk or fk.'},
  {id: 'export', site: 'src/app/App.tsx',
    line: 'SVG keeps text selectable — outline only when a viewer lacks the fonts.'},
];

/** gate 4 — the Settings switch, through the ONE preference path (prefs.ts).
 *  Absent means ON: a fresh profile gets the tips, and `loadPref` plants nothing
 *  until the user makes an explicit choice. */
export const TIPS_PREF = 'tips';
export const tipsOn = (): boolean => loadPref(TIPS_PREF, true);
export const setTipsOn = (on: boolean): void => savePref(TIPS_PREF, on);

/** gate 2 — one key per id: a tip that has SHOWN never returns. */
const seenKey = (id: TipId) => `diagram-studio:tip-seen:${id}`;

export function tipSeen(id: TipId): boolean {
  try { return localStorage.getItem(seenKey(id)) === '1'; } catch { return false; }
}

/** The forever write. Idempotent on purpose: the show path and the × both call
 *  it, and a tip that was already spent must not become spendable again. */
export function markTipSeen(id: TipId): void {
  try { localStorage.setItem(seenKey(id), '1'); } catch { /* ignore */ }
}

/** gate 1 — ONE tip per session. sessionStorage, never localStorage: the next
 *  TIP may arrive in the next tab, not the next page load. */
export const SESSION_KEY = 'diagram-studio:tip-shown';

export function tipShownThisSession(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

function markSession(): void {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
}

/** The four gates in one place. Returns the line to show AND claims both keys,
 *  or returns null and claims NOTHING. */
export function takeTip(id: TipId): string | null {
  const tip = TIPS.find(t => t.id === id);
  if (!tip) return null;                    // only the four registered ids
  if (!tipsOn()) return null;               // gate 4 — the Settings switch
  if (tipShownThisSession()) return null;   // gate 1 — one per session
  if (tipSeen(id)) return null;             // gate 2 — once ever
  markSession();
  markTipSeen(id);
  return tip.line;
}
