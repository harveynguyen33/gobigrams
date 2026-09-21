#!/usr/bin/env node
/* Print the flow-related data of every persisted edge — read-only. */
import {readdirSync, readFileSync} from 'node:fs';
const dir = process.argv[2] || 'boards';
for (const f of readdirSync(dir).filter(n => n.endsWith('.json'))) {
  let doc;
  try { doc = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); } catch { continue; }
  const es = doc.edges || [];
  if (!es.length) continue;
  console.log(`=== ${f} (${es.length} edges)`);
  es.forEach((e, i) => {
    const d = e.data || {};
    if (d.flow || d.flowIcon || d.flowCount || d.flowDuration || e.animated !== undefined) {
      console.log(`  [${i}] id=${e.id} animated=${e.animated} flow=${JSON.stringify(d.flow)} icon=${JSON.stringify(d.flowIcon)} count=${JSON.stringify(d.flowCount)} dur=${JSON.stringify(d.flowDuration)} keys=${JSON.stringify(Object.keys(d))}`);
    }
  });
}
