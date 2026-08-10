# 2026-08-10 — Onboarding rewrite

## Goal

Make Saddle's first transfer understandable to someone setting up a blank Mac, separate shared voice rules from Saddle-specific language, and give Emily a simple way to annotate the UX script.

## Decisions

- The setup interface says what the person is doing before it exposes product internals.
- A blank Mac automatically selects **Use a setup from another computer** after Saddle finds no Claude or Codex folders.
- Native folder choosing is the default; typed paths remain as a fallback.
- Internal ids, hashes, module names, and adapter reasons stay under **Technical details**.
- Completion confirms that instruction files are ready. It does not claim Claude or Codex were installed or signed in.
- Shared voice rules belong in the global harness and design system. Saddle nouns and transfer behavior remain project-specific.

## Evidence

- `node --test test/integration/ui-server.test.js`: 8/8 passed.
- `npm test`: 108/108 passed.
- `npm run pack:check`: 32 files; package dry-run passed.
- `git diff --check`: passed.
- Browser: blank target → transferred setup → review → install → verify → undo passed at desktop and 390×844 widths; no browser warnings or errors.

## Current state

- The redrafted script is open in Roughdraft for Emily's edits.
- Harness changes are recommendations only. No global instruction file has been changed.
- Work is on `codex/elou-1002-universal-profile` in the canonical checkout at `/Users/emily/Developer/saddle-portable`.

## Files changed

- Setup interface: `src/ui/assets/index.html`, `src/ui/assets/app.js`, `src/ui/assets/styles.css`, `src/ui/server.js`
- Tests and docs: `test/integration/ui-server.test.js`, `docs/ONBOARDING.md`
- Product review: `notes/product/2026-08-10-setup-ux-script.md`, `notes/product/2026-08-10-setup-ux-script-fresh.md`, `notes/product/2026-08-10-voice-manifest-test.md`, `notes/product/2026-08-10-voice-manifest-scope.md`
- Learning and recovery: `notes/learning/2026-08-10-onboarding-language-gate.md`, `notes/learning/2026-08-10-subagent-routing-receipts.md`, `AGENT-TASKS.md`, this session note

## Incomplete

- Emily has not finished annotating the redrafted script.
- The physical Mac Mini transfer remains the release gate.
- The proposed global harness and design-system edits have not been applied because they require Emily's approval.

## Potential skills

- None. The reusable rules fit the existing global conversation, design-system, and delivery guidance.

## Next

Run the transfer on the physical Mac Mini, then reconcile any copy or flow changes from Emily's annotations before landing the release candidate.
