
import {mergeTextStyle} from './src/textStyle.ts';
// Harvey's case: node has colorKey 'slate', user drags custom to red
const stored = {colorKey: 'slate'};
const out = mergeTextStyle(stored, {customColor: '#ff0000', colorKey: undefined}, 'left', 'top');
console.log(JSON.stringify(out));
// expect: {"customColor":"#ff0000"} — colorKey deleted, customColor SURVIVES
// and the reverse: picking a key clears the literal
const out2 = mergeTextStyle({customColor: '#ff0000'}, {colorKey: 'cyan', customColor: undefined}, 'left', 'top');
console.log(JSON.stringify(out2));
// expect: {"colorKey":"cyan"}
