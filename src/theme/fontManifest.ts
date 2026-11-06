/* ROUND AZ (t_96100cb2) — the committed-font MANIFEST.
 *
 * ONE table mapping the family names the text rows carry to the committed
 * byte source under public/fonts/. Kept separate from the fetch/parse code
 * (fontFiles.ts) so the harness can pin this table at source level.
 *
 * The rows' families arrive as STACKS ('JetBrains Mono', ui-monospace, …' —
 * or one of the ROUND W opt-in stacks). resolution = the FIRST stack part
 * that names a shipped family (the same lenient matching localFontBytes
 * applies, minus the API).
 */

export type ShippedFace = {
  /** the @font-face family name (exactly as styles.css declares it) */
  family: string;
  /** the committed variable subset the shaper + embed path read */
  file: string;
};

/** The faces this tree ships BYTES for (file-first outline coverage). The
 * four opt-in ROUND W families are NOT here: the tree carries only their
 * static 400/700 subsets, and a static 700 file cannot cover 650 — those
 * keep the localFontBytes fallback (and, failing that, the visible note). */
export const SHIPPED_FACES: ShippedFace[] = [
  {family: 'JetBrains Mono', file: '/fonts/jetbrains-mono-variable.ttf'},
  {family: 'Inter', file: '/fonts/inter-variable.ttf'},
];

export const SHIPPED_FAMILIES: string[] = SHIPPED_FACES.map(f => f.family);

/** family stack -> the shipped face, or null when the tree ships no bytes
 *  for it (the caller falls back / reports visibly). */
export function fontFileForFamily(familyStack: string): string | null {
  const parts = familyStack.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
  for (const p of parts) {
    const hit = SHIPPED_FACES.find(f => f.family.toLowerCase() === p.toLowerCase());
    if (hit) return hit.file;
  }
  return null;
}
