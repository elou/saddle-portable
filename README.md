# Saddle Portable

Saddle Portable gives anyone a local setup and customization layer for one operating profile across AI runtimes and computers. It stores authored rules, session-continuity procedures, capabilities, routing preferences, and selected context in a human-readable neutral bundle. Claude and Codex receive generated projections of that bundle.

Version `0.1.0` is a local, single-user release candidate. Do not run it against your real home directory until the first-transfer checklist passes on a clean test computer.

## Install

Install from a packed release:

```sh
npm install --global ./saddle-portable-0.1.0.tgz
```

After the first transfer is verified and `v0.1.0` is tagged, install it directly from GitHub with:

```sh
npm install --global github:elou/saddle-portable#v0.1.0
```

Until then, reviewers can install an exact reviewed commit by replacing `v0.1.0` with its full commit SHA. Saddle has no install, postinstall, or build script.

## Set up a profile

Run the local onboarding interface:

```sh
saddle setup
```

Saddle binds the setup service to loopback and opens a tokenized local URL. The flow inventories authored guidance and keeps personal or restricted items off by default. You review the neutral profile and every runtime file change before apply. The finish screen provides verification, doctor, and rollback controls.

Use the CLI when you need a headless flow:

```sh
saddle init ./my-profile
saddle import ./my-profile --target /absolute/test-home --json
saddle import ./my-profile --target /absolute/test-home --apply --accept-plan <digest>
saddle doctor --profile ./my-profile --target /absolute/test-home
```

`saddle import` is a dry run unless you pass both `--apply` and the current plan digest.

## Customize a profile

Onboarding is deliberately short. Customization is not limited to its starter questions.

```sh
saddle customize --profile /path/to/current-profile --out /path/to/new-profile
```

The local customizer creates a new derived profile and never edits the source in place. Keep or remove existing modules, then add any number of user-labeled personal context entries, operating rules, project standards, or prose-based universal capabilities. Each personal entry keeps its own consent boundary. Preview must pass before Saddle creates the new profile. A derived profile is committed only when its manifest is written last; after an interrupted customization, run `saddle recover-customization --out /path/to/new-profile` to safely remove only journal-matched incomplete files.

## What transfers

Saddle can transfer authored operating policies, session-start and context-reset procedures, project standards, model-neutral capabilities, cost-routing preferences, and user-defined personal context. Personalization is not limited to preset categories. Personal context and script-bearing capabilities require item-level consent during export and again wherever the profile is installed.

Saddle excludes transcripts, prompt and tool history, credentials, secret-bearing URLs, runtime settings, permission allowlists, trust grants, MCP connection details, plugin state, notifications, cron entries, and generated projections.

## Documentation

- [Onboarding](./docs/ONBOARDING.md)
- [Universal profile and capabilities](./docs/UNIVERSAL-PROFILE.md)
- [Privacy and local safety](./docs/PRIVACY.md)
- [Runtime support](./docs/RUNTIME-SUPPORT.md)
- [Install and update](./docs/INSTALL.md)
- [First transfer](./docs/FIRST-TRANSFER.md)
- [Ship readiness](./docs/SHIP-READINESS.md)
- [Architecture](./ARCHITECTURE.md)
