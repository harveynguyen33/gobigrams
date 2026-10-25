#!/usr/bin/env node
/**
 * checks/naming-convention.mjs — ONE naming rule, enforced by a harness instead
 * of by memory (ROUND NS-1, 2026-10-25, Harvey-approved plan:
 * PLAN-structure-naming.md).
 *
 * THE RULE (this is the whole contract; nothing else is measured here):
 *   1. `.ts` modules            -> camelCase            (edgeData.ts, boardUtils.ts …)
 *   2. `.tsx` modules whose primary export is a React component -> PascalCase
 *      (DiagramNode.tsx, Toolbar.tsx …); every other `.tsx` -> camelCase.
 *   3. `index.ts` / `index.tsx` barrels are exempt from (1)/(2).
 *   4. A `.tsx` file must contain at least one JSX element — a `.tsx` that only
 *      exports strings/styles/hooks is a `.ts` module wearing the wrong
 *      extension (`pickers/popover.tsx` was the precedent).
 *   5. Directories              -> lowercase single word or camelCase
 *      (`edges/`, `pickers/`, `settings/`), never PascalCase/snake/kebab.
 *
 * WHY THIS SHAPE. The React mainstream (Next.js, Vite templates, Polaris) runs
 * exactly these two file cases: PascalCase means "renders UI", camelCase means
 * "exports logic". The payoff is that a filename tells you what you will find.
 * Full kebab-case folder-per-feature layouts are also valid but would rename
 * every file for no functional gain — rejected in the plan.
 *
 * COMPONENT DETECTION (deliberately a heuristic, pinned so it is auditable):
 * the harness parses each file with the TypeScript compiler and calls a module a
 * "component module" when
 *   (a) its DEFAULT export is a React component, where a component is
 *       - `memo(...)` / `forwardRef(...)` (React or unqualified), or
 *       - a function/arrow whose body contains a JSX element, or
 *       - a Capitalized binding that is rendered as a JSX tag anywhere in src/;
 *   (b) it has no default export but exports at least one such NAMED component
 *       (the picker/controls libraries: Rows.tsx, Controls.tsx …).
 * SCREAMING_SNAKE exports (SHAPES, SPEED_MIN) are data, never components.
 *
 * ALLOWLIST — ambiguous modules where the plan pins the current spelling. Each
 * entry needs a REASON, and all three are re-checked for existence below: a
 * stale allowlist entry is itself a failure, so the list cannot rot.
 *
 * WHAT THIS CANNOT SEE: whether a name is a GOOD name (a well-cased
 * `thingDoer2.ts` passes), and it says nothing about folder layout — family dirs
 * are a separate, human decision (PLAN-structure-naming.md item 3).
 *
 * RED-FIRST EVIDENCE: written before the NS-2 renames and run against HEAD
 * 0f08d17, it reported 9 violations (edges/EdgeData.ts + the eight
 * camelCase component modules) — see the NS-1 commit message. It is now green.
 */
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC = join(ROOT, 'src');

/* Ambiguous modules the plan keeps as they are. path -> why. */
const ALLOWLIST = new Map([
  ['src/InspectorPickers.tsx',
    're-export shell: it exports picker COMPONENTS but renders none itself; the plan keeps PascalCase'],
  ['src/boardUtils.tsx',
    'shared geometry/edge kernel of node+edge helpers; TableGlyph is one incidental glyph, not the module'],
  ['src/nodes/shapes.tsx',
    'the shape REGISTRY (data + SVG string helpers); ShapeFrame/ShapePreview consume it, they are not the module'],
]);

const CAMEL = /^[a-z][A-Za-z0-9]*$/;
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const DIR_OK = /^[a-z][a-z0-9]*$|^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/; // lowercase word OR camelCase
const BARREL = /^index\.tsx?$/;
const SCREAMING = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$|^[A-Z][A-Z0-9]{2,}$/;

const files = [];
const dirs = [];
(function walk(dir) {
  for (const e of readdirSync(dir, {withFileTypes: true})) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { dirs.push(p); walk(p); }
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
})(SRC);

const rel = p => relative(ROOT, p).split('\\').join('/');
const text = new Map(files.map(f => [f, readFileSync(f, 'utf8')]));
const ast = new Map(files.map(f => [f, ts.createSourceFile(f, text.get(f), ts.ScriptTarget.Latest, true,
  f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)]));

/* ---- helpers over the AST ------------------------------------------------ */

function walkAst(node, fn) {
  if (fn(node) === false) return;
  node.forEachChild(c => walkAst(c, fn));
}

function isExported(node) {
  return !!(node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword));
}

/** Local declarations by name, so `export default TableNode` can be resolved. */
function localDecls(sf) {
  const map = new Map();
  walkAst(sf, n => {
    if (ts.isFunctionDeclaration(n) && n.name) map.set(n.name.text, n);
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) map.set(n.name.text, n);
    else if (ts.isClassDeclaration(n) && n.name) map.set(n.name.text, n);
  });
  return map;
}

function containsJsx(node) {
  let found = false;
  walkAst(node, n => {
    if (found) return false;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) { found = true; return false; }
  });
  return found;
}

function calleeName(expr) {
  if (!ts.isCallExpression(expr)) return '';
  const c = expr.expression;
  return ts.isIdentifier(c) ? c.text
    : ts.isPropertyAccessExpression(c) ? c.name.text
    : ts.isElementAccessExpression(c) ? '' : '';
}

/** Is this expression (an export target) a React component? */
function isComponentExpr(expr, decls, rendered, depth = 0) {
  if (!expr || depth > 4) return false;
  if (ts.isParenthesizedExpression(expr)) return isComponentExpr(expr.expression, decls, rendered, depth + 1);
  if (ts.isIdentifier(expr)) {
    const name = expr.text;
    if (SCREAMING.test(name)) return false;
    if (!PASCAL.test(name)) {
      // lower-case binding is a component only if it renders JSX (never Pascal-eligible)
      const d = decls.get(name);
      return !!d && containsJsx(d);
    }
    const d = decls.get(name);
    if (d) {
      const init = ts.isFunctionDeclaration(d) || ts.isClassDeclaration(d) ? d : d.initializer;
      if (init && (calleeName(init) === 'memo' || calleeName(init) === 'forwardRef')) return true;
      if (init && containsJsx(init)) return true;
    }
    return rendered.has(name);
  }
  if (calleeName(expr) === 'memo' || calleeName(expr) === 'forwardRef') return true;
  if (ts.isFunctionExpression(expr) || ts.isArrowFunction(expr)) return containsJsx(expr);
  if (ts.isFunctionDeclaration(expr) || ts.isFunctionExpression(expr)) return containsJsx(expr);
  return false;
}

/* Every JSX tag rendered anywhere under src/ — the cross-file half of the rule. */
const rendered = new Set();
for (const [f, sf] of ast) {
  if (!f.endsWith('.tsx')) continue;
  walkAst(sf, n => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName;
      if (ts.isIdentifier(tag)) rendered.add(tag.text);
      else if (ts.isPropertyAccessExpression(tag)) rendered.add(tag.name.text);
    }
  });
}

/** `.tsx` files that never build a JSX node — the extension is a lie for these. */
const noJsx = new Set();
for (const [f, sf] of ast) {
  if (!f.endsWith('.tsx')) continue;
  let jsx = false;
  walkAst(sf, n => {
    if (jsx) return false;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) { jsx = true; return false; }
  });
  if (!jsx) noJsx.add(f);
}

/** Exported bindings + default export, resolved to component-ness. */
function analyse(file) {
  const sf = ast.get(file);
  const decls = localDecls(sf);
  const named = [];      // {name, component}
  let defaultComponent = null; // null = no default export
  let hasDefault = false;

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && isExported(stmt)) {
      named.push({name: stmt.name.text, component: isComponentExpr(stmt, decls, rendered)});
    } else if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        named.push({name: d.name.text, component: isComponentExpr(d.initializer, decls, rendered)});
      }
    } else if (ts.isExportAssignment(stmt)) { // export default X / export default memo(…)
      hasDefault = true;
      defaultComponent = isComponentExpr(stmt.expression, decls, rendered);
    }
  }
  // `export {X as default}` shape
  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt) || !stmt.exportClause || !ts.isNamedExports(stmt.exportClause)) continue;
    for (const sp of stmt.exportClause.elements) {
      if (sp.name.text === 'default') {
        hasDefault = true;
        const local = sp.propertyName ? sp.propertyName.text : sp.name.text;
        defaultComponent = isComponentExpr({kind: ts.SyntaxKind.Identifier, text: local}, decls, rendered);
      }
    }
  }

  const namedComponents = named.filter(n => n.component && !SCREAMING.test(n.name));
  const componentModule = hasDefault ? !!defaultComponent
    : namedComponents.some(n => PASCAL.test(n.name));
  return {componentModule, hasDefault, defaultComponent, namedComponents: namedComponents.map(n => n.name)};
}

/* ---- the checks ---------------------------------------------------------- */

const violations = [];

for (const dir of dirs) {
  const name = dir.split('/').pop();
  if (!DIR_OK.test(name)) {
    violations.push([rel(dir), `directory name "${name}" is not lowercase-single-word or camelCase`]);
  }
}

const stats = {files: 0, componentFiles: 0, allowlisted: 0};

for (const file of files) {
  const r = rel(file);
  const base = file.split('/').pop();
  if (BARREL.test(base)) continue;
  stats.files += 1;
  const stem = base.replace(/\.tsx?$/, '');
  const isTsx = base.endsWith('.tsx');
  const {componentModule} = analyse(file);
  if (componentModule) stats.componentFiles += 1;

  if (ALLOWLIST.has(r)) { stats.allowlisted += 1; continue; }

  if (!CAMEL.test(stem) && !PASCAL.test(stem)) {
    violations.push([r, `"${stem}" is neither camelCase nor PascalCase`]);
    continue;
  }
  if (!isTsx) {
    if (PASCAL.test(stem)) {
      violations.push([r, `.ts module is PascalCase — a .ts file exports logic, not a component (rename to ${stem[0].toLowerCase() + stem.slice(1)}.ts)`]);
    }
    continue;
  }
  if (componentModule && !PASCAL.test(stem)) {
    violations.push([r, `component module is camelCase — components are PascalCase (rename to ${stem[0].toUpperCase() + stem.slice(1)}.tsx)`]);
  } else if (!componentModule && PASCAL.test(stem)) {
    violations.push([r, `non-component module is PascalCase — logic modules are camelCase (rename to ${stem[0].toLowerCase() + stem.slice(1)}.tsx)`]);
  }
  /* The extension is part of the name: a .tsx that never builds a JSX element is
     a logic/style module and belongs in a .ts file (popover.tsx precedent). */
  if (!noJsx.has(file)) { /* has JSX — fine */ }
  else {
    violations.push([r, `.tsx module contains no JSX — the extension claims UI it does not render (rename to ${stem}.ts)`]);
  }
}

/* A stale allowlist entry is a lie about the tree: the file moved or went away. */
for (const [p, why] of ALLOWLIST) {
  if (!text.has(join(ROOT, p))) {
    violations.push([p, `allowlisted but no longer present — drop the entry (${why})`]);
  }
}

if (!files.length) {
  console.error('naming-convention: FAIL — no TypeScript files found under src/ (wrong root?)');
  process.exit(1);
}

if (violations.length) {
  console.error(`naming-convention: ${violations.length} violation(s) of the file/dir naming rule`);
  for (const [p, why] of violations) console.error(`  ${p} — ${why}`);
  console.error('rule: .ts + non-component .tsx = camelCase · component .tsx = PascalCase · dirs = lowercase/camelCase');
  process.exit(1);
}

console.log(`naming-convention: PASS — ${stats.files} module(s) (${stats.componentFiles} component), ` +
  `${dirs.length} dir(s), ${stats.allowlisted} allowlisted, 0 violations`);
