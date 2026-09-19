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
import {defaultSectionState} from './src/inspectorState';
import {textStyleVars, readTextStyle, mergeTextStyle, TEXT_SCALE, TEXT_FONT_OPTS, TEXT_FONT_FAMILY} from './src/textStyle';
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
   wraps them: PickerOption rows with NO art, so the label IS the control.
   ROUND X ITEM 3 adds the FOURTH: the font row, built the way App.tsx builds it
   — ToggleRow plus the wide modifier, each button's art being its own name in
   its own family (TEXT_FONT_FAMILY[key]), so the row is really SSR'd. */
const SZ: any[] = [{v:'sm',label:'S',art:null},{v:'md',label:'M',art:null},{v:'lg',label:'L',art:null},{v:'xl',label:'XL',art:null}];
const WT: any[] = [{v:'regular',label:'Regular',art:null},{v:'bold',label:'Bold',art:null}];
const AL: any[] = [{v:'left',label:'Left',art:null},{v:'center',label:'Center',art:null},{v:'right',label:'Right',art:null}];
const FT: any[] = TEXT_FONT_OPTS.map(o => ({
  v: o.v, label: o.label,
  art: <span className="insp-font-btn" style={{fontFamily: TEXT_FONT_FAMILY[o.v]}}>{o.label}</span>,
}));
const SW: any[] = ['accent','green','cyan','violet','amber','slate'];

const TITLES: any = {content:'Content',text:'Text',style:'Style',table:'Table',columns:'Columns',showMode:'Show mode',label:'Label',line:'Line',markers:'Markers',cardinality:"Cardinality",flow:'Flow animation'};
/* PASS 3 §C — a folded row still shows its current value. Supplied here the way
   App.tsx supplies it, so the SSR path of the readout is really exercised (the
   bodies above and the readouts below are the same values, as in the panel). */
const READOUT: any = {
  cardinality: {node: 'one → many', label: 'ends'},
  flow: {node: 'off', label: 'flow'},
};

export function renderTarget(t: any, bodies: any, fold?: any) {
  const f = fold ?? {state: defaultSectionState(), toggleSection: () => {}};
  return getInspectorSections(t).map((s: any) => (
    <Section key={s.id} id={s.id} title={TITLES[s.id]} collapsedDefault={s.collapsedDefault}
      collapsed={f.state[s.id]} onToggle={f.toggleSection}
      readout={READOUT[s.id]?.node} readoutLabel={READOUT[s.id]?.label}>{bodies[s.id]}</Section>
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
      {/* ROUND X ITEM 1 — shown.size is null for a custom multiplier, and
          App.tsx passes a null-coalesce to an empty string so no step is
          marked; the stub does the same. */}
      <ToggleRow value={shown.size ?? ''} onChange={v => write({size: v})} options={SZ} title="Text size" /></div>
    <div className="field"><label>weight</label>
      <ToggleRow value={shown.weight} onChange={v => write({weight: v})} options={WT} title="Text weight" /></div>
    <div className="field"><label>font</label>
      <ToggleRow value={shown.font} onChange={v => write({font: v})} options={FT} title="Text font for the whole node" wide /></div>
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
  /* ROUND X, ITEM 1 — a node carrying a CUSTOM multiplier, the case the removed
     input used to write. It must still paint (that is textStyleVars) and the
     restored size row must light NO step for it — the panel reports what paints
     rather than claiming M. */
  const gx: any = {kind:'goblin', shape:'service', body:'card'};
  gx.__stored = {scale: 1.7};
  return <div>
    <div id="edge">{renderTarget({kind:'edge', presetId:'erd'}, edgeBodies)}</div>
    {/* PASS 3 §F.5 — the same target with Cardinality EXPANDED, to prove an open
        fold mounts its body INLINE (not a popover) and flips aria-expanded. */}
    <div id="edge-expanded">{renderTarget({kind:'edge', presetId:'erd'}, edgeBodies,
      {state: {...defaultSectionState(), cardinality: false}, toggleSection: () => {}})}</div>
    {/* …and with FLOW expanded instead, which is where the §B #7 stepper lives —
        pass 1/2 asserted the stepper against markup that is now legitimately
        folded away, so it is asserted against the state that paints it. */}
    <div id="edge-flow-open">{renderTarget({kind:'edge', presetId:'erd'}, edgeBodies,
      {state: {...defaultSectionState(), flow: false}, toggleSection: () => {}})}</div>
    <div id="edge-nonerd">{renderTarget({kind:'edge'}, edgeBodies)}</div>
    <div id="goblin">{renderTarget(g, {content: <input />, text: tsBody(g), style: <>
      <ShapesPicker value="database" onChange={()=>{}} color="var(--nc, orange)" />
      <ToggleRow value="card" onChange={()=>{}} options={BD} title="Body" />
    </>})}</div>
    <div id="goblin-default">{renderTarget({kind:'goblin', shape:'service', body:'card'}, {text: tsBody({kind:'goblin', shape:'service', body:'card'})})}</div>
    <div id="goblin-lo">{renderTarget(lo, {text: tsBody(lo)})}</div>
    {/* ROUND X ITEM 1 — the same target carrying a CUSTOM multiplier. */}
    <div id="goblin-custom">{renderTarget(gx, {text: tsBody(gx)})}</div>
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
/** The `on` labels of a target's segmented rows, read from the button's own TEXT.
 *  ROUND X, ITEM 3 — `+` not `*`: the FONT row's buttons carry a `<span>` (their
 *  name, in their own family), so they have no text node and are deliberately not
 *  read here. They are asserted separately by `onFontOf` below, because their
 *  markup is the whole point of that control. */
const onLabelsOf = seg => [...seg.matchAll(/<button[^>]*class="[^"]*insp-seg-btn on[^"]*"[^>]*>([^<]+)</g)].map(m => m[1]);
/** ROUND X, ITEM 3 — which FONT button is marked, matched on `.insp-font-btn`
 *  (the row is the only one whose buttons carry it), not on position. */
const onFontOf = seg => [...seg.matchAll(/<button[^>]*insp-seg-btn on[^>]*data-opt="([^"]+)"[^>]*><span class="insp-font-btn"/g)].map(m => m[1]);
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
  (gText.match(/data-opt="/g) ?? []).length === 13 && !/<input[^>]*type="(number|text)"/.test(gText),
  `${(gText.match(/data-opt="/g) ?? []).length} option buttons (4 size + 2 weight + 4 font + 3 align) and no `
  + 'text/number input — ROUND X ITEM 1 removed the custom-size input and ROUND X ITEM 3 added the font row, '
  + 'so the count went 9 → 13');
/* §E.2 — THE READ, per target: a stored style shows as chosen; a node with none
   shows the INHERITED value and no swatch. */
const storedOn = onLabelsOf(gText);
const defaultOn = onLabelsOf(textSectionOf('goblin-default'));
const loOn = onLabelsOf(textSectionOf('goblin-lo'));
const labelOn = onLabelsOf(lText);
/* ROUND X, ITEM 3 — the font row, per target. `mono` on every target here
   because none of the fixtures stores a `font`, and `mono` IS the default — which
   is also why the row is `on` there without anything being written. */
const storedFontOn = onFontOf(gText);
const defaultFontOn = onFontOf(textSectionOf('goblin-default'));
console.log(`  shown values — stored: ${JSON.stringify(storedOn)}  default: ${JSON.stringify(defaultOn)}  label-only: ${JSON.stringify(loOn)}  label: ${JSON.stringify(labelOn)}`);
console.log(`  the font row renders ${(gText.match(/class="insp-font-btn"/g) ?? []).length} name-in-own-family buttons; `
  + `marked: stored ${JSON.stringify(storedFontOn)} / default ${JSON.stringify(defaultFontOn)}`);
check('a stored style reads back as the chosen values',
  storedOn.join() === 'XL,Bold,Right' && onSwatchOf(gText).join() === 'amber',
  `size/weight/align ${JSON.stringify(storedOn)}, swatch ${JSON.stringify(onSwatchOf(gText))}`);
check('a node with NO textStyle reads as the inherited values (not blank)',
  defaultOn.join() === 'M,Regular,Left' && onSwatchOf(textSectionOf('goblin-default')).length === 0
    && labelOn.join() === 'M,Regular,Left' && onSwatchOf(lText).length === 0,
  `M / Regular / left and NO swatch on — "default", exactly as §E.2 requires (the panel never shows a blank)`);
check('ROUND X ITEM 3 — the font row renders FOUR self-previewing buttons, all on one target',
  (gText.match(/class="insp-font-btn"/g) ?? []).length === 4
    && ['Mono', 'UI', 'Read', 'Viet'].every(l => gText.includes(`>${l}</span>`))
    /* Each button's span carries its OWN family — the preview is not decoration.
       React escapes `'` as `&#x27;` inside an inline style, so the emitted
       attribute is read in that form (measured, not assumed). */
    && gText.includes('font-family:&#x27;JetBrains Mono&#x27;, var(--mono)')
    && gText.includes('font-family:&#x27;Inter&#x27;')
    && gText.includes('font-family:&#x27;Lexend&#x27;')
    && gText.includes('font-family:&#x27;Be Vietnam Pro&#x27;')
    /* ONE NAME PER BUTTON: the row builds each button from ONE span, so the
       two-cell `Mono Mono` shape ROUND W had to suppress cannot recur. */
    && !gText.includes('Mono Mono'),
  `${(gText.match(/class="insp-font-btn"/g) ?? []).length} buttons, each printing its own name in its own `
  + 'family, and no repeated name anywhere in the row');
check('ROUND X ITEM 3 — the marked font button is the stored family, and mono is marked by default',
  storedFontOn.join() === 'mono' && defaultFontOn.join() === 'mono',
  '`mono` is TEXT_DEFAULT_FONT, so it is both what the fixture stores (nothing) and what the row marks — '
  + 'the `.insp-seg-btn.on` treatment reaches the font row without a rule of its own');
check('the align DEFAULT is per-target (label-only nodes are centred by design)',
  loOn.join() === 'M,Regular,Center',
  'a label-only goblin shows Center as its inherited align, straight from `.node .lo-body { text-align: center }`');
/* ROUND X, ITEM 1 — THE CUSTOM MULTIPLIER, end to end in markup. The input is
   gone, so this is the ONLY place the user-visible half of a stored custom scale
   can be verified: the node still gets `--ts-scale` and the restored size row
   marks NO step. `readTextStyle` answers `null` for 1.7, and App.tsx renders
   `size ?? ''`, which matches no option — so `onLabelsOf` finds no marked size
   button while the other three rows are untouched. */
const customText = textSectionOf('goblin-custom');
const customOn = onLabelsOf(customText);
console.log(`  custom scale 1.7 — marked segmented buttons: ${JSON.stringify(customOn)}  `
  + `(weight/align still default, size deliberately UNSET)`);
check('ROUND X ITEM 1 — a stored custom scale marks NO step and does not disturb the other rows',
  customOn.join() === 'Regular,Left'
    && customText.includes('data-opt="sm"') && customText.includes('data-opt="xl"')
    && !/class="[^"]*insp-seg-btn on[^"]*"[^>]*data-opt="(sm|md|lg|xl)"/.test(customText),
  `${JSON.stringify(customOn)} — the four size buttons are present and NONE is marked (1.7 is not a step), `
  + 'while weight and align still show their inherited values');
/* NEGATIVE CONTROL: the stored read must differ from the default read, or the
   two checks above could both pass on a panel that ignores `textStyle` entirely. */
check('CONTROL — the stored read differs from the default read',
  storedOn.join() !== defaultOn.join() && onSwatchOf(gText).length !== onSwatchOf(textSectionOf('goblin-default')).length,
  'the section is really driven by the node data, not by constants');

/* PASS 3 §C/§F.4 — the fold is now REAL, and on a fresh profile it is §A.3's
   truth table: Cardinality and Flow folded, everything else open. The readout
   values here are the ones the panel would show for the harness's own bodies. */
check('PASS 3 — nothing folded except cardinality + flow (the §A.3 default)',
  edge.filter(s => s.collapsed === 'true').map(s => s.id).join() === 'cardinality,flow'
    && edge.filter(s => s.collapsed === 'false').map(s => s.id).join() === 'label,line,markers',
  edge.map(s => `${s.id}=${s.collapsed}`).join(' '));
check('collapsedDefault true exactly for cardinality + flow',
  edge.filter(s=>s.def==='true').map(s=>s.id).join() === 'cardinality,flow',
  edge.map(s=>`${s.id}=${s.def}`).join(' '));
/* §F.4 — the folded sections' BODIES are absent from the DOM, their TRIGGER rows
   are present, and an open section's body is present. Asserted by MARKUP, since
   this is the SSR of the real component. */
const flowBodyAbsent = !segOf('edge').includes('title="Flow count"')
  && !segOf('edge').includes('title="Flow speed"');
const cardBodyAbsent = !segOf('edge').includes('title="Cardinality: source end"');
/* PASS 3 — SECTION triggers only. The icon-picker triggers carry their own
   `aria-expanded` for their popovers, so a bare count of the attribute mixes the
   two vocabularies; the class is what tells a SECTION fold from a popover. */
const sectionFolds = seg => {
  const m = [...seg.matchAll(/class="insp-sec-trigger" aria-expanded="(true|false)"/g)].map(x => x[1]);
  return {open: m.filter(v => v === 'true').length, folded: m.filter(v => v === 'false').length, total: m.length};
};
const edgeFolds = sectionFolds(segOf('edge'));
check('§F.4 — folded Cardinality/Flow bodies are ABSENT, their triggers PRESENT',
  cardBodyAbsent && flowBodyAbsent
    && edgeFolds.total === 5 && edgeFolds.open === 3 && edgeFolds.folded === 2,
  `${edgeFolds.open} open section triggers + ${edgeFolds.folded} folded (of ${edgeFolds.total}); `
  + `cardinality body ${cardBodyAbsent ? 'absent' : 'PRESENT'}, flow body ${flowBodyAbsent ? 'absent' : 'PRESENT'}`);
check('§F.4 — an OPEN section\'s body is in the DOM (negative control)',
  segOf('edge').includes('title="Stroke width"') && segOf('edge').includes('title="Arrow head"'),
  'the Line/Markers bodies are present with the SAME renderTarget call, so "absent" is the fold and not a broken painter');
check('§C — a folded row shows its current value',
  segOf('edge').includes('insp-sec-readout') && segOf('edge').includes('ends') && segOf('edge').includes('flow'),
  'the Cardinality trigger carries its `ends` readout and the Flow trigger its `flow` readout');
check('§F.5 SSR — every section is keyboard-operable and labelled',
  (segOf('edge').match(/aria-controls="insp-sec-/g) ?? []).length === 5
    && (segOf('edge').match(/<button[^>]*class="insp-sec-trigger"/g) ?? []).length === 5,
  'one aria-controls + one native <button> per section, so Enter/Space work without any key handler');
/* §F.5's UI HALF, in markup: expanding a section reveals its body INLINE in the
   same section element (not a popover, not a portal) and flips aria-expanded. */
const expandedEdge = segOf('edge-expanded');
const expandedFolds = sectionFolds(expandedEdge);
check('§F.5 SSR — expanding a section reveals its body inline in place',
  expandedEdge.includes('title="Cardinality: source end"')
    && !expandedEdge.includes('title="Flow count"')
    && expandedFolds.open === 4 && expandedFolds.folded === 1 && expandedFolds.total === 5,
  `cardinality expanded: its body is back (${expandedEdge.includes('title="Cardinality: source end"')}), `
  + `flow still folded, ${expandedFolds.open} open section triggers — one fold state, two sections, independent values`);

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
/* PASS 3 MOVED THIS ASSERTION, IT DID NOT WEAKEN IT. The stepper is the §B #7
   control inside Flow animation, which §A.3 folds by default — so the fresh
   markup legitimately no longer carries it. It is asserted against the state
   that paints it (Flow expanded) AND its absence is asserted against the state
   that folds it, which is a STRONGER pair of claims than the single presence
   check it replaces. */
const flowOpen = segOf('edge-flow-open');
check('stepper renders − / value / +',
  flowOpen.includes('insp-step-val') && flowOpen.includes('data-value="3"'),
  flowOpen.slice(flowOpen.indexOf('insp-stepper'), flowOpen.indexOf('insp-stepper') + 200).replace(/\n/g, ''));
check('PASS 3 — the stepper is absent while Flow is folded (the fold, not a lost control)',
  sectionFolds(flowOpen).folded === 1 && sectionFolds(flowOpen).open === 4
    && !segOf('edge').includes('data-value="3"'),
  'folded: 0 steppers in the fresh markup; flow expanded: the stepper and its value are back');
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
