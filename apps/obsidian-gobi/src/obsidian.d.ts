/* STEP-6-OBSIDIAN — the minimal ambient shape of the 'obsidian' module this
 * plugin uses. The real types ship with the obsidian npm package (which is
 * not installable outside Obsidian's own sample-plugin setup); declaring only
 * what we call keeps the surface auditable: if the plugin grows a second
 * Obsidian API use, it grows a line here, and the "render only" scope of
 * SPEC-GOBI-CORE §E stays visible. */
declare module 'obsidian' {
  export type EventRef = unknown;

  export interface MarkdownPostProcessorContext {
    sourcePath: string;
    [key: string]: unknown;
  }

  export class Plugin {
    app: App;
    manifest: {id: string; name: string; version: string; [key: string]: unknown};
    constructor(app: App, manifest: Plugin['manifest']);
    onload(): void | Promise<void>;
    onunload(): void;
    /** Registers a ```lang code-block processor for reading view AND live preview. */
    registerMarkdownCodeBlockProcessor(
      language: string,
      processor: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void | Promise<void>,
    ): void;
    registerEvent(eventRef: EventRef): void;
    registerDomEvent<K extends keyof HTMLElementEventMap>(
      el: HTMLElement, type: K, callback: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void,
    ): void;
  }

  export interface Workspace {
    /** 'css-change' fires when the vault's theme or snippets change. */
    on(name: 'css-change', callback: () => void): EventRef;
    on(name: string, callback: (...data: unknown[]) => void): EventRef;
  }

  export interface App {
    workspace: Workspace;
  }

  export class Notice {
    constructor(message: string, duration?: number);
  }
}
