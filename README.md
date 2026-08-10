# Saddle Portable

Saddle Portable moves one operating profile across AI runtimes and computers. It stores authored rules, session-continuity procedures, capabilities, routing preferences, and selected context in a human-readable neutral bundle. Claude and Codex receive generated projections of that bundle.

Version `0.1.0` is a local, single-user release candidate. Do not run it against your real home directory until the first-transfer checklist passes on the destination computer.

## Install

Install from a packed release:

```sh
npm install --global ./saddle-portable-0.1.0.tgz
```

After the GitHub repository is created, install a tagged version with:

```sh
npm install --global github:<owner>/saddle-portable#v0.1.0
```

The GitHub owner and public repository URL are release-time values. Saddle has no install, postinstall, or build script.

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

## What transfers

Saddle can transfer authored operating policies, session-start and context-reset procedures, project standards, model-neutral capabilities, cost-routing preferences, and selected personal context. Personal context and script-bearing capabilities require item-level consent during export and again on the destination computer.

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
