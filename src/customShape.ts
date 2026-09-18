/* PACKAGE-N §8.1–§8.3 — CUSTOM SHAPES: the stored type, the sanitise pipeline
 * and the layout clamps. Pass 4a ships THIS MODULE ONLY; the import UI
 * (Settings → "Import SVG") ships as pass 4b, so nothing imports this file yet.
 * That is deliberate: the pipeline is testable and reviewable on its own.
 *
 * THE ONE-SENTENCE RULE: an imported SVG is hostile until this module says
 * otherwise, and it becomes hostile again the moment it comes back off disk
 * (§8.2 rule 8 — "treat the stored shape as untrusted on read").
 *
 * This module has NO imports from the app except `./colors` (which itself has
 * no imports, so no cycle is possible) plus `dompurify`. It must NEVER import
 * `./library`, because `./library` imports the `CustomShape` type from here.
 */
import DOMPurify from 'dompurify';
import {type ColorKey, isColorKey} from './colors';

/* ---------------------------------------------------------------------------
   §8.3 — the FOUR named clamps, plus the default box and the pre-parse cap.

   These are the spec's §8.3 named constants. They exist to prevent exactly four
   failures:
     1. zero / invisible size   → min 32 px
     2. enormous size          → max 512 px (Excalidraw's MAX_LINEAR_PX precedent)
     3. off-grid / fractional  → quantise to the grid pitch
     4. distortion             → aspect:'fixed' from the viewBox ratio

   The offered grid pitch set is `[8, 16, 20, 32, 64]` (GRID_SIZES in
   Settings.tsx) with **16** as the DEFAULT pitch. Every clamp below is written
   against an explicit `gridSize`, never against a hard-coded 16.
--------------------------------------------------------------------------- */
export const SHAPE_MIN_PX = 32;      // smallest legible box; ≈2 grid units at pitch 16
export const SHAPE_MAX_PX = 512;     // ≈4× the largest default container (group 320×200)
export const SHAPE_MIN_UNITS = 2;    // grid units, so it stays ≥32 at pitch 8
export const SHAPE_MAX_UNITS = 32;   // grid units, so it stays ≤512 at pitch 64
export const SHAPE_DEFAULT_PX = 64;  // the default box's long edge, before quantising
export const SHAPE_MAX_INPUT_BYTES = 512 * 1024;  // 512 KiB, checked BEFORE parsing

/** The default grid pitch when a caller cannot supply one (Settings.tsx default). */
export const DEFAULT_GRID_SIZE = 16;

/* ---------------------------------------------------------------------------
   §8.1 — the stored entry (`LibraryDoc.shapes[]`).
--------------------------------------------------------------------------- */
export type CustomShape = {
  title: string;          // palette label + tooltip
  tags: string;           // space-separated, sidebar search
  data: string;           // the sanitised SVG MARKUP, inline (NOT base64, NOT a data URI)
  w: number;              // REQUIRED — quantised + clamped already (layout safety)
  h: number;              // REQUIRED
  aspect: 'fixed';        // always fixed — prevents distortion
  colorKey: ColorKey;     // app invariant: never hex
  viewBox: string;        // first-class, kept out of markup so layout checks read it without parsing
  sanitizer: string;      // provenance, e.g. "dompurify/svg-profile"
  sanitizedAt: number;
  created: number;
};

/** Provenance stamped into `CustomShape.sanitizer`. */
export const SHAPE_SANITIZER_ID = 'dompurify/svg-profile';

/* ---------------------------------------------------------------------------
   §8.2 — the rejection vocabulary. A discriminated result, NEVER a thrown
   error: a bad file is a value the UI branches on, not an exception that blows
   past the import dialog.
--------------------------------------------------------------------------- */
export type SvgRejectReason =
  | 'too-large' | 'not-xml' | 'no-root-svg' | 'no-viewbox' | 'bad-viewbox'
  | 'no-size' | 'bad-size' | 'empty-markup';

export type SvgParseResult =
  | {ok: true; svg: string; viewBox: string; w: number; h: number}
  | {ok: false; reason: SvgRejectReason};

/* ---------------------------------------------------------------------------
   §8.2 rule 3 — the explicit strip lists handed to DOMPurify.
   Tag/attr matching inside DOMPurify is case-insensitive against its own
   normalised names, so both spellings of the camelCase tags are listed.
--------------------------------------------------------------------------- */
const FORBID_TAGS: string[] = [
  'style', 'script', 'foreignObject', 'foreignobject',
  'use', 'animate', 'animateTransform', 'animatetransform',
  'animateMotion', 'animatemotion', 'set',
];

const FORBID_ATTR: string[] = [
  'style',
  // every `on*` handler is already dropped by the SVG profile — that is NOT a
  // reason to trust it: the scrub pass below deletes them again by prefix.
  'onload', 'onclick', 'onerror', 'onbegin', 'onend', 'onrepeat', 'onactivate',
];

/* ---------------------------------------------------------------------------
   §8.2 rule 5 — the root rewrite.
--------------------------------------------------------------------------- */
const ROOT_ATTRS_TO_DROP = ['width', 'height', 'x', 'y'];
const PRESERVE_ASPECT = 'xMidYMid meet';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ---------------------------------------------------------------------------
   Small XML/DOM helpers. These run in a browser only (they need DOMParser).
--------------------------------------------------------------------------- */

const reject = (reason: SvgRejectReason): SvgParseResult => ({ok: false, reason});

/** True when the document carries a `<parsererror>` element, wherever it sits
 *  (namespaces differ between engines, so walk the tree instead of querying). */
function hasParseError(doc: Document): boolean {
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === 'parsererror') return true;
    for (let i = 0; i < node.childNodes.length; i++) {
      if (walk(node.childNodes[i])) return true;
    }
    return false;
  };
  return walk(doc);
}

/** First element in the tree whose localName is `name` (namespaces stripped). */
function firstByLocalName(root: Node, name: string): Element | null {
  if (root.nodeType === Node.ELEMENT_NODE && (root as Element).localName === name) return root as Element;
  for (let i = 0; i < root.childNodes.length; i++) {
    const hit = firstByLocalName(root.childNodes[i], name);
    if (hit) return hit;
  }
  return null;
}

/** Every element in the tree, root-first (used by the scrub pass). */
function allElements(root: Node, out: Element[] = []): Element[] {
  if (root.nodeType === Node.ELEMENT_NODE) out.push(root as Element);
  for (let i = 0; i < root.childNodes.length; i++) allElements(root.childNodes[i], out);
  return out;
}

/* ---------------------------------------------------------------------------
   §8.2 rule 2 — viewBox parsing. Exactly four finite numbers, w > 0, h > 0.
   Returns `null` when the string is not a legal viewBox.
--------------------------------------------------------------------------- */
function parseViewBox(value: string | null | undefined): {w: number; h: number} | null {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(/[\s,]+/).filter(p => p.length > 0);
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some(n => !Number.isFinite(n))) return null;
  const [, , w, h] = nums;
  if (!(w > 0) || !(h > 0)) return null;
  return {w, h};
}

/** Normalise a validated viewBox to `minX minY w h` with single spaces, so the
 *  stored string is stable and comparable without re-parsing. */
function normaliseViewBox(value: string): string {
  return value.trim().split(/[\s,]+/).filter(p => p.length > 0).join(' ');
}

/* ---------------------------------------------------------------------------
   §8.2 rule 5 — declared size. Only `<number>px` or a bare number counts.
   An unsupported unit (`em`, `%`, …) "counts as absent" per spec, so it makes
   the axis MISSING (→ no-size) rather than invalid.
--------------------------------------------------------------------------- */
type Dim = {kind: 'missing'} | {kind: 'bad'} | {kind: 'value'; n: number};

function parseDim(raw: string | null): Dim {
  if (raw == null) return {kind: 'missing'};
  const v = raw.trim();
  if (!v) return {kind: 'missing'};
  // A unit other than `px` is unsupported → treated as absent.
  const withoutPx = /px$/i.test(v) ? v.slice(0, -2).trim() : v;
  if (/[a-z%]/i.test(withoutPx)) return {kind: 'missing'};
  if (!/^[+-]?(\d|\.\d)/.test(withoutPx)) return {kind: 'bad'}; // "auto", "abc", ""
  const n = Number(withoutPx);
  if (!Number.isFinite(n) || n <= 0) return {kind: 'bad'};
  return {kind: 'value', n};
}

/* ---------------------------------------------------------------------------
   §8.2 rules 3+4+6 — the scrub, applied to the SANITISED FRAGMENT (DOM level).
   Ordering note: every removal below happens on the fragment, BEFORE the single
   XMLSerializer call, so no step ever re-parses or post-processes a string.
--------------------------------------------------------------------------- */
function scrubFragment(frag: DocumentFragment): void {
  const elements = allElements(frag);

  // (a) forbidden elements: style / foreignObject / use / animation / script.
  for (const el of elements) {
    const name = (el.localName || '').toLowerCase();
    if (FORBID_TAGS.some(t => t.toLowerCase() === name)) {
      el.parentNode?.removeChild(el);
    }
  }

  // (b) attributes: every `on*` handler (belt-and-braces — the SVG profile
  //     already drops most of them), plus the reference rules below.
  for (const el of allElements(frag)) {
    const name = (el.localName || '').toLowerCase();
    const isRefHost = name === 'image' || name === 'a' || name === 'filter' || name === 'pattern';
    for (const attr of Array.from(el.attributes)) {
      const an = attr.name.toLowerCase();
      const av = (attr.value || '').trim();
      if (an.startsWith('on')) { el.removeAttribute(attr.name); continue; }
      if (an === 'href' || an === 'xlink:href' || an === 'src') {
        if (isRefHost) {
          // `image`/`a`/`filter`/`pattern`: data: and image/* only. Everything
          // else (http:, file:, //evil, blob:, …) goes.
          const okScheme = /^data:/i.test(av) || /^image\//i.test(av);
          if (!okScheme) el.removeAttribute(attr.name);
        } else if (!av.startsWith('#')) {
          // Anywhere else: same-document `#id` fragments only.
          el.removeAttribute(attr.name);
        }
      }
    }
  }

  // (c) processing instructions and DOCTYPE / internal-entity declarations.
  //     XMLSerializer would happily re-emit these; they must not survive.
  const killNodes = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.PROCESSING_INSTRUCTION_NODE || child.nodeType === Node.DOCUMENT_TYPE_NODE) {
        node.removeChild(child);
        continue;
      }
      if (child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.DOCUMENT_NODE
          || child.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        killNodes(child);
      }
    }
  };
  killNodes(frag);
}

/** Last-resort regex net over the serialised fragment. Applied ONCE, here,
 *  before the string leaves this function — never to the stored `data` later.
 *  It only drops things the DOM pass cannot express as an element/attribute. */
function scrubSerialised(markup: string): string {
  return markup
    .replace(/<!DOCTYPE[^>[]*(\[[^\]]*\])?>/gi, '')
    .replace(/<!ENTITY[^>]*>/gi, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/\s(on[a-z]+)\s*=\s*("([^"]*)"|'([^']*)')/gi, '')
    .replace(/(?:href|src)\s*=\s*("|')\s*javascript:[^"']*\1/gi, '');
}

/* ---------------------------------------------------------------------------
   §8.2 — sanitizeSvgMarkup: the whole pipeline, in the spec's exact order.
--------------------------------------------------------------------------- */
export function sanitizeSvgMarkup(raw: string): SvgParseResult {
  // 1. size cap BEFORE parsing — a linear-time check, so a 500 MB "file" never
  //    reaches the parser (the boards `MAX_BODY` 5 MiB is only the backstop).
  if (typeof raw !== 'string' || raw.length > SHAPE_MAX_INPUT_BYTES) return reject('too-large');

  // 2. parse as XML. Anything the XML parser rejects is not an SVG we'll touch.
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  } catch {
    return reject('not-xml');
  }
  if (!doc || !doc.documentElement) return reject('not-xml');
  if (hasParseError(doc)) return reject('not-xml');

  // 3. exactly one root, and it must be <svg> (namespaces stripped → localName).
  const sourceRoot = doc.documentElement;
  if (!sourceRoot || sourceRoot.localName !== 'svg') return reject('no-root-svg');

  // 4. numeric, positive viewBox.
  const vbAttr = sourceRoot.getAttribute('viewBox');
  if (vbAttr == null || !vbAttr.trim()) return reject('no-viewbox');
  if (!parseViewBox(vbAttr)) return reject('bad-viewbox');
  const viewBox = normaliseViewBox(vbAttr);

  // 5. declared size (float, optional trailing `px`; other units count absent).
  const dw = parseDim(sourceRoot.getAttribute('width'));
  const dh = parseDim(sourceRoot.getAttribute('height'));
  if (dw.kind === 'missing' || dh.kind === 'missing') return reject('no-size');
  if (dw.kind === 'bad' || dh.kind === 'bad') return reject('bad-size');
  const declaredW = dw.n;
  const declaredH = dh.n;

  // 6. sanitise the markup with DOMPurify's SVG profile, get a FRAGMENT back,
  //    then scrub that fragment ourselves. Never innerHTML here or anywhere.
  let frag: DocumentFragment;
  try {
    frag = DOMPurify.sanitize(raw, {
      USE_PROFILES: {svg: true},
      RETURN_DOM_FRAGMENT: true,
      FORBID_TAGS,
      FORBID_ATTR,
    }) as unknown as DocumentFragment;
  } catch {
    return reject('not-xml');
  }
  if (!frag) return reject('empty-markup');

  scrubFragment(frag);

  // 7. rewrite the root on the fragment: drop width/height/x/y, keep viewBox,
  //    force preserveAspectRatio, guarantee the SVG namespace for `data:` URIs.
  const cleanRoot = firstByLocalName(frag, 'svg');
  if (!cleanRoot) return reject('empty-markup');
  for (const attr of ROOT_ATTRS_TO_DROP) cleanRoot.removeAttribute(attr);
  cleanRoot.setAttribute('viewBox', viewBox);
  cleanRoot.setAttribute('preserveAspectRatio', PRESERVE_ASPECT);
  if (!cleanRoot.getAttribute('xmlns')) cleanRoot.setAttribute('xmlns', SVG_NS);

  // An <svg> with no element children draws nothing — that is empty markup.
  if (cleanRoot.childElementCount === 0) return reject('empty-markup');

  // 6/7 continued — ONE serialisation of the scrubbed fragment.
  let svg: string;
  try {
    svg = new XMLSerializer().serializeToString(cleanRoot);
  } catch {
    return reject('empty-markup');
  }
  svg = scrubSerialised(svg).trim();
  if (!svg) return reject('empty-markup');

  return {ok: true, svg, viewBox, w: declaredW, h: declaredH};
}

/* ---------------------------------------------------------------------------
   §8.2 rule 6 — render as an IMAGE, never as markup.

   `data:image/svg+xml,` + encodeURIComponent(svg) is the MDN-documented
   context where scripts are disabled and external resources cannot load; that
   is WHY custom shapes are rendered through `<img src=…>` (or CSS
   background-image) and never through innerHTML / dangerouslySetInnerHTML.
   The sanitiser is the first line of defence, this context is the second.
--------------------------------------------------------------------------- */
export function svgDataUri(svg: string): string {
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/* ---------------------------------------------------------------------------
   §8.3 — PURE GEOMETRY. No DOM, no DOMPurify: these must be runnable in plain
   Node so the clamps can be verified without a browser.
--------------------------------------------------------------------------- */

/** The grid pitch we can trust: anything non-finite or ≤ 0 falls back to 16. */
function normaliseGrid(gridSize: number): number {
  return Number.isFinite(gridSize) && gridSize > 0 ? gridSize : DEFAULT_GRID_SIZE;
}

/** round(px / grid) * grid, with the pitch guarded. */
export function quantisePx(px: number, gridSize: number): number {
  const g = normaliseGrid(gridSize);
  const safe = Number.isFinite(px) ? px : 0;
  return Math.round(safe / g) * g;
}

/** The quantised unit window for a pitch: the spec's [SHAPE_MIN_UNITS,
 *  SHAPE_MAX_UNITS] intersected with the pitch's own equivalents of the
 *  [SHAPE_MIN_PX, SHAPE_MAX_PX] bound, so a result is always BOTH on-grid and
 *  inside the px window at every offered pitch (8/16/20/32/64). At the default
 *  pitch 16 this is exactly `clamp(round(px/16), 2, 32) * 16`.
 */
function unitWindow(gridSize: number): {min: number; max: number} {
  const g = normaliseGrid(gridSize);
  const min = Math.max(SHAPE_MIN_UNITS, Math.ceil(SHAPE_MIN_PX / g));
  const max = Math.min(SHAPE_MAX_UNITS, Math.floor(SHAPE_MAX_PX / g));
  return {min, max: Math.max(min, max)};
}

/** Clamp each axis into [SHAPE_MIN_PX, SHAPE_MAX_PX] AND quantise to the pitch,
 *  staying inside [SHAPE_MIN_UNITS, SHAPE_MAX_UNITS] grid units. Zero,
 *  negative and non-finite inputs come out as the MINIMUM box, never as zero. */
export function clampShapeSize(w: number, h: number, gridSize: number): {w: number; h: number} {
  const g = normaliseGrid(gridSize);
  const {min, max} = unitWindow(g);
  const axis = (px: number): number => {
    const usable = Number.isFinite(px) && px > 0 ? px : SHAPE_MIN_PX;
    const bounded = Math.min(Math.max(usable, SHAPE_MIN_PX), SHAPE_MAX_PX);
    const units = Math.round(bounded / g);
    return Math.min(Math.max(units, min), max) * g;
  };
  return {w: axis(w), h: axis(h)};
}

/** The default box for a viewBox: long edge SHAPE_DEFAULT_PX, the other axis
 *  following the viewBox ratio, the pair quantised through the same clamp.
 *  An unreadable viewBox falls back to a square default box. Never throws and
 *  never returns a value outside [SHAPE_MIN_PX, SHAPE_MAX_PX]. */
export function defaultShapeSize(viewBox: string, gridSize: number): {w: number; h: number} {
  const vb = parseViewBox(viewBox);
  let w: number;
  let h: number;
  if (!vb) {
    w = SHAPE_DEFAULT_PX;
    h = SHAPE_DEFAULT_PX;
  } else if (vb.w >= vb.h) {
    w = SHAPE_DEFAULT_PX;                                   // landscape / square
    h = Math.round((SHAPE_DEFAULT_PX * vb.h) / vb.w);
  } else {
    h = SHAPE_DEFAULT_PX;                                   // portrait
    w = Math.round((SHAPE_DEFAULT_PX * vb.w) / vb.h);
  }
  return clampShapeSize(w, h, gridSize);
}

/* ---------------------------------------------------------------------------
   §8.1 — build a storable entry from raw file text.
--------------------------------------------------------------------------- */
export function newCustomShape(input: {
  raw: string; title: string; tags?: string; colorKey: ColorKey; gridSize: number; now?: number;
}): {ok: true; shape: CustomShape} | {ok: false; reason: SvgRejectReason} {
  const parsed = sanitizeSvgMarkup(input.raw);
  if ('reason' in parsed) return {ok: false, reason: parsed.reason};

  const base = defaultShapeSize(parsed.viewBox, input.gridSize);
  const size = clampShapeSize(base.w, base.h, input.gridSize);
  const now = input.now ?? Date.now();

  return {
    ok: true,
    shape: {
      title: input.title,
      tags: input.tags ?? '',
      data: parsed.svg,
      w: size.w,
      h: size.h,
      aspect: 'fixed',
      colorKey: input.colorKey,
      viewBox: parsed.viewBox,
      sanitizer: SHAPE_SANITIZER_ID,
      sanitizedAt: now,
      created: now,
    },
  };
}

/* ---------------------------------------------------------------------------
   §8.2 rule 8 — UNTRUSTED ON READ.

   A stored entry can be hand-edited, imported from elsewhere or written by an
   older build, so this is the gate that runs before anything trusts it.

   SCOPE OF THIS GATE: it is the CHEAP FIRST GATE — DOM-free (so it is testable
   in Node) and structural only. Pass 4b re-runs the FULL `sanitizeSvgMarkup`
   over `data` on read wherever the entry can reach the canvas; this function
   never replaces that, it only refuses the obviously hostile before the full
   pass runs.
--------------------------------------------------------------------------- */
const UNSAFE_MARKUP_PATTERNS: RegExp[] = [
  /<script/i,           // script elements
  /\son[a-z]+\s*=/i,    // any on* handler attribute
  /<foreignObject/i,    // foreignObject
  /<style/i,            // style elements
  /javascript:/i,       // javascript: scheme
];

/** Cheap structural scrub: returns true when the markup is obviously unsafe. */
function looksUnsafe(markup: string): boolean {
  return UNSAFE_MARKUP_PATTERNS.some(re => re.test(markup));
}

const isFinitePositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function parseCustomShapeEntry(
  raw: unknown,
  gridSize: number,
): {ok: true; shape: CustomShape} | {ok: false; reason: string} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {ok: false, reason: 'not-an-object'};
  const e = raw as Record<string, unknown>;

  if (typeof e.title !== 'string') return {ok: false, reason: 'bad-title'};
  if (typeof e.tags !== 'string') return {ok: false, reason: 'bad-tags'};
  if (typeof e.data !== 'string' || !e.data.trim()) return {ok: false, reason: 'bad-data'};
  if (!isFinitePositive(e.w)) return {ok: false, reason: 'bad-w'};
  if (!isFinitePositive(e.h)) return {ok: false, reason: 'bad-h'};
  if (e.aspect !== 'fixed') return {ok: false, reason: 'bad-aspect'};
  if (!isColorKey(e.colorKey)) return {ok: false, reason: 'bad-color-key'};
  if (typeof e.viewBox !== 'string' || !parseViewBox(e.viewBox)) return {ok: false, reason: 'bad-viewbox'};
  if (typeof e.sanitizer !== 'string') return {ok: false, reason: 'bad-sanitizer'};
  if (typeof e.sanitizedAt !== 'number' || !Number.isFinite(e.sanitizedAt)) return {ok: false, reason: 'bad-sanitizedAt'};
  if (typeof e.created !== 'number' || !Number.isFinite(e.created)) return {ok: false, reason: 'bad-created'};
  if (looksUnsafe(e.data)) return {ok: false, reason: 'unsafe-markup'};

  const size = clampShapeSize(e.w, e.h, gridSize);   // never trust the stored numbers
  return {
    ok: true,
    shape: {
      title: e.title,
      tags: e.tags,
      data: e.data,
      w: size.w,
      h: size.h,
      aspect: 'fixed',
      colorKey: e.colorKey,
      viewBox: normaliseViewBox(e.viewBox),
      sanitizer: e.sanitizer,
      sanitizedAt: e.sanitizedAt,
      created: e.created,
    },
  };
}

/* ---------------------------------------------------------------------------
   HOUSE RULES for anyone extending this file (PACKAGE-N §8.2, last paragraph):

     • SANITISE ON IMPORT **AND** RE-APPLY ON READ. A library file on disk is
       untrusted input every single time it is opened; there is no "already
       sanitised" fast path that skips the pipeline.
     • NEVER POST-PROCESS THE SANITISED STRING. The `data` a CustomShape holds
       is final. String surgery on it downstream (in a component, on export, on
       a theme change) is how a bypass gets introduced.
     • NEVER WIDEN THE ALLOW-LIST. `FORBID_TAGS` / `FORBID_ATTR` and the scrub
       pass are the contract; adding an exception for one "legitimate" file is
       not a fix, it is the vulnerability.
     • NEVER innerHTML / dangerouslySetInnerHTML. Custom shapes reach the canvas
       as `<img src={svgDataUri(shape.data)}>` only.
--------------------------------------------------------------------------- */
