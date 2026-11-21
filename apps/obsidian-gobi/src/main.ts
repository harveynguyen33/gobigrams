/* STEP-6-OBSIDIAN — the Obsidian plugin. Render only: one code-block
 * processor for ```gobi, reading view and live preview alike, everything
 * else delegated to the shared core (SPEC-GOBI-CORE §E: "the processor is
 * ~40 lines around the shared core").
 *
 * No settings in v1 (the spec allows at most a theme/scale choice; the theme
 * follows the vault, so there is nothing to configure). No canvas, no
 * editing, no sync-back — out of scope by the spec. */

import {Plugin} from 'obsidian';
import {baseTokens, errorHtml, renderGobiBlock, successHtml} from './render';
import {liveObsidianGetter, obsidianTokens} from './obsidianTheme';

type Block = {el: HTMLElement; source: string};

/* Re-exported for the headless test and any host that wants the render entry
 * without the Obsidian wrapper (§F: the corpus drives the BUILT main.js). */
export {BUNDLED_CORE, baseTokens, errorHtml, errorText, renderGobiBlock, successHtml} from './render';
export {obsidianTokens} from './obsidianTheme';

export default class GobiPlugin extends Plugin {
  /** Rendered blocks, so a vault theme change ('css-change') can re-render
   * them with the new Obsidian variables. Detached els are pruned lazily. */
  private blocks: Block[] = [];

  onload(): void {
    this.registerMarkdownCodeBlockProcessor('gobi', (source, el) => {
      this.paint(source, el);
      this.blocks.push({el, source});
    });
    this.registerEvent(this.app.workspace.on('css-change', () => this.repaintAll()));
  }

  onunload(): void {
    this.blocks = [];
  }

  /** Pick the token table: Obsidian's variables when a DOM is present,
   * otherwise the dark baseline the corpus goldens pin (headless test path —
   * also the honest fallback if Obsidian ever renders before styles load). */
  private theme(): {theme: string; tokens: Record<string, string>} {
    const isDark =
      typeof document === 'undefined' ||
      (document.body && document.body.classList.contains('theme-dark'));
    const base = baseTokens(isDark);
    const get = liveObsidianGetter();
    if (!get) return {theme: 'dark', tokens: base};
    return {theme: isDark ? 'dark' : 'light', tokens: obsidianTokens(get, base)};
  }

  private paint(source: string, el: HTMLElement): void {
    el.classList.add('gobi-block');
    try {
      const r = renderGobiBlock(source, this.theme());
      /* innerHTML is safe here: the string is either the core's SVG (a pure
       * renderer whose text escaping the corpus pins via escapes.gobi) or
       * errorHtml(), which escapes every error field through esc(). */
      el.innerHTML = r.ok ? successHtml(r.svg) : errorHtml(r.errors);
    } catch (e) {
      /* No silent failures: the core is pure, but a host surprise still gets
       * a visible block, never a broken note (§E: "never a throw"). */
      el.innerHTML = errorHtml([
        {line: 0, col: 0, message: `gobi renderer failed: ${String((e as Error)?.message ?? e)}`},
      ]);
    }
  }

  private repaintAll(): void {
    const live: Block[] = [];
    for (const b of this.blocks) {
      if (b.el && b.el.isConnected) {
        live.push(b);
        this.paint(b.source, b.el);
      }
    }
    this.blocks = live;
  }
}
