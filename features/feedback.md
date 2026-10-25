---
feature: feedback
entry_paths:
  - src/FeedbackDialog.tsx
  - src/feedbackIssueUrl.ts
  - src/boardClipboard.ts
  - src/components/HelpSheet.tsx
  - src/components/ModalMounts.tsx
verified: never-driven (created 2026-10-25, ROUND BN-4 Phase D)
---
# feedback

In-app bug/feature reporting WITHOUT a backend: the dialog prefills a GitHub new-issue
URL (no token, no POST — the only network act is window.open), and the board can be
copied to the clipboard as a PNG to paste into the GitHub body.

## Sub-features

The feature's module homes and their roles:

- `src/FeedbackDialog.tsx` — the dialog (focus trap, Esc return, bug/feature radios)
- `src/feedbackIssueUrl.ts` — the pure URL builder + the issues base
- `src/boardClipboard.ts` — the pure clipboard brain (ClipboardItem constructed
  SYNCHRONOUSLY with a Promise<Blob> for Safari; renders nothing on non-secure origins)
- `src/components/HelpSheet.tsx` — "Send feedback" is the SECOND action in the ? sheet
- `src/components/ModalMounts.tsx` — the app-level dialog mount (two openers, one instance)

## How to get to it (user POV)

Reach the feature from the app surface (Export menu, ? sheet → Send feedback, Boards menu / reload).

- No fetch/XHR/POST/Authorization/api.github.com anywhere in the dialog path.
- The attach row renders for any non-empty board; without a clipboard it EXPLAINS
  ("Copying needs HTTPS") instead of hiding.

## Driving it with harness

round-bh-feedback (58 assertions incl. live trap/URL tests), round-bg-feedback-entry,
round-bn2-hooks live probe.

## Gotchas

- See the file links above; every invariant is pinned by the named harnesses.

