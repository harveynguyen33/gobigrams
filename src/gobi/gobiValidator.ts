/* ROUND GOBI-1 — the .gobi semantic validator (SPEC §3.4). Pure: AST in,
 * GobiError[] out (empty = valid). ALL errors in ONE pass — no early return.
 *
 * The parser already owns the checks it can do with the token in hand (shape
 * spelling with suggestions, attr keys, direction/theme values, block shape,
 * duplicate ids, edge endpoints declared-before-use). The validator owns the
 * checks that need the WHOLE document:
 *   · membership ids declared anywhere (forward refs),
 *   · a node/group in TWO groups (single parentId),
 *   · group containment cycles (incl. self-containment),
 *   · unknown icon (suggestion over the real lucide ICON_NAMES),
 *   · empty document (nothing compilable).
 * The §3.4 allows-list is deliberately NOT re-checked here: edge cycles,
 * self-edges, orphans and group-referencing edges pass through untouched. */

import {ICON_NAMES} from '../lucideIcons';
import {
  GOBI_COLOR_KEYS,
  GOBI_ICON_NAMES,
  gobiSuggest,
  type GobiAst,
  type GobiError,
} from './gobiTypes';

export function validateGobi(ast: GobiAst): GobiError[] {
  const errors: GobiError[] = [];
  const nodes = ast.statements.filter((s) => s.kind === 'node');
  const ids = new Set<string>(nodes.map((n) => n.id));

  /* icon vocabulary — the REAL lucide table (so the language and the picker
     cannot drift). GOBI_ICON_NAMES is filled here at most once. */
  if (GOBI_ICON_NAMES.length === 0) GOBI_ICON_NAMES.push(...ICON_NAMES);

  for (const n of nodes) {
    const icon = n.attrs?.icon;
    if (icon && !GOBI_ICON_NAMES.includes(icon)) {
      const sug = gobiSuggest(icon, GOBI_ICON_NAMES);
      errors.push({
        line: n.line, col: n.col,
        message: sug
          ? `icon "${icon}" isn't a board icon. Did you mean "${sug}"?`
          : `icon "${icon}" isn't a board icon — pick one from the icon picker`,
      });
    }
    // color re-check (the parser suggests spelling; the validator is the
    // safety net for colors that arrive by other paths, e.g. a future API)
    const color = n.attrs?.color;
    if (color && !GOBI_COLOR_KEYS.includes(color)) {
      errors.push({
        line: n.line, col: n.col,
        message: `color "${color}" isn't a board colour. Try: ${GOBI_COLOR_KEYS.join(', ')}.`,
      });
    }
  }

  /* membership: every member declared; one group max per id; no cycles. */
  const memberships = ast.statements.filter((s) => s.kind === 'membership');
  const parentOf = new Map<string, {group: string; line: number}>(); // member id -> owning group
  const groupMembers = new Map<string, Set<string>>(); // group id -> members (union of blocks)
  /** The spec's message wording uses the group's TITLE ("…in group "Cluster""),
   *  falling back to the id when the group was declared without one. */
  const groupLabel = new Map<string, string>();
  for (const n of nodes) if (n.nodeKind === 'group') groupLabel.set(n.id, n.title ?? n.id);
  const labelOf = (id: string) => groupLabel.get(id) ?? id;

  for (const m of memberships) {
    let set = groupMembers.get(m.group);
    if (!set) { set = new Set(); groupMembers.set(m.group, set); }
    for (const member of m.members) {
      set.add(member.id);
      if (!ids.has(member.id)) {
        errors.push({
          line: member.line, col: member.col,
          message: `group "${m.group}" mentions "${member.id}", which is never declared. Declare it first: ${member.id} = service "…"`,
        });
        continue;
      }
      const existing = parentOf.get(member.id);
      if (existing && existing.group !== m.group) {
        errors.push({
          line: member.line, col: member.col,
          message: `"${member.id}" is already in group "${labelOf(existing.group)}" — a node can live in only one group.`,
        });
        continue;
      }
      parentOf.set(member.id, {group: m.group, line: member.line});
    }
  }

  /* group containment cycles: follow parent chains from every group. */
  const groupIds = new Set(nodes.filter((n) => n.nodeKind === 'group').map((n) => n.id));
  for (const g of groupIds) {
    const seen = new Set<string>([g]);
    let cur: string | undefined = parentOf.get(g)?.group;
    while (cur) {
      if (seen.has(cur)) {
        errors.push({
          line: nodes.find((n) => n.id === g)!.line,
          col: nodes.find((n) => n.id === g)!.col,
          message: `group "${g}" contains itself through "${cur}" — groups cannot nest in a cycle.`,
        });
        break;
      }
      seen.add(cur);
      cur = parentOf.get(cur)?.group;
    }
  }

  /* empty document: nothing compilable AND no board header — a bare
     `board "Name"` compiles to an empty board (§3.1 step 7), while a
     zero-byte or comment-only doc refuses with the fix-naming message. */
  if (nodes.length === 0 && ast.statements.length === 0 && !ast.board) {
    errors.push({
      line: 1, col: 1,
      message: 'the document is empty — declare something first: api = service "API"',
    });
  }

  return errors;
}
