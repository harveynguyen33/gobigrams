/* PACKAGE-TEMPLATES §3.2 — THE ONE TEMPLATE CATALOG.

   Every surface that lists templates (the New-board dialog today, the gallery
   tomorrow) reads THIS selector, so a new template or a whole new family appears
   everywhere with no UI edit. It is deliberately DOM-free and dependency-free:
   it imports nothing but `presets.ts`, so a Node probe can bundle and execute it
   against the shipped data (checks/package-templates.mjs does exactly that).

   THE FAMILY IS THE PRESET. There is no `family` field on `TemplateSpec` on
   purpose: a template already belongs to a preset, its id/label/hint already
   carry the family's identity, and a second identity string could drift from
   `PRESETS`. The two loops below are therefore the SAME two loops the dialog
   uses — a preset with no templates contributes no family (so `architecture`
   and `custom` are absent today and both appear the day they gain one).
*/
import {PRESETS, TEMPLATE_LEVELS, type PresetId, type TemplateLevel, type TemplateSpec} from './presets';

export type TemplateEntry = {
  preset: PresetId;
  presetLabel: string;
  presetHint: string;
  t: TemplateSpec;
  /** `null` = the template declares no level (the legacy ones). */
  level: TemplateLevel | null;
};

export type TemplateGroup = {
  level: TemplateLevel | null;
  /** `TEMPLATE_LEVELS[level].label`, or the PRESET's own label for the null group
   *  (e.g. "Flowchart"), so the legacy rows still say which family they are. */
  label: string;
  entries: TemplateEntry[];
};

export type TemplateFamily = {
  preset: PresetId;
  label: string;
  hint: string;
  groups: TemplateGroup[];
};

/** FIXED level order. The `null` group is always emitted LAST, whatever order the
 *  templates happen to be declared in, which is what keeps the unlevelled legacy
 *  templates reachable instead of reading as a stray tail. */
export const TEMPLATE_LEVEL_ORDER: TemplateLevel[] = ['basic', 'advanced', 'complex'];

/** Deterministic inside a LEVELLED group: `order ?? 0` ascending, then `id`. A tie
 *  on `order` therefore cannot re-shuffle between reloads or between two probes. */
const byOrderThenId = (a: TemplateEntry, b: TemplateEntry): number =>
  (a.t.order ?? 0) - (b.t.order ?? 0) || (a.t.id < b.t.id ? -1 : a.t.id > b.t.id ? 1 : 0);

/** The UNLEVELLED tail keeps DECLARATION order — no id tiebreak.
 *
 *  WHY (found in verification of PACKAGE-TEMPLATES pass 1): the four legacy
 *  templates declare no `level` AND no `order`, so the levelled comparator fell
 *  straight through to the id tiebreak and re-alphabetised them. C4 then read
 *  "C4 Container" BEFORE "C4 Context" — i.e. the L2 drill-down before the L1
 *  overview its own hint advertises — reversing the authored order the flat list
 *  used to show. A tiebreak that no field asks for is not determinism, it is a
 *  silent re-order. These templates have no ladder to sort by, so their authored
 *  order IS the intended order; `Array.prototype.sort` is stable, so returning 0
 *  preserves it exactly. */
const byOrderOnly = (a: TemplateEntry, b: TemplateEntry): number => (a.t.order ?? 0) - (b.t.order ?? 0);

export function templateCatalog(): TemplateFamily[] {
  const families: TemplateFamily[] = [];

  for (const id of Object.keys(PRESETS) as PresetId[]) {
    const preset = PRESETS[id];
    const templates = preset.templates ?? [];
    if (!templates.length) continue;

    const entries: TemplateEntry[] = templates.map(t => ({
      preset: id,
      presetLabel: preset.label,
      presetHint: preset.hint,
      t,
      level: t.level ?? null,
    }));

    const groups: TemplateGroup[] = [];
    for (const level of TEMPLATE_LEVEL_ORDER) {
      const list = entries.filter(e => e.level === level).sort(byOrderThenId);
      if (list.length) groups.push({level, label: TEMPLATE_LEVELS[level].label, entries: list});
    }
    const unlevelled = entries.filter(e => e.level === null).sort(byOrderOnly);
    if (unlevelled.length) groups.push({level: null, label: preset.label, entries: unlevelled});

    families.push({preset: id, label: preset.label, hint: preset.hint, groups});
  }

  return families;
}
