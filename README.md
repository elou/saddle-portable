# Saddle Portable

Saddle Portable is a local-first setup and transfer tool for one runtime-agnostic AI operating profile. It keeps operating rules, session continuity, capabilities, and selected context in a human-readable neutral bundle, then projects that bundle into supported agent runtimes.

This repository is in active development. Do not use it against a real home directory yet.

## Intended installation

When the release gates pass, the package will support installation from a GitHub repository or npm package and expose the `saddle` command. Version 1 is free, local, self-serve, and single-user.

## Safety model

- scan and preview before write;
- explicit consent for personal or restricted modules;
- no secrets, transcripts, trust grants, or machine permission state in exports;
- transactional apply with rollback;
- conservative runtime capability labels; and
- no dependency on an existing Harness, Saddle, Terra, Claude, or Codex codebase.

See [PROJECT-BRIEF.md](./PROJECT-BRIEF.md) for the product contract and [ARCHITECTURE.md](./ARCHITECTURE.md) for the frozen first-slice design.

