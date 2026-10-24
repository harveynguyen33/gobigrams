# PENDING: append to AGENTS.md (ROUND BN, ITEM 3)

The write to AGENTS.md was blocked by the agent-instruction-file protection
(approval prompt timed out; silence is not consent). Harvey or the parent agent
should append the section below to AGENTS.md verbatim, replacing the final line
"One thing this repo does not do: it does not write outside its own tree."
(that line moves to the end of the new section).

---

## Code structure rules

These rules exist to stop the god-file pattern. Research basis: ESLint `max-lines`
guidance (100–500 lines/file is the industry norm), bulletproof-react's layered
`src/` structure, and Robin Wieruch's split-when-reusable rule.

- **No file under `src/` may exceed its file-size-gate budget.** The SOURCE OF
  TRUTH for every budget is the `BUDGETS` map in `checks/file-size-gate.mjs` —
  if this section and that table disagree, the table wins. The harness prints a
  file/lines/budget/status table and fails the gate on any breach.
- **New files default to a 400-line budget** and must be added to the budget map
  once created (the harness fails on any unbudgeted file, so this is enforced).
- **Budgets ratchet DOWN over time.** Each extraction round must lower its
  target's budget to the new measured size. A raise is allowed only with a real
  code-change reason named in the commit that raises it. The four hard-capped
  files (`App.tsx`, `presets.ts`, `GoblinEdge.tsx`, `exportSvg.ts`) may NEVER
  grow — not one line.
- **`App.tsx` is capped at its current size and must shrink each round that
  touches it.** The long-term target is decomposing it into domain hooks
  (`useBoards`, `useExport`, `useUndoHistory`, `useConnections`, …) — the plan:
  extract state clusters into custom hooks one phase per round (each hook file
  gets its own 400-line budget), then the big JSX panels into component files,
  keeping prop-threading explicit (no context/store). Execution is phased; ROUND
  BN extracted the module-level helpers (`boardConstants.ts`,
  `boardMigrations.ts`, `boardUtils.tsx`) and the full hook decomposition is a
  later phase.
- **A component becomes its own file when it is reused OR when its parent file
  exceeds budget** (Robin Wieruch's rule).
- **Don't split for taste.** Splitting must improve reuse, reading, or stay
  within budget — otherwise the file stays as it is.

One thing this repo does not do: it does not write outside its own tree.
