/* embedEntry.tsx — ROUND GOBI-S2: the /embed html entry's module. Kept as
 * its own tiny file (the multi-page input vite builds); it mounts the embed
 * route component into #embed. The app entry (main.tsx) stays untouched. */
import {mountEmbed} from './embed';

const root = document.getElementById('embed');
if (root) mountEmbed(root);
