# Ship readiness

This file is the prioritized release ledger for the free self-serve package.

## P0 — block release

| Requirement | Evidence | Status |
| --- | --- | --- |
| Standalone repository with no private Harness or Saddle imports | Package dependency graph and source inspection | Complete |
| Strict neutral profile, lifecycle, routing, portability, and capability-asset contracts | Schema, validator, and unit tests | Complete |
| Safe source inventory with section-level suggestions | Capture inventory and browser rehearsal | Complete |
| Secret, transcript, settings, trust, and machine-path exclusions | Privacy suite | Complete |
| Managed runtime projections preserve unrelated global instructions | Adapter regression suite | Complete |
| Plan digest, target preflight, failure rollback, and explicit rollback | Transaction and CLI integration suites | Complete |
| Loopback onboarding UI with per-process request token | Server integration suite | Complete |
| Packed package installs and exposes `saddle` with scripts disabled | Packed-install suite | Complete |
| Commit-pinned Git dependency installs in a clean npm consumer | Local `git+file` release gate at `a979407` | Complete |
| Independent release review has no unresolved code P0 or P1 | Sol High review; 75-test rerun and focused manual reproductions | Complete |
| First real transfer to a second computer passes apply, first-task continuity, doctor, and rollback | [First transfer](./FIRST-TRANSFER.md) | Not started |

## P1 — required before public GitHub release

| Requirement | Status |
| --- | --- |
| Choose the GitHub owner, final repository name, and visibility | Approved: public `elou/saddle-portable` |
| Add the normalized `repository` field | Complete |
| Create a signed or annotated `v0.1.0` tag after the first-transfer gate | Pending |
| Run Node 20 and Node 26 CI on macOS, plus Node 26 on Linux | Workflow and direct-GitHub-install gate ready; first remote run pending |
| Record package checksum and tarball file list in the release notes | Pending |
| Confirm the unscoped npm name or select an owned scope before registry publication | `saddle-portable` returned `E404` on 2026-08-09. Ownership is not reserved. |

## P2 — after the first free release

- Add a binary-safe capability asset contract.
- Add adapters only when their instruction and lifecycle behavior can be tested without runtime-specific source copies.
- Add an update preview that compares neutral profile versions.
- Add optional crash-safe cleanup for expired transaction backups.
- Add team coordination, shared policy, authentication, billing, and organization controls as a separate paid layer.

## Required documentation

The public package must ship with the README, onboarding, universal profile, privacy, runtime support, install, first-transfer, security, license, and changelog documents in this repository. The current package allowlist includes these files and the complete `docs/` directory.

## Local release evidence

- `npm test`: 75 passed.
- Packed consumer: installed with lifecycle scripts disabled, exposed the `saddle` executable, imported the public JavaScript API, and created a valid profile.
- Pinned Git consumer: installed commit `a979407` through `git+file`, exposed the executable and public API, and created a valid profile. Hosted CI repeats this check against the exact GitHub commit.
- Browser rehearsal: personal and restricted items required two unchecked destination confirmations; proposed content and runtime-valid capability frontmatter were visible; Claude and Codex doctor results were exact; rollback verified.
- Independent review: fresh capability install, capability update and stale-asset removal, unsafe manifest rejection, applied-but-unverified recovery, and rollback reproductions passed with no unresolved code P0 or P1.
