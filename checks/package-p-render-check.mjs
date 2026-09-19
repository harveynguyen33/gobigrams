// PACKAGE-P PASS 1 — render verification (not a gate; evidence only).
// esbuild-bundles the real tsx and SSRs it, so the assertions are made against
// emitted DOM, not against source text.
import * as esbuild from 'esbuild';
import {writeFileSync, mkdirSync, rmSync} from 'node:fs';

const ROOT = '/home/harvey/projects/tech-goblin/lab/diagram-studio';
const ENTRY = `${ROOT}/.p-render-entry.tsx`;
const OUT = `${ROOT}/.p-render-out.mjs`;

writeFileSync(ENTRY, `
import {renderToStaticMarkup} from 'react-dom/server';
import {
  IconPickerRow, ShapesPicker, Stepper, ToggleRow, Section,
  ArtArrow, ArtCardinality, ArtCurve, ArtDash, ArtWidth,
} from './src/InspectorPickers';
import {getInspectorSections} from './src/inspector';
import {textStyleVars, readTextStyle, mergeTextStyle, TEXT_SCALE} from './src/textStyle';

const W: any[] = [1, 1.5, 1.8, 2, 3].map(w => ({v: String(w), label: String(w), art: <ArtWidth w={w} />}));
const D: any[] = ['solid','dashed','dotted'].map((d:any) => ({v: d, label: d, art: <ArtDash kind={d} />}));
const C: any[] = ['bezier','smoothstep','step','straight'].map((c:any) => ({v: c, label: c, art: <ArtCurve kind={c} />}));
const M: any[] = [
  {v:'none', label:'none', art: <ArtArrow kind="none" />},
  {v:'arrowclosed', label:'closed arrow', art: <ArtArrow kind="closed" />},
  {v:'arrow', label:'open arrow', art: <ArtArrow kind="open" />},
];
const CF: any[] = ['none','one','zeroOrOne','many','zeroOrMany','arrowclosed'].map(v => ({v, label:v, art:<ArtCardinality kind={v} />}));
const SP: any[] = [{v:'4',label:'slow',art:null},{v:'2.4',label:'normal',art:null},{v:'1.4',label:'fast',art:null},{v:'0.8',label:'very fast',art:null}];
const BD: any[] = [{v:'card',label:'card',art:null},{v:'label-only',label:'label only',art:null}];
/* PACKAGE-P PASS 2 §E.1 — the three Text-section controls, exactly as App.tsx
   wraps them: PickerOption rows with NO art, so the label IS the control. */
const SZ: any[] = [{v:'sm',label:'S',art:null},{v:'md',label:'M',art:null},{v:'lg',label:'L',art:null},{v:'xl',label:'XL',art:null}];
const WT: any[] = [{v:'regular',label:'Regular',art:null},{v:'bold',label:'Bold',art:null}];
const AL: any[] = [{v:'left',label:'Left',art:null},{v:'center',label:'Center',art:null},{v:'right',label:'Right',art:null}];
const SW: any[] = ['accent','green','cyan','violet','amber','slate'];

const TITLES: any = {content:'Content',text:'Text',style:'Style',table:'Table',columns:'Columns',showMode:'Show mode',label:'Label',line:'Line',markers:'Markers',cardinality:"Cardinality",flow:'Flow animation'};

export function renderTarget(t: any, bodies: any) {
  return getInspectorSections(t).map((s: any) => (
    <Section key={s.id} id={s.id} title={TITLES[s.id]} collapsedDefault={s.collapsedDefault}>{bodies[s.id]}</Section>
  ));
}

/* The Text section body, built the way App.tsx builds \`tsBody\` — from the same
   model functions, so the markup below is the panel's real output and not a
   transcription of it. */
function tsBody(t: any) {
  const alignDefault = t.kind === 'goblin' && t.body === 'label-only' ? 'center' : 'left';
  const shown = readTextStyle(t.__stored, alignDefault);
  const write = (p: any) => { t.__written = mergeTextStyle(t.__stored, p, alignDefault); };
  return <>
    <div className="field"><label>size</label>
      <ToggleRow value={shown.size} onChange={v => write({size: v})} options={SZ} title="Text size" /></div>
    <div className="field"><label>weight</label>
      <ToggleRow value={shown.weight} onChange={v => write({weight: v})} options={WT} title="Text weight" /></div>
    <div className="field"><label>text colour</label>
      <div className="swatches">{SW.map(k => <div key={k} className={'swatch' + (shown.colorKey === k ? ' on' : '')} data-color-key={k} onClick={() => write({colorKey: k})} />)}</div></div>
    <div className="field"><label>align</label>
      <ToggleRow value={shown.align} onChange={v => write({align: v})} options={AL} title="Text align" /></div>
  </>;
}

export function All() {
  const edgeBodies = {
    label: <ToggleRow value="center" onChange={()=>{}} options={[{v:'center',label:'center',art:null}]} title="Label position" />,
    line: <>
      <IconPickerRow id="i-w" value="1.8" onChange={()=>{}} options={W} title="Stroke width" />
      <IconPickerRow id="i-d" value="dashed" onChange={()=>{}} options={D} title="Line style" />
      <IconPickerRow id="i-c" value="bezier" onChange={()=>{}} options={C} title="Curvature" />
    </>,
    markers: <IconPickerRow id="i-m" value="arrowclosed" onChange={()=>{}} options={M} title="Arrow head" />,
    cardinality: <IconPickerRow id="i-cf" value="many" onChange={()=>{}} options={CF} title="Cardinality: source end" />,
    flow: <>
      <Stepper value={3} onChange={()=>{}} min={1} max={6} title="Flow count" />
      <ToggleRow value="2.4" onChange={()=>{}} options={SP} title="Flow speed" />
    </>,
  };
  const g: any = {kind:'goblin', shape:'service', body:'card'};
  const l: any = {kind:'label'};
  const lo: any = {kind:'goblin', shape:'service', body:'label-only'};
  g.__stored = {size:'xl', weight:'bold', colorKey:'amber', align:'right'};
  return <div>
    <div id="edge">{renderTarget({kind:'edge', presetId:'erd'}, edgeBodies)}</div>
    <div id="edge-nonerd">{renderTarget({kind:'edge'}, edgeBodies)}</div>
    <div id="goblin">{renderTarget(g, {content: <input />, text: tsBody(g), style: <>
      <ShapesPicker value="database" onChange={()=>{}} color="var(--nc, orange)" />
      <ToggleRow value="card" onChange={()=>{}} options={BD} title="Body" />
    </>})}</div>
    <div id="goblin-default">{renderTarget({kind:'goblin', shape:'service', body:'card'}, {text: tsBody({kind:'goblin', shape:'service', body:'card'})})}</div>
    <div id="goblin-lo">{renderTarget(lo, {text: tsBody(lo)})}</div>
    <div id="label">{renderTarget(l, {text: tsBody(l)})}</div>
  </div>;
}

/* §E.2 — the MODEL, executed. These are the claims a source-reading harness
   cannot make: what a chosen value STORES, what a default stores, and what an
   old board (no textStyle) renders with. */
export function Model() {
  return <pre>
{JSON.stringify({
  /* nothing chosen yet → nothing stored, and nothing rendered */
  oldBoardVars: textStyleVars(undefined, 'left'),
  /* every field at its inherited value → NOTHING is written */
  onlyDefaults: mergeTextStyle(undefined, {size:'md', weight:'regular', align:'left'}, 'left'),
  /* a real choice → only that key */
  oneChoice: mergeTextStyle(undefined, {size:'xl'}, 'left'),
  /* a default chosen LATER clears it back out */
  cleared: mergeTextStyle({size:'xl', weight:'bold'}, {size:'md', weight:'regular'}, 'left'),
  /* the label-only default: center is the inherited value THERE */
  loDefaultCenter: mergeTextStyle(undefined, {align:'center'}, 'center'),
  loExplicitCenterIsAChoice: mergeTextStyle(undefined, {align:'center'}, 'left'),
  /* the render vars a full style produces */
  fullVars: textStyleVars({size:'xl', weight:'bold', colorKey:'amber', align:'right'}, 'left'),
  scale: TEXT_SCALE,
}, null, 0)}
  </pre>;
}
`);

await esbuild.build({
  entryPoints: [ENTRY], bundle: true, format: 'esm', platform: 'node',
  outfile: OUT, jsx: 'automatic', logLevel: 'error',
  /* React MUST stay external, or the bundle inlines a second copy and the
     renderer's dispatcher is null ("Invalid hook call … more than one copy of
     React"). Everything else is bundled from the real sources. */
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
});
mkdirSync(`${ROOT}/.p-tmp`, {recursive: true});
const mod = await import(`${OUT}?t=${Date.now()}`);
const {renderToStaticMarkup} = await import('react-dom/server');
const html = renderToStaticMarkup(mod.All());
const modelHtml = renderToStaticMarkup(mod.Model());
/* The model block is JSON inside a <pre>. Parsed back into an object so the
   assertions below read VALUES, not the strings they would have to re-encode. */
const MODEL = JSON.parse(modelHtml.replace(/^<pre>/, '').replace(/<\/pre>$/, '')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#x27;/g, "'"));

const sectionsOf = id => {
  const seg = html.slice(html.indexOf(`<div id="${id}">`), html.indexOf('</div><div id=', html.indexOf(`<div id="${id}">`)));
  return [...seg.matchAll(/data-section="([^"]+)" data-collapsed="([^"]+)" data-collapsed-default="([^"]+)"/g)]
    .map(m => ({id: m[1], collapsed: m[2], def: m[3]}));
};

/** The markup of ONE target's sections — used by the §E checks below, which ask
 *  what the Text section actually RENDERS for each target. */
const segOf = id => html.slice(html.indexOf(`<div id="${id}">`),
  html.indexOf('</div><div id=', html.indexOf(`<div id="${id}">`)));
/** The `…on` class of the Nth segmented row inside a target's Text section. */
const textSectionOf = id => {
  const seg = segOf(id);
  const at = seg.indexOf('data-section="text"');
  return at < 0 ? '' : seg.slice(at, seg.indexOf('</section>', at));
};
const onLabelsOf = seg => [...seg.matchAll(/<button[^>]*class="[^"]*insp-seg-btn on[^"]*"[^>]*>([^<]*)</g)].map(m => m[1]);
const onSwatchOf = seg => [...seg.matchAll(/class="swatch on"[^>]*data-color-key="([^"]+)"/g)].map(m => m[1]);

let fails = 0;
const check = (name, pass, detail) => { if (!pass) fails++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}  — ${detail}`); };

console.log('='.repeat(78));
console.log('RENDER CHECK — server-side markup of the real components');
console.log('='.repeat(78));
console.log(`markup length: ${html.length} chars`);

const edge = sectionsOf('edge');
const nonErd = sectionsOf('edge-nonerd');
const goblin = sectionsOf('goblin');
const label = sectionsOf('label');
console.log(`\n[data-section] order, ERD edge     : ${edge.map(s => s.id).join(' → ')}`);
console.log(`[data-section] order, non-ERD edge : ${nonErd.map(s => s.id).join(' → ')}`);
console.log(`[data-section] order, goblin       : ${goblin.map(s => s.id).join(' → ')}`);
console.log(`[data-section] order, label        : ${label.map(s => s.id).join(' → ')}`);

check('rendered ERD edge order', edge.map(s=>s.id).join() === 'label,line,markers,cardinality,flow', edge.map(s=>s.id).join());
check('rendered non-ERD edge omits cardinality', nonErd.map(s=>s.id).join() === 'label,line,markers,flow', nonErd.map(s=>s.id).join());
check('rendered goblin order (PASS 2: text between content and style)', goblin.map(s=>s.id).join() === 'content,text,style', goblin.map(s=>s.id).join());
check('rendered label order', label.map(s=>s.id).join() === 'text', label.map(s=>s.id).join());
/* PASS 2 — the four §E.1 controls are in the PAINTED markup of BOTH targets,
   i.e. the section is a real body and not an empty shell. */
const gText = textSectionOf('goblin');
const lText = textSectionOf('label');
console.log(`  goblin Text section: ${gText.length} chars; label Text section: ${lText.length} chars`);
check('both targets PAINT the four §E.1 controls',
  ['>S<','>M<','>L<','>XL<','>Regular<','>Bold<','>Left<','>Center<','>Right<'].every(t => gText.includes(t) && lText.includes(t))
    && (gText.match(/class="swatch(?: on)?"/g) ?? []).length === 6
    && (lText.match(/class="swatch(?: on)?"/g) ?? []).length === 6,
  `${(gText.match(/insp-seg-btn/g) ?? []).length} segmented buttons + `
  + `${(gText.match(/class="swatch(?: on)?"/g) ?? []).length} colour cells on the goblin, same on the label`);
check('the FOUR sizes are a segmented row of four, not a px input',
  (gText.match(/data-opt="/g) ?? []).length === 9 && !/<input[^>]*type="(number|text)"/.test(gText),
  `${(gText.match(/data-opt="/g) ?? []).length} option buttons (4 size + 2 weight + 3 align) and no text/number input`);
/* §E.2 — THE READ, per target: a stored style shows as chosen; a node with none
   shows the INHERITED value and no swatch. */
const storedOn = onLabelsOf(gText);
const defaultOn = onLabelsOf(textSectionOf('goblin-default'));
const loOn = onLabelsOf(textSectionOf('goblin-lo'));
const labelOn = onLabelsOf(lText);
console.log(`  shown values — stored: ${JSON.stringify(storedOn)}  default: ${JSON.stringify(defaultOn)}  label-only: ${JSON.stringify(loOn)}  label: ${JSON.stringify(labelOn)}`);
check('a stored style reads back as the chosen values',
  storedOn.join() === 'XL,Bold,Right' && onSwatchOf(gText).join() === 'amber',
  `size/weight/align ${JSON.stringify(storedOn)}, swatch ${JSON.stringify(onSwatchOf(gText))}`);
check('a node with NO textStyle reads as the inherited values (not blank)',
  defaultOn.join() === 'M,Regular,Left' && onSwatchOf(textSectionOf('goblin-default')).length === 0
    && labelOn.join() === 'M,Regular,Left' && onSwatchOf(lText).length === 0,
  `M / Regular / left and NO swatch on — "default", exactly as §E.2 requires (the panel never shows a blank)`);
check('the align DEFAULT is per-target (label-only nodes are centred by design)',
  loOn.join() === 'M,Regular,Center',
  'a label-only goblin shows Center as its inherited align, straight from `.node .lo-body { text-align: center }`');
/* NEGATIVE CONTROL: the stored read must differ from the default read, or the
   two checks above could both pass on a panel that ignores `textStyle` entirely. */
check('CONTROL — the stored read differs from the default read',
  storedOn.join() !== defaultOn.join() && onSwatchOf(gText).length !== onSwatchOf(textSectionOf('goblin-default')).length,
  'the section is really driven by the node data, not by constants');

check('pass 1 renders everything OPEN', edge.every(s => s.collapsed === 'false'), JSON.stringify(edge.map(s=>s.collapsed)));
check('collapsedDefault true exactly for cardinality + flow',
  edge.filter(s=>s.def==='true').map(s=>s.id).join() === 'cardinality,flow',
  edge.map(s=>`${s.id}=${s.def}`).join(' '));

/* ===========================================================================
   §E.2 — THE STORED VALUES, executed. `Model()` ran the real `mergeTextStyle`
   and `textStyleVars`, so these are outcomes, not readings of the source.
   =========================================================================== */
console.log('\n-- §E.2 the lazy write, executed --');
console.log(`  textStyleVars(undefined)            : ${JSON.stringify(MODEL.oldBoardVars)}`);
console.log(`  only defaults chosen                : ${JSON.stringify(MODEL.onlyDefaults)}`);
console.log(`  one real choice                     : ${JSON.stringify(MODEL.oneChoice)}`);
console.log(`  a default chosen after a real one   : ${JSON.stringify(MODEL.cleared)}`);
console.log(`  label-only + center (its default)   : ${JSON.stringify(MODEL.loDefaultCenter)}`);
console.log(`  card + center (a real choice there) : ${JSON.stringify(MODEL.loExplicitCenterIsAChoice)}`);
console.log(`  a full style → the vars written     : ${JSON.stringify(MODEL.fullVars)}`);
console.log(`  the scale ladder                    : ${JSON.stringify(MODEL.scale)}`);
check('an OLD BOARD (no textStyle) writes nothing and renders nothing',
  Object.keys(MODEL.oldBoardVars).length === 0,
  'textStyleVars(undefined) === {} — no --ts-* property is emitted, so every var() in the sheet falls '
  + 'back to the px/weight/colour the node paints today');
check('choosing every DEFAULT stores NO key at all',
  MODEL.onlyDefaults === undefined,
  'mergeTextStyle(undefined, {size:md, weight:regular, align:left}) === undefined — a user who opens '
  + 'the section and touches nothing leaves the board byte-identical');
check('a real choice stores ONLY that key',
  JSON.stringify(MODEL.oneChoice) === '{"size":"xl"}',
  JSON.stringify(MODEL.oneChoice) + ' — no other field is invented to fill the object out');
check('switching a field back to Default REMOVES the stored key',
  MODEL.cleared === undefined,
  'a node with {size:xl, weight:bold} whose user picks M + Regular again stores NOTHING — the lazy '
  + 'write is symmetric, not write-only');
check('a default is per-target: center is a NO-WRITE for label-only, a WRITE for a card',
  MODEL.loDefaultCenter === undefined && JSON.stringify(MODEL.loExplicitCenterIsAChoice) === '{"align":"center"}',
  'the same click stores nothing on a label-only node (it is already centred) and stores `center` on a '
  + 'card — the inherited value is read from the TARGET, so "default" cannot mean two things');
check('the rendered vars are tokens, one per chosen field',
  JSON.stringify(MODEL.fullVars) === '{"--ts-scale":"1.3","--ts-weight":"700","--ts-color":"var(--c-amber)","--ts-align":"right","--ts-justify":"flex-end"}',
  JSON.stringify(MODEL.fullVars) + ' — the colour is a `var(--c-*)` token (never a hex), and the '
  + 'flex row gets its own `justify-content` because `text-align` cannot move a flex item');
check('the size ladder is a SCALE with a no-op default',
  JSON.stringify(MODEL.scale) === '{"sm":0.85,"md":1,"lg":1.15,"xl":1.3}',
  'four equal 0.15 gaps, and md === 1 so the default multiplies by nothing');

/* ===========================================================================
   Pass 1's picker checks — unchanged.
   =========================================================================== */
const selects = (html.match(/<select[\s>]/g) ?? []).length;
const options = (html.match(/<option[\s>]/g) ?? []).length;
check('ZERO <select> in the rendered markup', selects === 0, `${selects} <select>, ${options} <option>`);
check('triggers are <button> with a caret', (html.match(/icon-trigger-caret/g) ?? []).length >= 5,
  `${(html.match(/icon-trigger-caret/g) ?? []).length} carets, ${(html.match(/aria-haspopup="listbox"/g) ?? []).length} aria-haspopup`);
check('stepper renders − / value / +', html.includes('insp-step-val') && html.includes('data-value="3"'),
  html.slice(html.indexOf('insp-stepper'), html.indexOf('insp-stepper') + 200).replace(/\n/g, ''));
check('segmented rows render as buttons with aria-pressed',
  (html.match(/insp-seg-btn/g) ?? []).length >= 3 && html.includes('aria-pressed="true"'),
  `${(html.match(/insp-seg-btn/g) ?? []).length} segmented buttons`);
check('shape picker trigger shows a ShapePreview silhouette + label',
  html.includes('shape-preview') && html.includes('>Database<'),
  'the trigger renders ShapePreview(database) as its glyph and "Database" as its name');
check('every picker trigger renders its CURRENT option art',
  (html.match(/icon-trigger-glyph/g) ?? []).length >= 5
    && html.includes('M24 9 L18 3'),
  `${(html.match(/icon-trigger-glyph/g) ?? []).length} trigger glyph cells; the cardinality trigger `
  + '(value="many") carries the crow-foot path M24 9 L18 3 → :15 — i.e. the art bank renders');
check('popovers are CLOSED on first render (no list until opened)',
  !html.includes('insp-opt-list') && !html.includes('insp-shape-list') && !html.includes('Search shapes'),
  'open state is false, so only the triggers are in the markup — every option row is built when opened, '
  + 'so the OPTION art is asserted against the tables in checks/package-p-inspector.mjs instead');
check('no empty section shell (title without a body)',
  (html.match(/insp-sec-title/g) ?? []).length === (html.match(/data-section=/g) ?? []).length,
  `${(html.match(/insp-sec-title/g) ?? []).length} titles, ${(html.match(/data-section=/g) ?? []).length} sections`);

console.log(`\nRENDER CHECK: ${fails ? fails + ' FAILURE(S)' : 'all checks passed'}`);
console.log('\n--- sample markup (first trigger + first section) ---');
console.log(html.slice(html.indexOf('<section'), html.indexOf('<section') + 620).replace(/></g, '>\n<'));

/* The esbuild entry + bundle are BUILD ARTEFACTS, not deliverables — a pass that
   leaves three `.p-render-*` files in the repo root is a pass that polluted the
   tree. Removed here on every exit path (the `process.exit` is after this line). */
for (const f of [ENTRY, OUT]) {
  try { rmSync(f, {force: true}); } catch { /* already gone */ }
}
try { rmSync(`${ROOT}/.p-tmp`, {recursive: true, force: true}); } catch { /* already gone */ }
console.log(`cleaned build artefacts: ${ENTRY.split('/').pop()}, ${OUT.split('/').pop()}, .p-tmp/`);
process.exit(fails ? 1 : 0);
