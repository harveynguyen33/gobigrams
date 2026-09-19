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

const TITLES: any = {content:'Content',text:'Text',style:'Style',table:'Table',columns:'Columns',showMode:'Show mode',label:'Label',line:'Line',markers:'Markers',cardinality:"Cardinality",flow:'Flow animation'};

export function renderTarget(t: any, bodies: any) {
  return getInspectorSections(t).map((s: any) => (
    <Section key={s.id} id={s.id} title={TITLES[s.id]} collapsedDefault={s.collapsedDefault}>{bodies[s.id]}</Section>
  ));
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
  return <div>
    <div id="edge">{renderTarget({kind:'edge', presetId:'erd'}, edgeBodies)}</div>
    <div id="edge-nonerd">{renderTarget({kind:'edge'}, edgeBodies)}</div>
    <div id="goblin">{renderTarget({kind:'goblin', shape:'service', body:'card'}, {content: <input />, style: <>
      <ShapesPicker value="database" onChange={()=>{}} color="var(--nc, orange)" />
      <ToggleRow value="card" onChange={()=>{}} options={BD} title="Body" />
    </>})}</div>
  </div>;
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

const sectionsOf = id => {
  const seg = html.slice(html.indexOf(`<div id="${id}">`), html.indexOf('</div><div id=', html.indexOf(`<div id="${id}">`)));
  return [...seg.matchAll(/data-section="([^"]+)" data-collapsed="([^"]+)" data-collapsed-default="([^"]+)"/g)]
    .map(m => ({id: m[1], collapsed: m[2], def: m[3]}));
};

let fails = 0;
const check = (name, pass, detail) => { if (!pass) fails++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}  — ${detail}`); };

console.log('='.repeat(78));
console.log('RENDER CHECK — server-side markup of the real components');
console.log('='.repeat(78));
console.log(`markup length: ${html.length} chars`);

const edge = sectionsOf('edge');
const nonErd = sectionsOf('edge-nonerd');
const goblin = sectionsOf('goblin');
console.log(`\n[data-section] order, ERD edge     : ${edge.map(s => s.id).join(' → ')}`);
console.log(`[data-section] order, non-ERD edge : ${nonErd.map(s => s.id).join(' → ')}`);
console.log(`[data-section] order, goblin       : ${goblin.map(s => s.id).join(' → ')}`);

check('rendered ERD edge order', edge.map(s=>s.id).join() === 'label,line,markers,cardinality,flow', edge.map(s=>s.id).join());
check('rendered non-ERD edge omits cardinality', nonErd.map(s=>s.id).join() === 'label,line,markers,flow', nonErd.map(s=>s.id).join());
check('rendered goblin order', goblin.map(s=>s.id).join() === 'content,style', goblin.map(s=>s.id).join());
check('pass 1 renders everything OPEN', edge.every(s => s.collapsed === 'false'), JSON.stringify(edge.map(s=>s.collapsed)));
check('collapsedDefault true exactly for cardinality + flow',
  edge.filter(s=>s.def==='true').map(s=>s.id).join() === 'cardinality,flow',
  edge.map(s=>`${s.id}=${s.def}`).join(' '));

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
