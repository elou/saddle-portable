# Session: portable profile foundation

- Date: 2026-08-09
- Issue: [ELOU-1002](https://linear.app/elou/issue/ELOU-1002/build-standalone-saddle-portable-profile-package)
- Branch: `codex/elou-1002-universal-profile`

## Goal

Build and verify a standalone, runtime-agnostic Saddle setup package that manages one universal Terra operating profile, installs directly or through npm from GitHub, and remains separate from the existing Harness and Saddle implementations.

## Product decisions

- Saddle is the setup and transfer experience; Terra is the neutral operating profile.
- Claude, Codex, and later runtimes receive generated projections. There will not be separate Claude and Codex skill libraries.
- Version 1 is free, local, self-serve, and single-user. Login, cloud sync, and team coordination are out of scope.
- The first shippable wedge is CLI-first. A local onboarding interface will consume the same engine after the transfer path passes its safety gates.
- Import is preview-first, transactional, verifiable, and reversible.

## Reconnaissance evidence

- Existing Terra packages expose useful concepts but not a production portable-profile contract or installable root package.
- Existing runtime adapters are incomplete and mostly read-only; neither should be imported as a private dependency.
- Existing Saddle and Harness apps solve different jobs and are not safe implementation bases.
- Runtime lifecycle support differs. A neutral lifecycle contract must label each projection as native, instruction-driven fallback, or unsupported.
- Machine trust, secrets, transcripts, tool payloads, and absolute paths require exclusion or explicit re-consent.

## Model routing

- Sol High owns product boundaries, schemas, lifecycle semantics, privacy rules, integration review, and final acceptance.
- Terra Medium owns bounded modules after their contracts are frozen.
- Terra Low owns mechanical inspection and repeatable package/test audits.
- Every agent reports its actual model tier; routing mismatches are treated as delivery evidence, not hidden.

## Current checkpoint

Repository and Linear issue created. The architecture contract is frozen and the first implementation checkpoint is commit `70fa915`.

Implemented:

- strict neutral profile, lifecycle, routing, portability, and capability-asset validation;
- read-only Claude and Codex source inventory with section-level advisory classification;
- capture into one neutral profile with personal and restricted items off by default;
- Claude and Codex managed projections that preserve unrelated global instructions;
- plan-digest enforcement, preflight, transactional apply, verification, doctor, and rollback;
- token-protected loopback onboarding interface and headless CLI; and
- packed npm installation without install or build scripts.

Verification:

- `npm test`: 53 passed after correcting heading-classification precedence.
- `npm run pack:check`: 19-file package, 33.8 kB packed before public docs were added.
- Browser rehearsal: desktop and 390 px layouts without horizontal overflow; source inventory, profile creation, preview, apply, doctor, and rollback passed; no browser console warnings or errors.
- Actual delegated implementation tier: `gpt-5.6-terra medium` for profile, adapter, and source-inventory slices.

## Independent review and release candidate

The Sol High independent review reproduced release blockers that the initial byte-level suite missed. The implementation now:

- creates missing capability parent directories transactionally and removes nested managed directories cleanly on rollback;
- refuses rollback before any restore when an applied file or a Saddle-created directory contains new user content;
- removes stale managed assets only when their recorded digest still matches and rejects unsafe managed-manifest paths;
- rejects `.env` assets and structural MCP/runtime configuration without excluding negative policy prose;
- requires item-level destination consent for personal and restricted modules;
- shows each operation's modules, risk, and proposed content before apply;
- projects structured model-neutral routing;
- offers canonical `human.md` sections as personal context, while keeping session history outside the operating profile;
- replaces source-machine dev-server references with a self-contained 2 GB process-tree policy; and
- renders runtime skill frontmatter at byte zero and recognizes that generated provenance on later plans.

Verification:

- `npm test`: 75 passed.
- Packed-consumer install, executable, public API import, and profile creation passed.
- Browser rehearsal passed source inventory, personal/restricted destination consent, proposed-content inspection, apply, exact doctor results for Claude and Codex, and rollback. The local server ran beneath the 2 GB process-tree cap.
- Independent review found no unresolved code P0 or P1 after rerunning focused reproductions.
- Public CI is prepared for Node 20 and current Node 26 on macOS, plus Node 26 on Linux.

Remaining release gates are the GitHub owner/repository decision, first remote CI and direct-GitHub install, and the documented first transfer on a second computer before the `v0.1.0` tag.
