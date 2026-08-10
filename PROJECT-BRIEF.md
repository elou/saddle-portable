# Saddle Portable

## Product outcome

Saddle Portable lets one person set up or move a single operating profile for AI agents to another computer, preview exactly what will change, apply it locally, and verify that each selected runtime can use it.

The package is the user-facing setup surface. Terra is the conceptual profile and policy layer. Claude, Codex, and future agent runtimes are projections of the same neutral source rather than separate skill libraries.

## Customer and business model

The first customer is an individual who works across one or more local agent runtimes and wants their preferences, safety rules, working methods, and session-continuity behavior to travel with them.

Version 1 is free and self-serve. It installs directly from a Git repository or as an npm package. Authentication, cloud sync, organizational policy, team coordination, and paid administration are reserved for a later product.

## Version 1 promise

A new user can:

1. install `saddle` on a clean computer;
2. scan supported local runtimes without changing them;
3. create a neutral profile or import a previously exported one;
4. choose which safe modules to include;
5. preview every file operation and any conflict;
6. apply the profile transactionally to at least Claude and Codex;
7. verify the installed projections;
8. roll back the change; and
9. run `saddle doctor` later to understand drift or unsupported behavior.

The same engine will serve a local Saddle onboarding interface after the CLI vertical slice passes. The interface is not a separate source of truth.

## Included profile modules

- operating policies and safety rules;
- session-start, durable-note, pre-compaction, recovery, and session-end behavior;
- reusable capabilities and skills expressed in a model-neutral format;
- roles and cost-routing preferences;
- project working conventions;
- optional personal context selected with explicit consent; and
- integration declarations without credentials, tokens, URLs containing secrets, or trust grants.

## Hard boundaries

- This is a new repository. It must not edit, import, or depend on private implementation details from the existing Harness, Saddle, Terra, Claude, or Codex installations.
- The neutral profile is authoritative. Runtime-specific files are generated projections and must never become competing sources of truth.
- No raw transcripts, prompts, tool inputs or outputs, errors, environment values, credentials, permission allowlists, trust grants, or machine-specific absolute paths are exported by default.
- Import is proposal-first: scan and preview are read-only; apply requires an explicit action and must support rollback.
- Unsupported lifecycle behavior must be labeled as fallback or unsupported. The product must not claim control that a runtime does not expose.
- Version 1 is local-only and single-user. It does not include login, cloud storage, remote execution, runtime execution, billing, or team administration.
- The implementation should prefer Node.js standard-library APIs and a small dependency surface.

## Acceptance gates

- A clean install works from a packed tarball and a GitHub-compatible package reference.
- The same fixture profile validates and projects into two runtime adapters.
- Export fixtures prove that secrets, transcripts, and absolute home paths do not leak.
- Dry-run shows deterministic operations without changing the target filesystem.
- An injected mid-apply failure restores the original filesystem exactly.
- Doctor distinguishes native, instruction-fallback, and unsupported lifecycle support.
- A first-task fixture recovers the latest durable session note after transfer.
- Unit, integration, privacy, rollback, packed-install, and clean-profile tests pass.
- An independent reviewer finds no unresolved high-severity portability, privacy, or data-loss defect.

## Delivery mode

This is a large exploratory change. Work remains on a dedicated branch and will be offered as an unmerged draft pull request after the acceptance gates pass.

