# PALETTE-4 — Custom shapes: data format, persistence, SVG safety, layout safety

Cluster scope: user-defined custom shapes for Diagram Studio's palette. Three questions —
**where does the library live locally**, **what does a shape item look like on disk**, and
**what must a user-supplied SVG be prevented from doing** (to the DOM and to the layout).

Harvey's decision (given mid-task) is binding and this report is written to it:

1. Custom shapes live in a **separate personal library reused across boards** — *not* inside
   each board's JSON. The open question is only *which* local store.
2. The source of shapes is **flexible, Excalidraw-style**: the user drags/uploads an **SVG**,
   not merely picks from a built-in icon set. So SVG import is in scope and sanitisation is
   the centre of gravity.
3. The rule **"không phá layout là chính"** (chiefly: it must not break the layout) maps to
   hard numeric clamps.

All three tools studied here (draw.io, Excalidraw, React Flow) are open source; where possible
the claim is anchored to docs or to the actual source file, not to a blog.

---

## 1. SVG safety — what is the real risk, and what must a sanitiser strip

### 1.1 Why SVG is not "just an image"

An SVG file is an XML document that can carry `<script>`, event-handler attributes and URL
attributes. MDN documents the SVG `<script>` element as the SVG equivalent of the HTML one,
with `href` instead of `src` — i.e. it executes
(<https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/script>).
The OWASP XSS Filter Evasion Cheat Sheet uses `<svg/onload=alert('XSS')>` and
`<g onload="javascript:alert(1)">` as canonical SVG payloads, and notes that a "polyglot"
payload exists which executes in HTML, script-string, JavaScript and URL contexts at once:
`` javascript:/*--></title></style></textarea></script></xmp> <svg/onload='+/"`/+/onmouseover=1/+/[*/[]/+alert(42);//'> ``
(<https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html>).

OWASP's File Upload Cheat Sheet treats "client-side active content (XSS, CSRF, etc.) that could
endanger other users" as one of the five file-upload threats, and its first mitigation for
uploaded images is **content rewriting**, which "destroys any kind of malicious content injected
in an image"
(<https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>).

**The cheapest structural mitigation available to a diagram editor** is documented by MDN under
"SVG as an image": when SVG is used as an *image* (HTML `<img>`, CSS `background-image`, CSS
`content`, SVG `<image>`, `<feImage>`, canvas `drawImage`), browsers restrict it —

> * JavaScript is disabled.
> * External resources (e.g. images, stylesheets) cannot be loaded, though they can be used if
>   inlined through `data:` URLs.
> * `:visited`-link styles aren't rendered.

— and those restrictions do **not** apply when the SVG is embedded as a document via `<iframe>`,
`<object>` or `<embed>`
(<https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_Image>).

**Consequence for the design: render a custom shape as `<img src="data:image/svg+xml,…">` (or a
CSS background), never inline it into the DOM and never via `<iframe>/<object>/<embed>`.** That
alone kills the script vector. Sanitisation is still required, because (a) it is defence in depth
if the sink ever changes, and (b) an `<img>` context does **not** stop the SVG from issuing
network requests for *inlined* `data:` resources or from being a phishing surface.

Note the important limit of the image context: an SVG rendered as an image can still contain
`<image href="…">` pointing at a remote URL. DOMPurify explicitly lists "HTTP leaks" as a
non-goal — it "will **NOT** reliably stop HTML that requests external resources (tracking
pixels, prefetch, etc.)"
(<https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model>). So remote-reference
stripping is ours to do, not the sanitiser's.

### 1.2 What DOMPurify actually does (the standard mitigation)

DOMPurify is "a DOM-only, super-fast, uber-tolerant XSS sanitizer for HTML, MathML and SVG"
(<https://github.com/cure53/DOMPurify>). Two facts from its own README matter here:

- **By default it permits HTML, SVG *and* MathML.** To restrict, use profiles; and note that
  `USE_PROFILES` **overrides** `ALLOWED_TAGS`, so the two must not be combined:

  ```js
  // allow all safe SVG elements and SVG Filters, no HTML or MathML
  const clean = DOMPurify.sanitize(dirty, { USE_PROFILES: { svg: true, svgFilters: true } });
  ```

- DOMPurify is **not a CSS sanitiser**: "Both the `<style>` *element* and the `style` *attribute*
  are allowed by default… If you don't need CSS, drop it with `FORBID_TAGS: ['style']` and
  `FORBID_ATTR: ['style']`; if you keep it, you own the CSS risk."
  (<https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model>)

Two further DOMPurify rules that shape the integration:

- **Sanitise for the sink you use, then do not post-process.** DOMPurify's non-goals: "Markup
  context flipping — DOMPurify will **NOT** protect you against feeding HTML-sanitized output
  into a different markup context. If you sanitize HTML and then drop it into SVG, MathML, an XML
  document, an attribute value… strange and exploitable things can happen." Same page.
  The README's foot-gun section says the same: if you first sanitise and then modify the markup,
  "you might easily **void the effects of sanitization**".
  (<https://github.com/cure53/DOMPurify>)
- **Never widen the allow-list** (`ADD_TAGS`, `ADD_ATTR`, `ALLOW_UNKNOWN_PROTOCOLS`, loosened
  `ALLOWED_URI_REGEXP`, `SAFE_FOR_XML: false`, `SANITIZE_DOM: false`, …) — "Most application-specific
  bypasses are born the moment someone widens the allow-list."
  (<https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model>)

### 1.3 The concrete element/attribute block list

Because DOMPurify ships its allow-lists as source, the "what is dangerous" question can be
answered exactly rather than by recollection. From `src/tags.ts`
(<https://raw.githubusercontent.com/cure53/DOMPurify/main/src/tags.ts>):

`svgDisallowed` — SVG elements DOMPurify refuses by default, with its own comment: *"List of SVG
elements that are disallowed by default. We still need to know them so that we can do namespace
checks properly in case one wants to add them to allow-list."*

```
animate, color-profile, cursor, discard, font-face, font-face-format, font-face-name,
font-face-src, font-face-uri, foreignobject, hatch, hatchpath, mesh, meshgradient,
meshpatch, meshrow, missing-glyph, script, set, solidcolor, unknown, use
```

Note that **`<use>` is forbidden by default** — it is a reference primitive
(`<use href="…">`) and can pull in external content. The SVG profile's allowed list
(`svg` in the same file) is geometry/paint only: `svg, a, altglyph, … circle, clippath, defs,
desc, ellipse, filter, font, g, glyph, glyphref, hkern, image, line, lineargradient, marker,
mask, metadata, mpath, part, path, pattern, polygon, polyline, radialgradient, rect, stop,
style, switch, symbol, text, textpath, title, tref, tspan, view, vkern`.

From `src/attrs.ts` (<https://raw.githubusercontent.com/cure53/DOMPurify/main/src/attrs.ts>),
the SVG attribute allow-list is a fixed set of geometry/paint attributes
(`d`, `points`, `transform`, `viewbox`, `fill`, `stroke*`, `filter`, `opacity`, … plus
`href`, `style`, `class`, `id`, `xmlns`). The `xml` list adds `xlink:href`, `xml:id`,
`xlink:title`, `xml:space`, `xmlns:xlink`.

For the attributes rather than the elements, the threat-model page is explicit
(<https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model>):

| Attribute | Default | Why dangerous | Guidance (quoted/paraphrased) |
|---|---|---|---|
| `on*` (every event handler) | **forbidden** | "Direct script execution." | "Never allow-list these." |
| `href`, `src`, `action`, `cite`, `poster`, `background`, `srcset`, `xlink:href` | allowed, **URI-validated** | "URL sinks (`javascript:`, `data:`, ...)" | "Don't weaken the URL check: avoid `ALLOW_UNKNOWN_PROTOCOLS`, a loosened `ALLOWED_URI_REGEXP`, or adding these to `ADD_URI_SAFE_ATTR`." |
| `style` (attribute) | allowed | inline CSS, unsanitised | `FORBID_ATTR: ['style']` if you don't need it |
| `class`, `id` | allowed | DOM clobbering | `SANITIZE_NAMED_PROPS` prefixes them `user-content-` |
| `xmlns` | allowed | needed for SVG; misuse is namespace confusion | "Leave the namespace check on." |

### 1.4 Sanitisation rule set (recommended, exact)

Applied on **import** (server side is optional; do it in the browser before the string is ever
stored or rendered) and re-applied on **read**, because the threat model must include a library
file that a user hand-edited or imported from elsewhere.

1. **Parse as XML, not HTML.** Feed the string through `DOMParser` with
   `application/xml` + `image/svg+xml` semantics; reject anything that does not parse.
2. **Require a single root `<svg>`** with a `viewBox` and a numeric, positive width/height.
   Reject if the root is not `svg` (DOMPurify will return text nodes otherwise).
3. **Sanitise with the SVG profile only** — no HTML, no MathML:
   `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true }, RETURN_DOM_FRAGMENT: true })`,
   then serialise the fragment yourself into the string you store. Returning a fragment avoids
   the serialize→reparse round trip, which the threat-model page recommends as recipe 4, and
   `RETURN_DOM_FRAGMENT`'s behaviour "does not change" under Trusted Types
   (<https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model>,
   <https://github.com/cure53/DOMPurify>).
4. **Strip, explicitly, after sanitisation** (these are the ones a sanitiser will not or cannot
   handle for you):
   - `<style>` elements and every `style="…"` attribute —
     `FORBID_TAGS: ['style']`, `FORBID_ATTR: ['style']` at sanitise time. DOMPurify keeps CSS and
     does not sanitise it; `url()` in a CSS property is a data-exfiltration primitive
     (<https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model>).
   - `<foreignObject>` — DOMPurify lists it as disallowed by default; keep it that way
     (an HTML island inside SVG re-opens the HTML namespace surface).
   - `<use>` and every `xlink:href`/`href` that is not a same-document `#id` fragment —
     external/resource references. DOMPurify forbids `<use>` by default but *allows* `xlink:href`
     because it is a legitimate SVG attribute; the editor must restrict it further.
   - Any `href`/`src` on `<image>`, `<a>`, `<filter>`, `<pattern>` whose scheme is not `data:`
     (and `data:` only for `image/*`). Remote URLs are out of scope for DOMPurify ("HTTP leaks"
     non-goal) and are the tracking-pixel vector.
   - `<animate>`, `<animatetransform>`, `<animatemotion>`, `<set>` — animation elements can
     mutate attributes after sanitisation; `animate`, `set` and `discard` are in DOMPurify's
     `svgDisallowed` list.
   - `<script>` and every `on*` attribute (already stripped by DOMPurify's defaults; keep them
     stripped explicitly as a regression guard).
   - Processing instructions, XML doctype / internal entity declarations (billion-laughs and
     XXE surface — OWASP's File Upload Sheet names "XML bombs (otherwise known as billion laughs
     attack)" as a file-upload threat).
5. **Rewrite the root element before storing**: drop `width`, `height`, `x`, `y` from `<svg>`,
   keep `viewBox`, add `preserveAspectRatio="xMidYMid meet"`. The node's size then comes from the
   editor's style, not from the file (see §4). This is exactly what lets an intrinsic-sized SVG
   file be re-sized to the editor's grid without the file fighting it.
6. **Never write the sanitised string anywhere via `innerHTML` / `dangerouslySetInnerHTML`.**
   Render it as an image (`<img src="data:image/svg+xml;base64,…">` or a CSS `background-image`),
   which is the MDN-documented context where JavaScript is disabled. OWASP's XSS Prevention
   Cheat Sheet names React's `dangerouslySetInnerHTML` without sanitising, and React being unable
   to handle `javascript:`/`data:` URLs without specialised validation, as two of the framework
   gaps that require output encoding/sanitisation
   (<https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>).
7. **Cap the input size before parsing.** OWASP's File Upload Sheet: "Set a file size limit."
   DOMPurify's own regex warning also applies — "a catastrophically-backtracking ("ReDoS") pattern
   becomes an attacker-triggerable denial of service, because the attacker controls the string".
   Use a linear-time regex or none for size checks.
8. **Treat the stored shape as untrusted on read.** OWASP's HTML5 Cheat Sheet, on client-side
   storage: "A single Cross-Site Scripting vulnerability can read or write any data in IndexedDB;
   treat its contents as untrusted input on read. Apply the same input validation and output
   encoding rules to data coming from IndexedDB as you would to data coming from the network."
   (<https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html>)

**A CSP is a complement, not a substitute.** A `script-src` policy that disallows `unsafe-inline`
and `unsafe-eval` neutralises inline handlers even if they survive
(<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src>),
but the project is a Vite dev-server app on `http://localhost:5200` and CSP is not configured —
[UNVERIFIED] whether it is intended to be added. Recommend it but do not rely on it.

---

## 2. Shape data formats — how open tools define a reusable shape item

### 2.1 draw.io / diagrams.net custom shape library (`.xml`)

A library file **is not JSON at the top level** — it is XML wrapping a JSON array.

> "A custom library file is an XML file, which must have an enclosing `<mxlibrary>` node
> containing a JSON array and follow a specific format. The node has an optional `tags` attribute
> for searching library entries in the sidebar."
> — <https://www.drawio.com/docs/reference/format-custom-shape-library/>

*Required* per entry: `h` (height in pixels), `w` (width in pixels), and either an `<xml>`
property (an `mxGraphModel` description of a shape or diagram, compressed or escaped) **or** a
`data` property (an image data URI). For `data` entries: `"data"` must specify the format, e.g.
`"data:image/png,[…]"`; `"aspect": "fixed"` fixes the ratio when resizing; `"style"` adds extra
style attributes, e.g. `"resizable=0;rotatable=0;"` to prevent resizing and rotating.
*Optional*: `title` (hover text) and `tags` (space-separated, for sidebar search; "all tags from
the library are added to each entry"). Same page.

The repository README states the same contract and gives the resulting cell style for a `data`
entry (<https://github.com/jgraph/drawio-libs>):

> …an optional `"aspect": "fixed"` may be specified to add `aspect=fixed` to the style of the
> image cell, and an optional `style` attribute can be specified to be added the default style of
> the image cell. Eg. for `"data": "data:image/png,[…]", "aspect": "fixed", "style":
> "resizable=0;rotatable=0;"` the resulting cell style will be
> `shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=data:image/png,[…];resizable=0;rotatable=0;`

**Real example** — the first entry of `libs/templates.xml` in the official `jgraph/drawio-libs`
repo, fetched verbatim from
<https://raw.githubusercontent.com/jgraph/drawio-libs/review/libs/templates.xml> (compressed
`xml` payload truncated for readability; the file is `<mxlibrary>[…]</mxlibrary>`):

```json
[
  {
    "title": "Sequence Diagram",
    "xml": "7ZfRb9owEMb/mjxuCqQp8Ajt1pdNq7aHdY8muSVeTRw5Tgv763u2zxASEGj1mCrtAcm+i8/m952/KFFys1rfKVaXn2UOIko+YERJqd1otb4BIaJxzPMouY3G4xh/0fjjkezIZuOaKaiwwukFmDILnphowUWiZP5l+Qsy7TKN3gjKNCWrzbBdiU/8Jwhe4WxRg+Ir0KAwIyh8v4stMllphjGTH9m5EKxu+NKWjTGiIGtVw5/gKzT89zYq2yoHc0wzw71z+ewnWslH+M5zXVJR+hegNKyPkrAhwnAHEg+oNviIX5C6Fc9U1oRiBy8ugRclVUl8kDUuUGxL7TjjgFAfxp4Msfdp15JX2m6RLqL0tkdaKl3KQlZMdFmHZ2bPdZTZFTHbuOmEyOwhHBIczQIQvBoQzHlTM52VA5LmL/KMibngRYWhpdRariwTpvRcKQtJYimMQZX7yFLI7NE/9s115vRcrpAXtP0xquMY6xbg2+owaAWCabwae6UOcaOl96ZrdgK9813dU8hXaGSrMqBFPfjbU5ylB+3z1js6JUDEa0T2eaqlpwE6+vq/FfsFs0t68eStdK5tkHO92HfkKS++DkBwOiCoQLeqOt+JO64ra8DUImdNaekZPJju+C+suX4glGb8w4zfY8/8qTU7F9zrhoE1n9W/r3Trkbdn7z4peYIv4U4Vwq5nAV6fB16VCEhtttqYiRUniDIkQ1cZEuvyyvT9Ptx71F/SjjLIXiwZ8g2ijLtPQZU5cGfIjC6gTLLve9s39l+Qhg53aZ+zmdA+R9T+zW3qazahrV/tczjdfTu7x7uf1i8=",
    "w": 295,
    "h": 300,
    "aspect": "fixed"
  }
]
```

The corresponding image-shaped library (`libs/chart-icons.xml`) shows the `data` form:

```json
[{"data":"data:image/png;base64,…","w":320,"h":218,"aspect":"fixed"}, …]
```

(`[IMAGE]` placeholders substituted above; real values are PNG data URIs. Fetched from
<https://raw.githubusercontent.com/jgraph/drawio-libs/review/libs/chart-icons.xml>.)

**Draw.io's custom *shape* (stencil) definition** — the thing a custom library entry can carry in
its `xml` — is a different, richer XML (`<shape>` with `<connections>`, `<background>`,
`<foreground>`), documented at <https://www.drawio.com/doc/faq/custom-shapes>. Its sizing
contract is directly relevant to §4:

> * **`name`** - shape name.
> * **`h`** - height.
> * **`w`** - width.
> * **`aspect`** - if "variable", you can have any aspect ratio. if "fixed", `h` and `w` are fixed
>   to the ratio you defined in those attributes.
> * **`strokewidth`** - "inherit" sets *strokewidth* to the style you define in the UI. Set it to
>   a positive number and it will be fixed to that width.

Connection points are **relative** (`x=0` is 0, `x=1` is full width) —
`<connections><constraint x="0.5" y="0"/><constraint x="0.5" y="1"/><constraint x="0" y="0.5"/></connections>` —
which is what makes a stencil survive resizing at all.

`tags` on the `<mxlibrary>` node is confirmed in draw.io's own source: the sidebar parses the
library with `mxUtils.parseXml(data)` and, when `doc.documentElement.nodeName == 'mxlibrary'`,
reads `JSON.parse(mxUtils.getTextContent(doc.documentElement))` and passes
`doc.documentElement.getAttribute('tags')` as the default tags
(<https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/diagramly/sidebar/Sidebar.js>).
For `data` entries it then builds the cell style as
`'shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;'` plus
`'aspect=fixed;'` if `img.aspect == 'fixed'`, plus `'image=' + data`
(<https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/grapheditor/Sidebar.js>).

### 2.2 Excalidraw library (`.excalidrawlib`) — a plain JSON envelope

An `.excalidrawlib` is plain JSON. The envelope is defined in the source, not merely implied by
the docs:

```ts
// packages/excalidraw/data/types.ts
export interface ExportedLibraryData {
  type: string;
  version: typeof VERSIONS.excalidrawLibrary;
  source: string;
  libraryItems: LibraryItems;
}
export interface ImportedLibraryData extends Partial<ExportedLibraryData> {
  /** @deprecated v1 */
  library?: LibraryItems;
}
```
— <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/types.ts>

and the serializer that writes it:

```ts
export const serializeLibraryAsJSON = (libraryItems: LibraryItems) => {
  const data: ExportedLibraryData = {
    type: EXPORT_DATA_TYPES.excalidrawLibrary,   // "excalidrawlib"
    version: VERSIONS.excalidrawLibrary,          // 2
    source: getExportSource(),
    libraryItems,
  };
  return JSON.stringify(data, null, 2);
};
```
— <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/json.ts>

The item type (source, above link is types.ts; item shape is in `packages/excalidraw/types.ts`):

```ts
/** @deprecated legacy: do not use outside of migration paths */
export type LibraryItem_v1 = readonly NonDeleted<ExcalidrawElement>[];
/** v2 library item */
export type LibraryItem = {
  id: string;
  status: "published" | "unpublished";
  elements: readonly NonDeleted<ExcalidrawElement>[];
  /** timestamp in epoch (ms) */
  created: number;
  name?: string;
  error?: string;
};
export type LibraryItems = readonly LibraryItem[];
export type LibraryItems_anyVersion = LibraryItems | LibraryItems_v1;
```
— <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/types.ts>

**Real example, read off a live file.** Downloaded
`https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/datavizfairy/dashboard-charts.excalidrawlib`
(4,176,689 bytes ≈ 3.98 MiB) from the official `excalidraw/excalidraw-libraries` repository
(<https://github.com/excalidraw/excalidraw-libraries> — the curated registry Excalidraw's own UI
installs from, allow-listed in source as
`raw.githubusercontent.com/excalidraw/excalidraw-libraries` in
`packages/excalidraw/data/library.ts`). Measured structure of that real file:

```
top-level keys : libraryItems, source, type, version
type           : "excalidrawlib"
version        : 2
source         : "https://excalidraw.com"
libraryItems   : 53 items
item[0] keys   : created, elements, id, name, status
item[0]        : id "I1cwNE3R2nvIb7UpOUrWk", status "published",
                 created 1780229639522, name "KPI Bar", elements: 17
element[0]     : {id, type:"rectangle", x:60, y:60, width:300, height:210,
                  angle:0, strokeColor:"#E8E8F0", backgroundColor:"#ffffff",
                  version:21, versionNonce:1596778416, …}
item[0] bbox   : x 60→321.67, y 60→224   (i.e. the geometry is NOT rebased to 0,0)
```

So an item is **a group of real editor elements with real absolute coordinates**, not a
normalised glyph record. Two consequences worth copying or deliberately not copying:

- The item carries `id` + `status` + `created` + `name`. `status` is the publish workflow flag
  (`"published" | "unpublished"`), defaulted on import via `loadLibraryFromBlob(blob,
  defaultStatus = "unpublished")` — <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/blob.ts>.
  A local-only editor has no use for `status`; `name` + `created` + `id` are the useful parts.
- The absolute coordinates mean a re-inserted item can land off-screen unless the inserter
  re-bases it. Excalidraw's own answer is
  `distributeLibraryItemsOnSquareGrid()`, which re-lays items out with `const PADDING = 50` and
  `ITEMS_PER_ROW = Math.ceil(Math.sqrt(libraryItems.length))`, using
  `getCommonBoundingBox(item.elements)` for each item's extent
  (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/library.ts>).

**A cheaper design for Diagram Studio** — because our palette items already are
`{label, hint, shape, colorKey, kind, size?, make()}` and our nodes are a fixed-size box with a
glyph inside, a custom shape does **not** need to carry a whole element graph. It needs one
sanitised SVG and a nominal box. See §5 for the recommendation.

### 2.3 What NOT to copy from Excalidraw: images are excluded from libraries

Excalidraw's library refuses certain element types — the user-facing strings are exact
(<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/locales/en.json>):

```
errors.libraryElementTypeError.embeddable = Embeddable elements cannot be added to the library.
errors.libraryElementTypeError.iframe     = IFrame elements cannot be added to the library.
errors.libraryElementTypeError.image      = Support for adding images to the library coming soon!
```

and in source: `LIBRARY_DISABLED_TYPES = new Set(["iframe", "embeddable", "image"])`
(<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/common/src/constants.ts>).
That is the opposite of what Harvey wants (SVG *is* the point), so Excalidraw is a format
precedent here, not a feature precedent. **draw.io is the feature precedent** — it accepts
"PNG, JPG, SVG and GIF (including animated GIFs)" and its README points at a documented method
for making SVG colours configurable (<https://github.com/jgraph/drawio-libs>, and
<https://www.drawio.com/doc/faq/svg-edit-colours>, which uses an `editableCssRules` style key
holding a regex selecting which SVG CSS classes become recolourable).

---

## 3. Versioning and migration

### 3.1 What field carries the version

| Format | Version field | Values | Evidence |
|---|---|---|---|
| Excalidraw `.excalidrawlib` | `version` (top-level, beside `type`/`source`) | `2` current; validator accepts `1` or `2` | `VERSIONS = { excalidraw: 2, excalidrawLibrary: 2 }` — <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/common/src/constants.ts>; `isValidLibrary` requires `json.type === EXPORT_DATA_TYPES.excalidrawLibrary && (json.version === 1 \|\| json.version === 2)` — <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/json.ts> |
| Excalidraw scene `.excalidraw` | `version` (same position) | `2` | same constants file; documented as "The version of the Excalidraw schema / number" — <https://docs.excalidraw.com/docs/codebase/json-schema> |
| draw.io `.xml` library | **none on the file.** `<mxlibrary>` carries only an optional `tags` attribute | — | the format reference documents `<mxlibrary>`'s only attribute as `tags` — <https://www.drawio.com/docs/reference/format-custom-shape-library/> |
| draw.io diagram (`mxGraphModel`) | **none** | — | custom-shape docs describe `<shape>` attributes `name/h/w/aspect/strokewidth` only — <https://www.drawio.com/doc/faq/custom-shapes> |

draw.io's versioning is therefore **schema-by-attribute-name**: the file format has no version
number at all, and forward compatibility is achieved by the reader ignoring unknown keys and the
writer omitting optional ones. That is workable for draw.io (a library entry is just
`w`/`h`/`xml`-or-`data`), and it's the reason draw.io can't say "this library needs a newer
editor". **Diagram Studio should not copy this** — Harvey wants a format that will evolve.

### 3.2 How they actually migrate

**Excalidraw migrates in two independent dimensions**, and both are worth copying:

1. **Schema-shape migration inside the file.** `restoreLibraryItems()` accepts
   `LibraryItems_anyVersion` — i.e. both the v2 object items and the v1 "bare array of elements"
   items — and normalises forward:

   ```ts
   for (const item of libraryItems) {
     // migrate older libraries
     if (Array.isArray(item)) {                       // v1: readonly Element[]
       const restoredItem = restoreLibraryItem({ status: defaultStatus, elements: item,
                                                 id: randomId(), created: Date.now() });
       if (restoredItem) restoredItems.push(restoredItem);
     } else {
       const _item = item as MarkOptional<LibraryItem, "id" | "status" | "created">;
       const restoredItem = restoreLibraryItem({ ..._item, id: _item.id || randomId(),
                                                 status: _item.status || defaultStatus,
                                                 created: _item.created || Date.now() });
       if (restoredItem) restoredItems.push(restoredItem);
     }
   }
   ```

   — <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/restore.ts>.
   Note the pattern: **missing fields are filled with defaults, never trusted**; and an item whose
   `elements` restore to nothing is dropped (`const elements = getNonDeletedElements(restoreElements(...));
   return elements.length ? {...libraryItem, elements} : null;` — same file).
   The deprecated v1 container key is also read: `const libraryItems = data.libraryItems || data.library;`
   (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/blob.ts>),
   matching `/** @deprecated v1 */ library?: LibraryItems` in the type.

2. **Storage-location migration.** Excalidraw used to keep the library in `localStorage` under the
   key `excalidraw-library` and moved it to IndexedDB. The source names both, with the legacy one
   explicitly reserved for the migration:

   ```ts
   STORAGE_KEYS = {
     …
     IDB_LIBRARY: "excalidraw-library",
     // do not use apart from migrations
     __LEGACY_LOCAL_STORAGE_LIBRARY: "excalidraw-library",
   }
   ```
   — <https://raw.githubusercontent.com/excalidraw/excalidraw/master/excalidraw-app/app_constants.ts>

   and the adapter pair that performs it:

   ```ts
   export class LibraryIndexedDBAdapter {
     private static idb_name = STORAGE_KEYS.IDB_LIBRARY;
     private static key = "libraryData";
     private static store = createStore(`${idb_name}-db`, `${idb_name}-store`);
     static async load() { … return IDBData || null; }
     static save(data: LibraryPersistedData) { return set(key, data, store); }
   }
   /** LS Adapter used only for migrating LS library data to indexedDB */
   export class LibraryLocalStorageMigrationAdapter {
     static load() {
       const LSData = localStorage.getItem(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY);
       if (LSData != null) { const libraryItems = JSON.parse(LSData); if (libraryItems) return { libraryItems }; }
       return null;
     }
     static clear() { localStorage.removeItem(STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY); }
   }
   ```
   — <https://raw.githubusercontent.com/excalidraw/excalidraw/master/excalidraw-app/data/LocalData.ts>

   The migration is best-effort with a fallback: on failure it logs
   ``couldn't migrate legacy library data: ${error.message}`` and returns the data from the
   previous store; on success it calls `migrationAdapter.clear()`
   (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/library.ts>).
   It also uses a **persistence adapter interface** rather than reaching for a store directly —
   `LibraryPersistenceAdapter { load({source: "load"|"save"}), save(data) }` — with the comment
   "an object so that we can later add more properties to it without breaking, such as schema
   version" on `LibraryPersistedData` (same file). That is the interface Diagram Studio wants:
   the store is swappable, the format is not.

3. **Persistence-error handling.** Excalidraw surfaces a save failure to the user rather than
   silently dropping data: `t("errors.saveLibraryError")` renders as
   `Couldn't save library to storage. Please save your library to a file locally to make sure you
   don't lose changes.` and is only shown when an editor is loaded
   (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/locales/en.json>,
   <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/library.ts>).
   Copy that string's *intent*: the local library has no server copy, so a failed write must be
   visible and must offer an export escape hatch.

---

## 4. Layout-safety rules

"Must not break the layout" decomposes into four failure modes. Each has a documented precedent
in the tools studied, and each maps to a numeric clamp.

### 4.1 Measure the editor's own grid pitch first

From the project source (binding, since these are the numbers the clamp must agree with):

| Fact | Value | Where |
|---|---|---|
| Default snap pitch | `gridSize = 16` | `src/App.tsx:233` |
| Offered pitches | `GRID_SIZES = [8, 16, 20, 32, 64]` | `src/Settings.tsx:79` |
| Accepted range / quantisation | clamped to `[4, 64]`, rounded to nearest 4px step; non-finite ignored | `src/App.tsx:234–238` |
| React Flow wiring | `snapToGrid={snap}`, `snapGrid={[gridSize, gridSize]}`, `<Background gap={gridSize} />` | `src/App.tsx:2424–2425, 2492` |
| Node minimum width (CSS) | `.node { min-width: 190px }` | `src/styles.css:720` |
| Container defaults on insert | group `320×200`, note `200×90`, ERD table `250×170` | `src/App.tsx:1397–1401, 1380` |

Grid size clamps are the same pattern Excalidraw uses on its own pitch:
`getNormalizedGridSize = clamp(Math.round(gridStep), 1, 100)`
(<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/scene/normalize.ts>).
Excalidraw's default is `DEFAULT_GRID_SIZE = 20` with `DEFAULT_GRID_STEP = 5`
(<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/common/src/constants.ts>).

### 4.2 The four failure modes and the exact clamp

| # | Failure | What happens without a clamp | Documented precedent | **Clamp to apply** |
|---|---|---|---|---|
| 1 | **Zero / missing size** | A shape declaring `width:0 height:0` (or omitting them) renders as an invisible or hairline node: no click target, no connection handles, and `fitView` ignores it. The project's CSS saves it visually (`.node { min-width: 190px }`), but React Flow's measured box is still 0 — so hit-testing, handles and `fitView` all disagree with what is drawn. | Excalidraw defines this case explicitly: `INVISIBLY_SMALL_ELEMENT_SIZE = 0.1` and `isInvisiblySmallElement()` returns `element.width === 0 && element.height === 0` for non-linear elements; the public docs describe it as "Returns `true` if element is invisibly small (e.g. width & height are zero)" (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/element/src/sizeHelpers.ts>, <https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils>). draw.io makes `w`/`h` **required** on every library entry (<https://www.drawio.com/docs/reference/format-custom-shape-library/>). | `w = clamp(round(w), 32, 512)`, `h = clamp(round(h), 32, 512)`; **reject** a shape whose declared size is absent, 0, negative, or non-finite. 32 is the smallest size that still leaves a 190px CSS minimum legible and gives ~2 grid units at pitch 16. Never let a shape's own `width`/`height` *attributes* through — strip them (§1 rule 5). |
| 2 | **Enormous size** | One node at, say, `100000×100000` wrecks `fitView` (it zooms to nothing), blows up the MiniMap so every other node is a pixel, and can freeze rendering. This is a real, shipped bug class, not a hypothetical. | Excalidraw ships a hard last-resort fix with an explicit rationale: `const MAX_LINEAR_PX = 75_000;` — *"Last resort fix for extremely large linear elements (lines / arrows), which would otherwise freeze the editor while rendering — e.g. a dotted or dashed stroke spanning a huge distance generates an enormous dash array."* On breach it logs `Removing extremely large …` and marks the element `isDeleted: true` after resetting it to `100×100` (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/restore.ts>). React Flow's `<NodeResizer />` defaults `maxWidth`/`maxHeight` to `Number.MAX_VALUE`, i.e. **no practical cap is applied by default** — it must be set explicitly (<https://reactflow.dev/api-reference/components/node-resizer>). | Clamp to a max, **and** apply the same cap at drag-resize time so the two cannot disagree: `maxWidth = maxHeight = 512` (≈ 4× the largest default container, 32 grid units at pitch 16). Use React Flow's own props to enforce it in the UI: `<NodeResizer minWidth={32} minHeight={32} maxWidth={512} maxHeight={512} />`. |
| 3 | **Off-grid / fractional size** | A node sized to 137.4px sits between grid lines, so `snapToGrid` (pitch 16) can never place it cleanly next to neighbours; alignment guides and the dotted `Background` at `gap={gridSize}` read as "broken", and repeated drags accumulate drift. | React Flow exposes the resize clamp but **no snapping of the resize itself**; the editor must quantise. draw.io's stencil `w`/`h` are plain numbers and it offers no snapping contract either — the pitch discipline is entirely the host's job in both tools (<https://reactflow.dev/api-reference/components/node-resizer>, <https://www.drawio.com/doc/faq/custom-shapes>). | Quantise the **declared** custom-shape size to a multiple of the current pitch: `w = max(2, round(w / gridSize)) * gridSize`. Declare it at the pitch in force (16 by default), and clamp the *declaration* to `[2, 32]` grid units so it stays within the 32–512px band above at every offered pitch (8/16/20/32/64). |
| 4 | **Distorted / unbounded aspect** | A 24×24 icon SVG (or a wide logo) stretched into a square box distorts; or the file's own root `width`/`height` fight the node style and the glyph overflows its frame. | draw.io encodes the choice in the data: `<shape … aspect="variable">` permits any ratio, `aspect="fixed"` locks `h`/`w` to the ratio defined in those attributes; and for library image entries there is a per-entry `"aspect": "fixed"` which becomes `aspect=fixed;` in the cell style, alongside `imageAspect=0` (<https://www.drawio.com/doc/faq/custom-shapes>, <https://www.drawio.com/docs/reference/format-custom-shape-library/>). Excalidraw keeps the ratio for raster images by rewriting the file when it exceeds `maxWidthOrHeight: 1440` / `maxFileSizeBytes: 4 * 1024 * 1024`, and it explicitly refuses to resize SVG — `if (file.type === MIME_TYPES.svg) { return file; }` — and instead relies on the `viewBox` (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/common/src/constants.ts>, <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/blob.ts>). | Store `aspect: "fixed"` and the **viewBox-derived ratio** on every custom shape; derive the default box from it (`w = 64, h = round(64 * vbH / vbW)` quantised to the pitch) and render with `preserveAspectRatio="xMidYMid meet"`. Provide `aspect: "variable"` only if a future shape genuinely needs it — draw.io's own default for stencils is `variable` but its *library* image entries default to `aspect: "fixed"`. Also strip the root `width`/`height`, per §1 rule 5. |

### 4.3 Two smaller rules that belong in the same set

- **Stroke width must not scale with the box.** draw.io has an explicit attribute for it —
  `strokewidth`: `"inherit"` takes the UI style, a positive number fixes it, and the style type
  `strokewidth` has a `fixed` attribute "`0` being scaling with resize and `1` for a fixed stroke
  width regardless of scaling" (<https://www.drawio.com/doc/faq/custom-shapes>). An SVG that uses
  `vector-effect="non-scaling-stroke"` is the equivalent; otherwise a 1px hairline becomes a
  slab at 512px. `vector-effect` is in DOMPurify's SVG attribute allow-list, so it survives
  sanitisation (<https://raw.githubusercontent.com/cure53/DOMPurify/main/src/attrs.ts>).
- **Connection points must be relative, never absolute.** draw.io normalises them to the unit
  square — "Note the coordinates are relative. `x=0` is `0`, `x=1` is full width. Same for `y`."
  — precisely so a shape can be resized without its ports drifting
  (<https://www.drawio.com/doc/faq/custom-shapes>). A custom shape's port placement must be
  expressed the same way; storing absolute pixel ports re-introduces failure mode 1 for connectors.

---

## 5. Persistence on a local machine, no backend

The brief's question is *which store*, now that "a separate personal library" is settled. Three
candidates, each with real documented limits.

### 5.1 Option A — browser `localStorage`

**Documented quota.** MDN, on storage quotas: "Web Storage, which can be accessed by using the
`localStorage` and `sessionStorage` properties of the `window` object, is limited to **10 MiB of
data maximum on all browsers**. Browsers can store up to **5 MiB of local storage**, and 5 MiB of
session storage **per origin**. Once this limit is reached, browsers throw a `QuotaExceededError`
exception which should be handled by using a `try...catch` block."
— <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>

google's own guidance is blunter: "**LocalStorage** should be avoided because it is synchronous
and will block the main thread. It is limited to about 5MB and can contain only strings.
LocalStorage is not accessible from web workers or service workers."
— <https://web.dev/articles/storage-for-the-web>

**The spec adds that strings are UTF-16** ("The keys and the values stored with `localStorage` are
in the UTF-16 string format") — so a 5 MiB quota is roughly 2.5 M characters, not 5 M
(<https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage>). A base64 SVG data URI
is *already* 4/3 the size of the SVG, and UTF-16 doubles it again: an 800 KB SVG icon set
becomes ~4 MB of quota. That is the whole budget for one modest library.

**Concurrency.** The HTML spec warns explicitly: "This specification does not define the
interaction with other agent clusters in a multiprocess user agent, and authors are encouraged to
assume that there is **no locking mechanism**."
— <https://html.spec.whatwg.org/multipage/webstorage.html>

**Read/write visibility across tabs** does work: "For `localStorage`, the [`storage`] event is
fired in all other browsing contexts that are in the same origin as the initiating document. This
includes other tabs with the same origin."
— <https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event>

**Security.** OWASP's HTML5 Cheat Sheet: "A single Cross Site Scripting can be used to steal all
the data in these objects… A single Cross Site Scripting can be used to load malicious data into
these objects too, so don't consider objects in these to be trusted."
— <https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html>

**Migration risk.** High and silent. There is no schema, no transaction, no version field — a
half-written value is a parse error that a `try/catch` swallows (exactly what Excalidraw's own
legacy readers do: `catch (error: any) { console.error(error); }` in
<https://raw.githubusercontent.com/excalidraw/excalidraw/master/excalidraw-app/data/localStorage.ts>),
and "clear browsing data" erases it with no warning. draw.io documents the user-visible
consequence of exactly this for browser-saved libraries: "**Tip:** If you want to use your custom
library without loading it next time you create a diagram, you can save it in your browser.
However, **you will lose it if you clear your browser data**"
(<https://www.drawio.com/docs/manual/advanced/custom-shape-libraries/>).

### 5.2 Option B — IndexedDB

**Documented quota model.** MDN: "The data that's stored by using other web technologies, such as
IndexedDB, Cache API, or File System API… is managed by a storage management system that is
specific to each browser." The published per-origin ceilings:

| Browser | Best-effort | Persistent | Source |
|---|---|---|---|
| Firefox | min(10% of total disk size, **10 GiB** group limit per site) | up to **50% of total disk size, capped at 8 TiB**, not subject to the group limit | <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria> |
| Chrome / Chromium | **60% of the total disk size** (best-effort and persistent alike) | same | same page |
| Safari (desktop + mobile) | ≈ **1 GB**, then Safari prompts and raises the limit in 200 MB increments (author notes no official documentation) | — | <https://web.dev/articles/storage-for-the-web> |
| Chrome, incognito | ≈ **5% of total disk space** | — | <https://web.dev/articles/storage-for-the-web> |
| Chrome, "Clear cookies and site data when you close all windows" enabled | ≈ **300 MB** max | — | same |

**The critical property: it is evictable by default.** MDN: "Best-effort: this is the way that
data is stored by default. Best-effort data persists as long as the origin is below its quota,
the device has enough storage space, and the user doesn't choose to delete the data via their
browser's settings." Opting into persistence requires `navigator.storage.persist()`; "In Firefox,
when a site chooses to use persistent storage, the user is notified with a UI popup that their
permission is requested. Safari and most Chromium-based browsers… automatically approve or deny
the request based on the user's history of interaction with the site and do not show any prompts."
— <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>

And eviction is **all-or-nothing per origin**: "When an origin's data is evicted by the browser,
all of its data, not parts of it, is deleted at the same time. If the origin had stored data by
using IndexedDB and the Cache API for example, then both types of data are deleted."
— same page. Safari has an additional proactive rule: "If an origin has no user interaction, such
as click or tap, in the last seven days of browser use, its data created from script will be
deleted." — same page.

**Concurrency.** IndexedDB is transactional ("a transactional database system, like an SQL-based
Relational Database Management System"; "You need to specify the database schema, open a
connection to your database, and then retrieve and update data within a series of transactions")
— <https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API>.

**Migration risk.** Medium. Schema upgrades are explicit (`IDBVersionChangeEvent` /
`onupgradeneeded`, same page), so a version bump is a real, hookable migration rather than a
silent parse failure — better than localStorage. But the data sits under the same origin bucket,
so "clear browsing data" still deletes it, and because eviction is all-or-nothing, one quota
squeeze takes the board autosave *and* the custom-shape library together. It also needs a wrapper
to be tolerable — google's guidance: "For other data, use **IndexedDB** (with a
[promises wrapper](https://www.npmjs.com/package/idb))", and Excalidraw uses `idb-keyval` for
exactly this (<https://web.dev/articles/storage-for-the-web>).

**Positive evidence — Excalidraw chose this, after starting on localStorage.** The library is
stored in IndexedDB under database `excalidraw-library-db`, store `excalidraw-library-store`, key
`libraryData`, and the localStorage key of the same name is explicitly retained only as the
migration source (`// do not use apart from migrations`). Sources:
<https://raw.githubusercontent.com/excalidraw/excalidraw/master/excalidraw-app/data/LocalData.ts>,
<https://raw.githubusercontent.com/excalidraw/excalidraw/master/excalidraw-app/app_constants.ts>.

### 5.3 Option C — plain JSON file via the existing dev-server middleware

**This is not quota-limited by a browser at all.** The limits are the ones the middleware sets,
and they already exist in the project:

| Property | Value | Where |
|---|---|---|
| Request body cap (PUT/POST) | `MAX_BODY = 5 * 1024 * 1024` → HTTP **413** `body too large` beyond it | `vite.config.ts:8, 121–123, 149–151` |
| Path safety | `ID_RE = /^[A-Za-z0-9_-]+$/`, so `/` and `.` cannot appear → path traversal blocked | `vite.config.ts:9, 31` |
| Validation | `validateDoc()` requires `name` string-typed, `nodes`/`edges` arrays, each node with a string `id` and numeric `position.x/y` | `vite.config.ts:46–65` |
| Storage location | `boards/<id>.json` beside the app, auto-added to `.gitignore` | `vite.config.ts:7, 94–98` |
| Durability | **not** atomic: `fs.writeFileSync(file, JSON.stringify(out, null, 2))` | `vite.config.ts:170` |

**Migration risk: lowest, and the only option that survives the browser.** It is a real file on
disk, so it survives "clear browsing data", is backup-able, diffable, copy-able between machines,
and — crucially for Harvey's point 2 — can be exported/imported as a `.excalidrawlib`-style file
to share with other users. It also has no per-origin eviction policy, because no browser is
involved.

**But two things must be fixed before it carries a *shared* library:**

1. **Make the write atomic.** `fs.writeFileSync` truncates the target first, so a crash, a full
   disk or a killed process mid-write leaves a truncated JSON file, and a concurrent `GET` can
   read a half-written file. The fix is the standard temp-file + rename: `write-file-atomic`
   documents the exact sequence — "The file is initially named `filename + "." + murmurhex(...)`…
   If writeFile completes successfully… it renames the file back to the filename you specified.
   If it encounters errors at any of these steps it will attempt to unlink the temporary file and
   then pass the error back to the caller. **If multiple writes are concurrently issued to the
   same file, the write operations are put into a queue and serialized in the order they were
   called**", with `fsync` defaulting to `true`
   (<https://github.com/npm/write-file-atomic>). The guarantee comes from the OS: `rename(2)` —
   "If _newpath_ already exists, it will be **atomically replaced**, so that there is no point at
   which another process attempting to access _newpath_ will find it missing."
   (<https://man7.org/linux/man-pages/man2/rename.2.html>). Node's `fs.renameSync` is enough;
   the npm package adds the write queue and fsync if desired.
2. **Version the document and keep the previous copy.** Because it is a shared, mutating file,
   the risk is not eviction but *corruption or a bad import* silently destroying the whole
   library in one PUT. Recommend: write `library.json` atomically, and before each write rename
   the existing file to `library.json.bak` (one generation of history), and stamp the document
   with an explicit `version`.

### 5.4 Comparison table — the evidence in one place

| | localStorage | IndexedDB | JSON file via dev middleware |
|---|---|---|---|
| **Documented ceiling** | **5 MiB per origin** for local storage, 10 MiB total across local+session | Firefox min(10% disk, **10 GiB** group); Chromium **60% of total disk**; Safari ≈**1 GB** then prompts in 200 MB steps | body cap **5 MiB** per PUT (project's own `MAX_BODY`); disk-bound above that |
| **Encoding overhead** | UTF-16 strings → ~2.5 M chars of real budget; base64 SVG adds 4/3 first | structured clone, stores Blobs/ArrayBuffers natively | raw bytes |
| **Evictable?** | yes, silently; lost on "clear browsing data" | **yes by default (best-effort)**; all-or-nothing per origin; Safari 7-day no-interaction eviction | **no** — survives browser data clearing |
| **Cross-tab concurrency** | "no locking mechanism" (HTML spec) | transactional | rename(2) atomic replace; needs a write queue |
| **XSS exposure** | one XSS reads/writes everything (OWASP) | same (OWASP) | not readable by page script; but the file is plain JSON on disk and the endpoint is unauthenticated |
| **Schema migration** | none — silent parse failure | explicit `onupgradeneeded` | explicit `version` field; the file is inspectable |
| **Portability / sharing** | none | none | export/import file, copy between machines |
| **Evidence for the choice** | draw.io warns users lose browser-saved libraries on browser-data clear | **Excalidraw migrated library storage to IndexedDB** after starting in localStorage | the project already ships this exact mechanism for boards |
| **Sources** | [MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [HTML spec](https://html.spec.whatwg.org/multipage/webstorage.html), [web.dev](https://web.dev/articles/storage-for-the-web), [OWASP HTML5](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html), [draw.io](https://www.drawio.com/docs/manual/advanced/custom-shape-libraries/) | [MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [web.dev](https://web.dev/articles/storage-for-the-web), [Excalidraw LocalData.ts](https://raw.githubusercontent.com/excalidraw/excalidraw/master/excalidraw-app/data/LocalData.ts) | `vite.config.ts` (this repo), [write-file-atomic](https://github.com/npm/write-file-atomic), [rename(2)](https://man7.org/linux/man-pages/man2/rename.2.html) |

---

## 6. Recommendation

### 6.1 Persistence — a plain JSON file via the dev-server middleware, mirroring `/api/boards`

**Choose Option C.** Rationale, tied to the evidence above:

- The library is **shared across all boards**, so it is a single mutable document that is written
  by whichever board is open. IndexedDB's eviction is **all-or-nothing per origin** — one quota
  squeeze takes the board autosave and the shared library together, with no partial loss
  (<https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>).
  A file has no such coupling.
- The library contains **base64 SVG data URIs**, the largest objects in the app. localStorage's
  5 MiB origin budget combined with UTF-16 storage and base64's 4/3 expansion is a realistic
  ceiling for a modest icon set; a single real `.excalidrawlib` from the official registry already
  weighs **3.98 MiB** on its own (measured, §2.2). localStorage is out on quota grounds.
- The project **already has this mechanism for boards**: `GET`/`POST`/`PUT`/`DELETE /api/boards`
  with a 5 MiB body cap, an id regex that blocks traversal, and a document validator
  (`vite.config.ts`). A `/api/library` route (singleton document, no id) is a smaller change than
  introducing idb-keyval plus a second store, and it keeps one persistence story.
- It is the only option whose data **survives "clear browsing data"** — which is precisely the
  loss draw.io warns its users about for browser-saved libraries
  (<https://www.drawio.com/docs/manual/advanced/custom-shape-libraries/>).
- It is the only option that is **portable**: the same JSON can be exported and imported by
  another user, which is Harvey's stated reason for the palette being shareable.

**What makes the shared library safe to write — three concrete requirements:**

1. **Atomic write.** Replace `fs.writeFileSync(target, …)` with temp-file + `fs.renameSync`, in a
   per-file serialised queue. Documented basis: `rename(2)` atomically replaces the target and
   there is "no point at which another process attempting to access _newpath_ will find it
   missing" (<https://man7.org/linux/man-pages/man2/rename.2.html>), and `write-file-atomic`
   adds the fsync and the per-file write queue
   (<https://github.com/npm/write-file-atomic>). **The project's current board writer does not do
   this and should be fixed at the same time** — a truncated `boards/<id>.json` is an existing
   failure mode.
2. **One generation of history.** Rename the previous file to `library.json.bak` before replacing
   it. Because the endpoint is unauthenticated and there is no merge, a bad client write can
   destroy the whole library in one request; a `.bak` makes it recoverable.
3. **An explicit `version` field, a validator, and a migration step on read** (§6.3). The
   `boards` middleware already demonstrates the pattern: it *reads* legacy keys it no longer
   writes and never writes back a stale key — see the `PACKAGE-M fix` comment on `theme` in
   `vite.config.ts:163–168` and `src/boards.ts:23–28`. Custom shapes should follow that: read vN,
   upgrade to vN+1 in memory, write only the current version. And follow Excalidraw's
   persistence-adapter shape — `{ load(), save() }` behind an interface
   (`LibraryPersistenceAdapter`, <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/library.ts>) —
   so the store can later move to IndexedDB **without changing the format**. Excalidraw's own
   comment is the argument for it: `LibraryPersistedData` is "an object so that we can later add
   more properties to it without breaking, such as schema version" (same file).
4. **Surface write failures to the user.** Excalidraw's string is the model:
   `Couldn't save library to storage. Please save your library to a file locally to make sure you
   don't lose changes.` (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/locales/en.json>).
   A silent failure on a library with no server copy is unacceptable.

If a no-dev-server build ever matters, **IndexedDB is the documented fallback** — it is what
Excalidraw uses, it is transactional, and its quota is disk-sized rather than 5 MiB. localStorage
is the option to rule out explicitly.

### 6.2 Custom shape data format — a versioned JSON envelope with an embedded sanitised SVG

Follow Excalidraw's envelope (plain JSON, `type` + `version` + `source`) but replace
`libraryItems: [{elements:[…editor elements…]}]` with the draw.io-style **image entry**
(`{data, w, h, aspect, title, tags}`) — because our shapes are a *glyph in a box*, not a graph of
editor elements, and because our board format (`Node[]` + `Edge[]`) has no place for a foreign
element graph. The four required fields, and the reason each exists:

| Field | Source of the convention | Why required |
|---|---|---|
| `title` / `name` | draw.io `title` — "displayed when hovering over the shape in the custom library" | palette label + tooltip |
| `tags` | draw.io `tags` — "space-separated list of tags for searching in the sidebar (all tags from the library are added to each entry)" | palette search, and it is how draw.io feeds the sidebar index |
| `data` (as `svg`) | draw.io `data` — "must specify the format of the data in this property, e.g. `"data:image/png,[…]"`"; README: "a `data` property with an image data URI (in PNG, JPG or SVG)" | the artwork |
| `w` / `h` | draw.io: "All entries must have a `w` and `h` property for the width and height of the cell(s) or image in the entry" | layout safety (§4) — required, never optional |
| `aspect` | draw.io `"aspect": "fixed"` → `aspect=fixed;` in the cell style | prevents distortion (§4.2 mode 4) |

Concrete example — the recommended on-disk document (`library.json`):

```json
{
  "type": "diagram-studio-library",
  "version": 1,
  "source": "diagram-studio",
  "updatedAt": 1789000000000,
  "shapes": [
    {
      "id": "sh_k3f9a2c1",
      "name": "Message broker",
      "tags": "queue kafka bus messaging async",
      "w": 192,
      "h": 128,
      "aspect": "fixed",
      "viewBox": "0 0 48 32",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 32\" preserveAspectRatio=\"xMidYMid meet\"><rect x=\"1\" y=\"1\" width=\"46\" height=\"30\" rx=\"4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" vector-effect=\"non-scaling-stroke\"/><path d=\"M12 10h24M12 16h24M12 22h16\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" vector-effect=\"non-scaling-stroke\"/></svg>",
      "colorKey": "amber",
      "sanitizer": "dompurify/svg-profile",
      "sanitizedAt": 1789000000000,
      "created": 1788990000000
    }
  ]
}
```

Design notes, each tied to a precedent:

- `type` + `version` at the top, exactly as `ExportedLibraryData`
  (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/types.ts>).
  `version` is a **number**, not a string, matching Excalidraw's `version: 2`.
- `"source": "diagram-studio"`, mirroring Excalidraw's `source: getExportSource()` which the
  utils doc says is overridable via `window.EXCALIDRAW_EXPORT_SOURCE`
  (<https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils>) — useful when a user
  re-imports a file and you want to know where it came from.
- **`svg` holds the sanitised markup inline, not a base64 data URI.** Base64 adds 4/3 to every
  byte and makes the stored file unreadable and undiffable; raw markup is also what makes the
  file inspectable/repairable after a bad import, and it works directly as a
  `data:image/svg+xml,`+`encodeURIComponent(svg)` image source. (If a future size problem appears,
  the file store's 5 MiB `MAX_BODY` is the backstop and can be raised, unlike localStorage's.)
- **`viewBox` is a first-class field**, kept out of the markup for the layout-safety checks to
  read without parsing, and used to compute the default box.
- **`colorKey`, not hex** — matches the project's existing invariant: "Boards store colour keys,
  never hex, so a theme recolours an existing board" (`PALETTE-BRIEF.md`), and matches draw.io's
  recolorable-SVG approach via `editableCssRules`
  (<https://www.drawio.com/doc/faq/svg-edit-colours>). Note `currentColor` in the example: the
  resolved `--c-*` token can be injected as the CSS `color` of the wrapper, so the SVG paints
  with the theme's key without the SVG knowing the theme.
- **`sanitizer` + `sanitizedAt`** are provenance, so a future re-sanitisation pass can find shapes
  processed by an older DOMPurify (the library documents recurring advisories, e.g.
  CVE-2026-41238 and GHSA-cj63-jhhr-wcxv, both prototype-pollution default-config issues fixed in
  3.4.0 — <https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model>).
- **`w`/`h` are stored already quantised and clamped** (§4.2), never raw file dimensions.
- **No `status` field.** Excalidraw's `"published" | "unpublished"` exists for its public
  registry; a local-only library has no publication concept.

### 6.3 Layout-safety and sanitisation, as the two implementation rule sets

**Sanitisation — do all eight of §1.4.** The three that carry the most weight:

1. Render every custom shape as an **image** (`<img src="data:image/svg+xml,…">` or CSS
   `background-image`), never inline into the DOM and never via `<iframe>/<object>/<embed>` — MDN
   documents that JavaScript is disabled and external resources cannot load in the image context,
   and that those restrictions do *not* apply to the embedded-document context
   (<https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_Image>).
2. Sanitise with **`USE_PROFILES: { svg: true }`** and additionally
   `FORBID_TAGS: ['style']` + `FORBID_ATTR: ['style']`, then strip remote `href`/`xlink:href`
   references and `<foreignObject>` yourself. DOMPurify's `svgDisallowed` list already forbids
   `script, foreignobject, use, animate, set, discard, …`
   (<https://raw.githubusercontent.com/cure53/DOMPurify/main/src/tags.ts>) and its threat-model
   page warns that `style`/`style` are kept and **not sanitised**, that `on*` must never be
   allow-listed, and that "HTTP leaks" are out of scope
   (<https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model>).
3. **Do not post-process the sanitised string** — "sanitize the markup, and then… you might easily
   void the effects of sanitization"; and never let the sanitised SVG flow into a different
   markup context (<https://github.com/cure53/DOMPurify>, threat-model non-goals).

**Layout safety — clamp on import *and* on resize, from the same constant set:**

```ts
const SHAPE_MIN_PX = 32;      // smallest legible box; ≈2 grid units at pitch 16
const SHAPE_MAX_PX = 512;     // ≈4× the largest default container (group 320×200)
const SHAPE_MIN_UNITS = 2;    // grid units, so it stays ≥32 at pitch 8
const SHAPE_MAX_UNITS = 32;   // grid units, so it stays ≤512 at pitch 64
```

- **Reject** a shape with a missing, zero, negative or non-finite declared size — this is the case
  Excalidraw names: `isInvisiblySmallElement` is `width === 0 && height === 0` for non-linear
  elements, with `INVISIBLY_SMALL_ELEMENT_SIZE = 0.1`
  (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/element/src/sizeHelpers.ts>),
  and draw.io makes `w`/`h` **required** on every entry
  (<https://www.drawio.com/docs/reference/format-custom-shape-library/>).
- **Clamp** to `[SHAPE_MIN_PX, SHAPE_MAX_PX]` and **quantise to the current pitch**:
  `w = clamp(Math.round(w / gridSize), SHAPE_MIN_UNITS, SHAPE_MAX_UNITS) * gridSize`. Prevent the
  "enormous shape" freeze that Excalidraw guards with `MAX_LINEAR_PX = 75_000` and a hard
  `isDeleted: true` fallback
  (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/restore.ts>).
- **Enforce it in the resize UI too**, because React Flow defaults `maxWidth`/`maxHeight` to
  `Number.MAX_VALUE` — i.e. unbounded unless set: `<NodeResizer minWidth={32} minHeight={32}
  maxWidth={512} maxHeight={512} />` (<https://reactflow.dev/api-reference/components/node-resizer>).
  Quantising only the stored value while the drag is free would let the two disagree, which is
  exactly the drift failure mode 3 describes.
- **Fix the aspect** (`aspect: "fixed"`) from the viewBox ratio, and derive the default box from
  it, mirroring draw.io's `aspect="fixed"`/`aspect="variable"` stencil attribute and its per-entry
  `"aspect": "fixed"` (<https://www.drawio.com/doc/faq/custom-shapes>,
  <https://www.drawio.com/docs/reference/format-custom-shape-library/>).
- **Strip the SVG's root `width`/`height` on import** and render with
  `preserveAspectRatio="xMidYMid meet"`, so the file cannot assert a size that fights the node —
  Excalidraw refuses to resize SVG files at all and relies on the `viewBox` instead:
  `if (file.type === MIME_TYPES.svg) { return file; }`
  (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/blob.ts>).
- **Keep strokes non-scaling** with `vector-effect="non-scaling-stroke"`, the SVG analogue of
  draw.io's `strokewidth` style with `fixed=1` ("a fixed stroke width regardless of scaling") —
  <https://www.drawio.com/doc/faq/custom-shapes>. `vector-effect` is in DOMPurify's SVG attribute
  allow-list, so it survives the rules above
  (<https://raw.githubusercontent.com/cure53/DOMPurify/main/src/attrs.ts>).
- **Express any custom shape's port/connection points in the unit square** (`x`/`y` ∈ [0,1]),
  following draw.io: "Note the coordinates are relative. `x=0` is `0`, `x=1` is full width."
  — <https://www.drawio.com/doc/faq/custom-shapes>.

### 6.4 Explicitly out of scope / not recommended

- **No `.excalidrawlib` byte-compatibility.** The envelope is worth copying; the payload is not,
  because an Excalidraw item is a graph of editor elements with absolute coordinates
  (measured: `x 60→321.67`, §2.2) while a Diagram Studio node is a styled box with a glyph.
  Supporting both would force a foreign element model into `Node[]`/`Edge[]`.
- **No draw.io `.xml` `mxlibrary` wrapper.** It is XML wrapping JSON to support the
  `mxGraphModel` `xml` property — a compression/escaping burden the docs themselves flag
  ("Uncompressed XML properties must be escaped… `<` must be written as `&lt;`… All `"` characters
  must be preceded by a backslash"). Plain JSON has none of that.
  <https://www.drawio.com/docs/reference/format-custom-shape-library/>
- **No version field omitted "like draw.io".** draw.io's library format carries no version
  (only an optional `tags` attribute on `<mxlibrary>`, same page). Copying that would forfeit the
  migration hook, and Excalidraw's `version === 1 || version === 2` validator plus its two-axis
  migration is the better precedent
  (<https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/json.ts>).

---

## Sources

Every URL used, grouped by the question it supports.

**SVG safety / sanitisation**
- <https://github.com/cure53/DOMPurify> — README: HTML+SVG+MathML by default, `USE_PROFILES` overrides `ALLOWED_TAGS`, foot-gun on post-processing, fragment option, Trusted Types.
- <https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model> — non-goals (markup context flipping, CSS-based attacks, HTTP leaks); dangerous tags/attributes tables (`on*`, `style`, `href`/`src`/`xlink:href`, `srcdoc`, `id`/`name`); config flags that widen the surface; safe recipes 1–4.
- <https://raw.githubusercontent.com/cure53/DOMPurify/main/src/tags.ts> — `svg`, `svgFilters`, `svgDisallowed` allow/block lists.
- <https://raw.githubusercontent.com/cure53/DOMPurify/main/src/attrs.ts> — SVG/HTML/xml attribute allow-lists.
- <https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html> — `<svg/onload=alert('XSS')>`, `<g onload="javascript:alert(1)">`, polyglot payload.
- <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html> — upload threats (XSS/CSRF via client-side active content, XML bombs), image rewriting, size limit, validate not just content-type.
- <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html> — `dangerouslySetInnerHTML` and `javascript:`/`data:` URL gaps in React; output-encoding contexts.
- <https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html> — localStorage "not to be trusted"/XSS steals it; IndexedDB "treat its contents as untrusted input on read".
- <https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html> — DOM-context XSS via `innerHTML`.
- <https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/script> — SVG `<script>` executes; `href` instead of `src`.
- <https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_Image> — image context: JavaScript disabled, no external resources, and that this does *not* apply to `<iframe>/<object>/<embed>`.
- <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src> — CSP script-src covers inline handlers.

**Shape data formats**
- <https://www.drawio.com/docs/reference/format-custom-shape-library/> — `<mxlibrary>` + `<tags>`; required `h`, `w`, `<xml>`|`data`; `aspect`, `style`, `title`, `tags`; escaping rules; compressed vs uncompressed.
- <https://github.com/jgraph/drawio-libs> — library file format statement, the resulting image cell style, supported image formats including SVG, `clibs` sharing mechanism.
- <https://raw.githubusercontent.com/jgraph/drawio-libs/review/libs/templates.xml> — real `<mxlibrary>` file (example quoted).
- <https://raw.githubusercontent.com/jgraph/drawio-libs/review/libs/chart-icons.xml> — real `data`-property library (example quoted).
- <https://www.drawio.com/doc/faq/custom-shapes> — `<shape>` attributes `name/h/w/aspect/strokewidth`; `<connections>` relative coordinates; style types incl. `strokewidth` `fixed`.
- <https://www.drawio.com/doc/faq/svg-edit-colours> — `editableCssRules` regex for making an SVG's colours configurable.
- <https://www.drawio.com/docs/manual/advanced/custom-shape-libraries/> — `.xml` libraries, "you will lose it if you clear your browser data", left panel placement, export flow.
- <https://www.drawio.com/docs/manual/editor/panels/scratchpad/> — the scratchpad is "your personal shape library"; export it as a custom shape library.
- <https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/diagramly/sidebar/Sidebar.js> — `mxlibrary` parsing and `getAttribute('tags')` in source.
- <https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/grapheditor/Sidebar.js> — `addEntries`/`addDataEntry`: `aspect=fixed;` injection, tags + title composition.
- <https://docs.excalidraw.com/docs/codebase/json-schema> — Excalidraw file attributes `type`/`version`/`source`/`elements`/`appState`/`files`.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/types.ts> — `ExportedLibraryData`, `ImportedLibraryData` with deprecated v1 `library`.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/types.ts> — `LibraryItem_v1`, `LibraryItem` (v2), `LibraryItems_anyVersion`.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/json.ts> — `serializeLibraryAsJSON`, `isValidLibrary` (v1|v2), `isValidExcalidrawData`.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/blob.ts> — `loadLibraryFromBlob`, `parseLibraryJSON` (`data.libraryItems || data.library`), SVG never resized.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/common/src/constants.ts> — `VERSIONS`, `MIME_TYPES`, `LIBRARY_DISABLED_TYPES`, `DEFAULT_GRID_SIZE`, `DEFAULT_GRID_STEP`, `DEFAULT_IMAGE_OPTIONS`.
- <https://github.com/excalidraw/excalidraw-libraries> — the public registry; measured real `.excalidrawlib` example downloaded from here.
- <https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/datavizfairy/dashboard-charts.excalidrawlib> — the 3.98 MiB real file whose structure is reported.
- <https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils> — `serializeLibraryAsJSON`, `loadLibraryFromBlob(defaultStatus)`, `isInvisiblySmallElement`.

**Versioning / migration**
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/restore.ts> — `restoreLibraryItems` v1→v2, per-item defaulting, `MAX_LINEAR_PX = 75_000` oversized-element fix.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/excalidraw-app/app_constants.ts> — `STORAGE_KEYS.IDB_LIBRARY` and `__LEGACY_LOCAL_STORAGE_LIBRARY` with "do not use apart from migrations".
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/excalidraw-app/data/LocalData.ts> — `LibraryIndexedDBAdapter`, `LibraryLocalStorageMigrationAdapter`, quota-exceeded handling.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/data/library.ts> — `LibraryPersistenceAdapter`/`LibraryMigrationAdapter`, `LibraryPersistedData` schema-version comment, migration try/catch, `errors.saveLibraryError` surfacing.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/locales/en.json> — exact user-facing strings, incl. the library error strings.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/excalidraw-app/data/localStorage.ts> — legacy reader swallowing parse errors.

**Layout safety**
- <https://reactflow.dev/api-reference/components/node-resizer> — `minWidth`/`minHeight` default `10`, `maxWidth`/`maxHeight` default `Number.MAX_VALUE`.
- <https://reactflow.dev/api-reference/types/node> — `width`/`height` are read-only/measured; use `style`/`className` to size.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/scene/normalize.ts> — `getNormalizedGridSize`/`getNormalizedGridStep` = `clamp(Math.round(x), 1, 100)`.
- <https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/element/src/sizeHelpers.ts> — `INVISIBLY_SMALL_ELEMENT_SIZE = 0.1`, `isInvisiblySmallElement`.
- Project source (measured, this repo): `src/App.tsx:233–238, 1377–1401, 2424–2425, 2492`; `src/Settings.tsx:79`; `src/styles.css:720`; `vite.config.ts:8–9, 31, 46–65, 94–98, 170`.

**Persistence**
- <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria> — 5 MiB localStorage / 10 MiB Web Storage; best-effort vs persistent; Firefox/Chromium quotas; all-or-nothing eviction; Safari 7-day proactive eviction; private-browsing note.
- <https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage> — UTF-16 string format; `SecurityError` conditions; `file:` undefined.
- <https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event> — storage event fires in other same-origin tabs.
- <https://html.spec.whatwg.org/multipage/webstorage.html> — "no locking mechanism"; `QuotaExceededError` on `setItem`; security sections.
- <https://web.dev/articles/storage-for-the-web> — localStorage "should be avoided" (synchronous, ~5 MB, strings only); IndexedDB recommended; Chrome 60% of disk / Firefox 2 GB eTLD+1 / Safari ~1 GB in 200 MB increments / incognito ~5% / "clear on close" ~300 MB.
- <https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API> — transactional store; same-origin; `onupgradeneeded`/`IDBVersionChangeEvent`; pointers to the quota page.
- <https://www.npmjs.com/package/idb-keyval> — the wrapper Excalidraw uses.
- <https://github.com/npm/write-file-atomic> — temp-file + rename + fsync + per-file serialised write queue.
- <https://man7.org/linux/man-pages/man2/rename.2.html> — "If _newpath_ already exists, it will be atomically replaced".

**Unverified / flagged**
- `[UNVERIFIED]` Whether a CSP is planned for Diagram Studio — no CSP configuration was found in the project; the recommendation to add one is not backed by a project decision.
- `[UNVERIFIED]` Safari's ≈1 GB storage limit — google's own article says so explicitly ("I was unable to find any official documentation on this").
- `[UNVERIFIED]` The assertion that `<mxlibrary>` has *no* version attribute is inferred from the format reference documenting only an optional `tags` attribute; no explicit statement of absence was found.
- `[UNVERIFIED]` Firefox's older "2 GB per eTLD+1" figure appears on the web.dev page while MDN's current page states min(10% disk, 10 GiB group) — the two disagree; both are cited in place rather than reconciled.
