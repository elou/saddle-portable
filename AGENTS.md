# Saddle Portable Team Rules

## Product boundary

Build a local-first, single-user setup and transfer package for one runtime-neutral operating profile. The CLI and future local interface must use the same domain engine.

Do not edit or import private code from `/Users/emily/Developer/terra`, `/Users/emily/Developer/saddle`, or any installed Claude or Codex configuration. Concepts may be reimplemented only through contracts documented in this repository.

## Source of truth

- Neutral profile files are authoritative.
- Runtime adapters produce projections; generated files are never edited back into the source profile automatically.
- Every generated artifact records its source profile version and content digest.
- Runtime capability claims must be `native`, `fallback`, or `unsupported` and backed by a test fixture.

## Safety and privacy

- Scans and previews are read-only.
- Applies are transactional and produce a rollback record before the first write.
- Never export transcripts, prompts, tool payloads, errors, environment values, credentials, secret-bearing URLs, permission allowlists, trust grants, or raw runtime settings.
- Replace approved filesystem roots with portable aliases. Reject unresolved, ambiguous, escaping, or symlink-traversing paths.
- Personal context and integrations are opt-in modules with item-level preview.

## Development rules

- Use Node.js 20 or newer and prefer the standard library.
- Use `apply_patch` for hand-authored file changes.
- Write a failing regression test before fixing a reported bug.
- Do not start a development server without the workspace-standard 2 GB process-tree RSS cap. The CLI does not require a server.
- Keep `AGENT-TASKS.md` and ELOU-1002 synchronized after material state changes.
- Do not revert another agent's work. Each worker owns only the files named in its assignment and must adapt to concurrent changes.

## Model routing

- Sol High: cross-cutting architecture, privacy and lifecycle semantics, ambiguous product decisions, final integration and acceptance.
- Terra Medium: bounded implementation with frozen inputs and acceptance tests.
- Terra Low: inventory, file operations, deterministic fixture generation, and mechanical test/package verification.
- Escalate only with the failed gate, evidence, and the specific decision needed.

## Completion report

Every bounded work slice ends with:

```text
Issue name: <title>
Issue: ELOU-1002
Model: <actual model tier>
Commit: <short hash or not committed>
Checks: <commands and results>
Residuals: <accepted limits, omit when none>
Next: <one action or none — issue complete>
```

