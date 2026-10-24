/**
 * ROUND BH, ITEM 1 (public launch, 2026-10-24) — the feedback issue-URL
 * builder, PURE AND REACT-FREE on purpose.
 *
 * WHY NO TOKEN. A public static app cannot ship a GitHub token: every byte it
 * ships is public, so any "client token" would let anyone create issues as the
 * app (or worse). The honest static-host pattern (Excalidraw's Google Form,
 * tldraw's Typeform, a proxy endpoint for apps with a server) is to PREFILL:
 * the app builds the exact new-issue URL for the repo's own template forms
 * (.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md) and opens it in a
 * new tab — the user reviews the filled form and presses Submit on GitHub.
 * Zero typing, zero secrets in the client.
 *
 * WHY NO `labels` PARAM. GitHub's issue-creation API only honours labels for
 * collaborators; the new-issue form ignores a `labels` query param for
 * anonymous/collaborator-less users at best and 400s at worst. The template's
 * own YAML front matter already attaches `bug` / `enhancement`, so the labels
 * arrive with the template — the URL must not pretend to set them.
 *
 * The module is React-free (a `roadmap.ts` peer) so the harness can esbuild
 * and EXECUTE it, asserting the URL contract byte-for-byte rather than
 * regexing source.
 */

/** The repo's issues root — the fallback link and the URL builder's base.
 *  ROUND BI: the repo is `harveynguyen33/gobigrams` (renamed from
 *  `goblin-diagrams`, which still 301-redirects — this constant is the
 *  canonical one the app must ship). */
export const FEEDBACK_ISSUES_URL = 'https://github.com/harveynguyen33/gobigrams/issues';

/** The two kinds the dialog offers; each maps to one template file. */
export type FeedbackKind = 'bug' | 'feature';

const TEMPLATE_BY_KIND: Record<FeedbackKind, string> = {
  bug: 'bug_report.md',
  feature: 'feature_request.md',
};

/** The template question each kind's body answers under (kept in sync with
 *  .github/ISSUE_TEMPLATE/*.md so the preview reads as a filled form). */
const HEADING_BY_KIND: Record<FeedbackKind, string> = {
  bug: 'Bug report',
  feature: 'Feature request',
};

/**
 * Build the prefilled new-issue URL. Everything is URL-encoded once, by
 * `URLSearchParams`, so unicode, `&`, `?`, `#`, quotes and newlines in the
 * user's text round-trip byte-exact through GitHub's form.
 *
 * An EMPTY email renders as an em-dash placeholder, never a blank line — the
 * template's contact line must not look like the user deleted it.
 */
export function buildFeedbackIssueUrl(
  kind: FeedbackKind,
  title: string,
  details: string,
  email: string,
): string {
  const lines = [
    HEADING_BY_KIND[kind],
    '',
    details.trim(),
    '',
    `Contact: ${email.trim() || '—'}`,
  ];
  const q = new URLSearchParams({
    template: TEMPLATE_BY_KIND[kind],
    title: title.trim(),
    body: lines.join('\n'),
  });
  return `${FEEDBACK_ISSUES_URL}/new?${q.toString()}`;
}
