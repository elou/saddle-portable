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

Repository and Linear issue created. Next: write the architecture contract, then delegate isolated implementation slices with explicit file ownership.

