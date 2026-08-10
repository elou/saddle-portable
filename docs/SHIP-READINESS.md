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
| Destination-agnostic customizer creates a new profile from an exact preview without mutating its source | Customizer unit, CLI, server, privacy, browser, recovery, and independent adversarial review | Complete |
| Packed package installs and exposes `saddle` with scripts disabled | Packed-install suite | Complete |
| Commit-pinned Git dependency installs in a clean npm consumer | Exact GitHub install on the latest customization code checkpoint | Complete |
| Independent release review has no unresolved code P0 or P1 | Sol High review plus real-source semantic canaries | Complete |
| First real transfer to any clean test computer passes apply, first-task continuity, doctor, and rollback | Source capture and disposable-machine pass; [transfer checklist](./FIRST-TRANSFER.md) remains | In progress |

## P1 — required before public GitHub release

| Requirement | Status |
| --- | --- |
| Choose the GitHub owner, final repository name, and visibility | Approved: public `elou/saddle-portable` |
| Add the normalized `repository` field | Complete |
| Create a signed or annotated `v0.1.0` tag after the first-transfer gate | Pending |
| Run Node 20 and Node 26 CI on macOS, plus Node 26 on Linux | Complete on the current draft-PR branch; the PR records the latest run |
| Record package checksum and tarball file list in the release notes | Pending at tag creation; the archive checksum cannot be embedded in the archive itself without changing it |
| Confirm the unscoped npm name or select an owned scope before registry publication | `saddle-portable` returned `E404` on 2026-08-09. Ownership is not reserved. |

## P2 — after the first free release

- Add a binary-safe capability asset contract.
- Add adapters only when their instruction and lifecycle behavior can be tested without runtime-specific source copies.
- Add an update preview that compares neutral profile versions.
- Add credential-free integration declarations after a portable integration contract is specified and tested.
- Add optional crash-safe cleanup for expired transaction backups.
- Add optional automatic discovery and expiry guidance for incomplete customization reservations; explicit digest-safe recovery already ships.
- Add team coordination, shared policy, authentication, billing, and organization controls as a separate paid layer.

## Required documentation

The public package must ship with the README, onboarding, universal profile, privacy, runtime support, install, first-transfer, security, license, and changelog documents in this repository. The current package allowlist includes these files and the complete `docs/` directory.

## Local release evidence

- `npm test`: 107 passed.
- Packed consumer: installed with lifecycle scripts disabled, exposed the `saddle` executable, imported the public JavaScript API, and created a valid profile.
- Pinned Git consumer: installed `github:elou/saddle-portable#cedd67e`, exposed the executable and public API, and created a valid profile. Hosted CI repeated the exact-commit check on Node 20 and 26 for macOS and Node 26 for Linux.
- Real-source browser canary: runtime-only commands, undeclared executable workflows, duplicate capability sources, and provider-specific capability assets stayed out of the universal profile. One neutral `CAPABILITY.md` projected to both runtimes with valid frontmatter.
- Disposable destination: plan preview, apply, exact doctor for Claude and Codex, provider-asset absence, and rollback passed for transaction `4c1cff72-695b-476d-b1dd-896660630806`.
- Independent review: fresh capability install, capability update and stale-asset removal, unsafe manifest rejection, applied-but-unverified recovery, and rollback reproductions passed with no unresolved code P0 or P1.
- Customization browser acceptance: added separate personal and neutral capability entries, reviewed every proposed file and digest, preserved the source profile, created a valid derived profile, and enforced the personal module's consent on export.
- Customization adversarial review: symlinked output parents, destination races, foreign files, source drift, exact-byte retention, interrupted publication recovery, forged recovery paths, common credentials, runtime wrappers, integration authoring, and expressive personal model references were independently reproduced and gated. No P0 or P1 remains.
- Latest release-candidate checkpoint: commit `cedd67e` installed from GitHub into a clean consumer with its executable, public API, and profile creation intact; hosted CI passed on Node 20 and 26 for macOS and Node 26 for Linux in [run 31351818522](https://github.com/elou/saddle-portable/actions/runs/31351818522).

The remaining P0 is behavioral evidence on a clean physical computer: install, apply, first task, context-reset continuity, doctor, and rollback. Personal context remains optional during onboarding, while ongoing customization supports any number of independently consented personal modules.
