/* ROUND C — print route (Harvey-approved route (i)): a print stylesheet +
 * window.print(). Zero dependency; the BROWSER's own PDF engine embeds the
 * fonts properly and keeps the text selectable. This is a print VIEW the
 * user triggers — the modal says so ("opens the print dialog — choose
 * Save as PDF"), it is not a one-click download.
 *
 * The print document inlines the ALREADY-EMITTED SVG string (the same one
 * the .svg download gets — one painter per pixel class) into a minimal
 * standalone document: no iframe, no external asset, so the browser's
 * print engine sees plain inline SVG and embeds the system fonts itself.
 * The modal's theme/scale/scope are already baked into that string (the
 * scene was built with them), so the print view carries exactly what the
 * preview showed.
 */

/** Build the print document and open the browser's print dialog.
 *  Resolves when the print window has been opened (the dialog itself is
 *  the user's). Throws when popup/automation blocking prevents the window
 *  (the modal surfaces the message). */
export function printSvgAsPdf(svg: string, title: string): void {
  /* The svg string is OUR OWN emitter's output (the same bytes the .svg
   * download gets); assert script-free at the boundary and parse it
   * through DOMParser (never document.write / innerHTML). */
  if (/<script/i.test(svg)) throw new Error('print view: svg carries a script element (unexpected)');
  const doc = new DOMParser().parseFromString(svg.trim(), 'image/svg+xml');
  const svgNode = doc.documentElement;
  if (!svgNode || svgNode.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('print view: the export did not parse as an SVG root (unexpected)');
  }

  const w = window.open('', '_blank', 'width=1100,height=850');
  if (!w) throw new Error('The print dialog could not open — allow pop-ups for this site and try again.');
  try {
    w.document.title = title;
    const style = w.document.createElement('style');
    style.textContent = `
  @page { margin: 12mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  /* the SVG sizes itself from its width/height attributes; let wide
   * diagrams scale down to the printable width instead of clipping */
  svg { max-width: 100%; height: auto; }
`;
    w.document.head.appendChild(style);
    w.document.body.appendChild(w.document.importNode(svgNode, true));
    /* no external refs by construction, so print can be called right
     * after the node lands — one layout tick first. */
    w.focus();
    w.print();
  } catch (e) {
    w.close();
    throw e;
  }
}
