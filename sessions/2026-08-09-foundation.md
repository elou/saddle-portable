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

## Direct Git installation gate

Commit `a979407` adds a repeatable clean-consumer verifier to local development and hosted CI. A pinned `git+file` install of that commit exposed the `saddle` executable and public JavaScript API and created a valid neutral profile. This closes the locally testable Git transport risk; the same verifier still needs to pass against the hosted GitHub commit after repository creation.

Files changed for this gate: `.github/workflows/ci.yml`, `package.json`, `scripts/verify-github-install.mjs`, `docs/INSTALL.md`, `docs/SHIP-READINESS.md`, `AGENT-TASKS.md`, and this session record. The package source remains isolated from the existing Harness and Saddle repositories.

Final local pass at `36d2837`: pinned Git install passed, 75 tests passed, the 29-file package dry-run passed, `git diff --check` passed, and the worktree was clean. No remote, pull request, release tag, or npm publication exists. Exact resume: obtain approval for the recommended public `elou/saddle-portable` repository, add its normalized package metadata, push this branch, open an unmerged draft pull request, and run hosted CI before the second-computer checklist.

## Public candidate and real-source transfer rehearsal

The public repository and unmerged draft PR now exist at `elou/saddle-portable`. Hosted CI passes on Node 20 and Node 26 for macOS and Node 26 for Linux, including an install from the exact GitHub commit.

The first real-source onboarding rehearsal found defects that synthetic tests had missed. Test-first fixes now:

- replace source runtime memory, server-safety, project-start, voice-preflight, durable-session, and provider-model instructions with neutral procedures;
- exclude slash and dollar invocation aliases from universal capabilities and foundation guidance;
- move instruction sections that depend on undeclared executables into Needs attention;
- parse folded and quoted capability descriptions without malformed or double-escaped YAML;
- prevent duplicate runtime copies from becoming separate canonical capabilities; and
- exclude provider-specific adapter assets while retaining neutral capability references.

At `71908d7`, the final nonpersonal canary selected the foundation plus `model-fit-rubric-gate`. The canonical bundle contained no source home path, runtime/provider name, runtime reset command, Roughdraft invocation, or provider adapter asset. A disposable destination previewed and applied the profile to Claude and Codex, doctor reported every artifact exact, and transaction `4c1cff72-695b-476d-b1dd-896660630806` rolled back completely.

Final local verification: 88 tests passed; the 29-file package dry-run was 53.5 kB packed and 209.9 kB unpacked with SHA-1 `83cda56c2a39d1295521da1c4fcc351164c8396a`; exact GitHub install from `71908d7` exposed the executable and public API and created a profile. Hosted run `31348641637` passed.

At that checkpoint, the remaining gate was framed as a transfer to a named computer with a nonpersonal archive prepared in advance. That framing is superseded below; the archive is test evidence, not a product or onboarding constraint.

## Product correction — distribution and customization

The preceding machine-specific gate is superseded. Saddle is a public GitHub/npm package that anyone may install; no named computer is part of the product contract. The first-transfer gate may run on any clean physical test computer.

Onboarding remains deliberately short and privacy-safe, with personal context off by default. Ongoing customization is not limited to a starter preference set: the new customizer derives an immutable profile from an existing profile, retains or removes eligible modules, and accepts any number of user-labeled personal-context, operating-policy, project-standard, and prose capability entries. Personal and restricted modules retain individual consent. Privacy controls disclosure; it does not limit expressiveness.

## Broad customization implementation and release gate

The public UI and CLI now provide `saddle customize --profile <source> --out <derived>` without a runtime or machine target. The source remains unchanged. Users can retain eligible modules and add any number of user-labeled personal context, operating rules, project standards, and prose `CAPABILITY.md` entries. Every proposed file, risk, digest, and exact content body appears in the digest-bound review. Personal entries remain separate explicit-consent modules on export and install.

Publication validates private staging, exclusively reserves an absent output, never overwrites a destination entry, and writes the manifest last. `saddle recover-customization --out <directory>` uses the durable reservation journal to remove only planned, digest-matching, contained, nonsymlink files and empty directories; foreign, changed, corrupt, or unrecognized content is preserved. The protocol is manifest-committed and recoverable, not described as whole-directory crash atomicity.

The shared content policy rejects high-signal credentials, machine-specific paths, runtime command wrappers, and integration setup. Policy is tier-aware: universal operating/project/capability authoring remains strict and provider-neutral, while descriptive personal context may mention providers or models and keeps its explicit-consent boundary.

Final local evidence before commit: `npm test` passed 107 tests; the npm dry run contained 32 files; `git diff --check` passed. Capped desktop browser acceptance created `final-browser-custom@1.0.1` from an unchanged `final-browser@1.0.0`, displayed exact `CAPABILITY.md` and personal content, rejected export without `feedback-preferences` consent, and passed export with that consent. Two independent Sol High review passes ended with no unresolved P0 or P1. Remaining release gate: push the reviewed commit, rerun exact GitHub install and hosted CI, then perform the documented first-transfer checklist on any clean physical computer. Do not merge, tag, or publish npm before that gate.

Customization code checkpoint `ecc069d` was pushed to the existing draft PR. Exact GitHub installation from that commit passed with the executable, public API, and profile creation intact. Hosted run `31351757958` passed Node 20 and 26 on macOS and Node 26 on Linux. GitHub push protection correctly blocked the first commit because token-shaped security fixtures were literal; the fixtures were changed to runtime composition, the unpushed commit was amended, and the branch pushed without bypassing protection. The only remaining release gate is the documented first transfer on a clean physical computer; the PR remains draft and unmerged, with no tag or npm publication.
