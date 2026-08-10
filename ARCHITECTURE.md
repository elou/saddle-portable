# Architecture contract

Status: frozen for the first CLI vertical slice. Changes require an architecture note and updated fixtures.

## 1. System boundary

Saddle Portable has four layers:

```text
portable bundle -> domain engine -> runtime adapter -> local projection
                         |                 |
                         +-> transaction <-+
                         +-> verification
```

- The portable bundle is human-readable, versioned, and runtime-neutral.
- The domain engine validates, inventories, redacts, and creates deterministic plans.
- A runtime adapter detects one runtime and converts neutral modules into generated artifacts.
- The transaction layer applies an accepted plan atomically enough to restore every pre-existing path after any failure.

The CLI and future local interface call the same domain APIs. Neither may contain projection or write logic.

## 2. Portable bundle

A profile is a directory, not an opaque database:

```text
my-profile/
  saddle.profile.json
  instructions/
    operating.md
    session-continuity.md
    project-standards.md
    personal-context.md       # optional, consent required
  capabilities/
    <capability-id>/
      CAPABILITY.md
      references/             # optional
      scripts/                # optional, inert until separately trusted
  integrations/
    <integration-id>.json     # declarations only; never credentials
```

`saddle.profile.json` contains metadata and module descriptors. Content remains in ordinary Markdown and JSON so a person can inspect and version it without Saddle.

### Required manifest fields

```json
{
  "schemaVersion": "1.0",
  "profile": {
    "id": "lowercase-stable-id",
    "name": "Display name",
    "version": "1.0.0",
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  },
  "modules": [],
  "lifecycle": {
    "session.start": { "module": "session-continuity", "procedure": "session-start" },
    "session.checkpoint": { "module": "session-continuity", "procedure": "session-checkpoint" },
    "context.before-reset": { "module": "session-continuity", "procedure": "before-context-reset" },
    "context.after-reset": { "module": "session-continuity", "procedure": "after-context-reset" },
    "session.end": { "module": "session-continuity", "procedure": "session-end" }
  },
  "routing": {
    "strategy": "minimum-cost-that-clears-gate",
    "routes": []
  },
  "portability": {
    "personalContext": "prompt",
    "integrations": "declarations-only",
    "scripts": "copy-inert",
    "absolutePaths": "alias-only"
  }
}
```

Unknown fields are rejected in version 1. This keeps typos from silently changing policy.

The five continuity events shown above are required. Each points to an enabled
`session-continuity` module and a lowercase Markdown heading anchor. Optional tool
and subagent events may use the same `{ module, procedure }` shape.

Routing is a preference contract rather than a model catalog. Each optional route
has an id, one or more task kinds, a required capability level (`low`, `medium`,
`high`, or `frontier`), a reasoning level (`low`, `medium`, or `high`), and a plain-
language escalation condition. Runtime-specific model names and prices remain local.

Portability choices are explicit and strict. Personal context is `exclude` or
`prompt` in portable bundles; integrations are `exclude` or `declarations-only`;
scripts are `exclude` or `copy-inert`; and absolute paths are always `alias-only`.

### Module contract

Every module descriptor has:

- `id`: stable lowercase identifier;
- `kind`: `operating-policy`, `session-continuity`, `project-standard`, `capability`, `personal-context`, or `integration-declaration`;
- `source`: a normalized path relative to the profile root;
- `enabled`: whether the module participates in projection;
- `sensitivity`: `standard`, `personal`, or `restricted`;
- `consent`: `implicit` for standard modules or `explicit` for personal and restricted modules; and
- `digest`: SHA-256 of the source content for provenance and drift detection.

A capability may also declare an `assets` array. Each asset has a relative `path`,
SHA-256 `digest`, and `kind` of `reference`, `script`, or `asset`. Asset paths must
remain beneath the capability directory. A capability containing a script must be
classified `restricted` and requires explicit consent. Scripts remain inert during
scan, export, import, projection, and verification.

Scripts and references nested under a capability are content, not authority. Import never executes a script. An adapter may copy a consented script as inert content, must label it `restricted` in the preview, and never converts bundle consent into execution permission on the destination computer.

## 3. Universal capabilities

The canonical unit is a capability, not a Claude skill or Codex skill. Its neutral entrypoint is `CAPABILITY.md`; a runtime adapter may render a runtime-required filename such as `SKILL.md` without changing the source.

`CAPABILITY.md` starts with neutral frontmatter containing a stable name and description. The profile manifest declares its stable id, entrypoint, sensitivity, consent mode, optional references and scripts, and content digests. Runtime adapters render the small amount of frontmatter required by each destination while keeping provenance below the frontmatter boundary.

Required runtime features and requested local permissions remain declarations in capability prose. They never grant authority on the destination computer.

Capability prose must describe inputs, outputs, constraints, and verification without naming a model unless the capability genuinely depends on one. Adapter-specific instructions live in adapters, not capabilities.

## 4. Lifecycle contract

The neutral profile defines procedures for these events:

| Event | Required outcome |
| --- | --- |
| `session.start` | Read the current project dashboard and the most recent durable notes before acting. |
| `session.checkpoint` | Append decisions, evidence, current state, and next action to the active session note after material change. |
| `context.before-reset` | Save chat-only artifacts, finalize the current checkpoint, and write a resume pointer before clear, compact, branch, or handoff. |
| `context.after-reset` | Reload the dashboard, curated context, and latest session note; continue without redoing completed work. |
| `session.end` | Verify the work, make durable records internally consistent, and leave one concrete next action. |
| `tool.before` | Apply declared safety and permission policy before a tool call. |
| `tool.after` | Capture material state changes and verification evidence. |
| `tool.error` | Record the failure, product impact, and fallback without losing the active state. |
| `subagent.start` | Give the worker the goal, frozen contract, file ownership, constraints, and acceptance checks. |
| `subagent.end` | Receive actual model, changes, checks, residuals, and next action. |

Each adapter publishes one support level per event:

- `native`: the runtime exposes a stable lifecycle mechanism and Saddle installs a projection for it;
- `fallback`: Saddle projects durable instructions, but the runtime is responsible for following them; or
- `unsupported`: neither a stable mechanism nor a credible instruction fallback exists.

The plan and doctor output must show these labels. A fallback must never be presented as an installed automatic hook.

## 5. Portability and redaction

An exported profile may contain durable authored guidance. It must not contain observed conversation or machine authority.

### Always excluded

- transcripts, prompt history, tool inputs, tool outputs, tool errors, and telemetry;
- environment names and values;
- tokens, credentials, private keys, cookies, and secret-bearing URLs;
- runtime settings values, permission allowlists, trust grants, MCP connection details, plugin state, notifications, and cron entries;
- raw personal data discovered outside a selected personal-context module; and
- generated runtime projections.

### Paths

Approved roots are represented with `${home}`, `${workspace}`, and `${profile}`. Export fails when a referenced path:

- is absolute and cannot be replaced by exactly one approved alias;
- contains an unresolved variable;
- normalizes outside its declared root;
- traverses through a symlink outside its declared root; or
- is ambiguous across more than one root.

### Consent

Standard modules are selected by the user during inventory. Personal and restricted modules default off and require item-level explicit consent on every export and destination apply. Consent is recorded as bundle metadata, not as permanent permission on the destination machine.

## 6. Adapter interface

An adapter is a data-and-functions module with no direct writes:

```js
{
  id,
  displayName,
  detect(context),
  capabilities(),
  plan(profile, context),
  verify(profile, context)
}
```

- `detect` returns evidence and version without mutation.
- `capabilities` returns the lifecycle support matrix and projection limits.
- `plan` returns ordered filesystem operations plus human-readable reasons, risks, provenance, and expected digests.
- `verify` reads the destination and reports exact, drifted, missing, or unverifiable artifacts.

Adapters do not call the transaction layer. The engine validates their operations before apply.

Initial adapters:

- Claude: generated global instructions and capability projections under a caller-supplied test root; lifecycle support reported conservatively.
- Codex: generated global instructions and capability projections under a caller-supplied test root; runtime configuration is not edited in version 1.

Real home-directory targets are never assumed in tests or domain APIs.

## 7. Plan and transaction

The plan is an immutable JSON-serializable value. Each operation includes:

- stable operation id;
- action: `create-directory`, `create-file`, `replace-file`, or `remove-managed-file`;
- target expressed beneath a validated target root;
- expected prior digest or `absent`;
- resulting digest;
- source module and adapter;
- plain-language reason; and
- risk level.

Apply requires the digest of the previewed plan. If the target changed after preview, apply stops and requests a new preview.

Before the first target mutation, Saddle writes a transaction journal and backups beneath a caller-supplied Saddle state root. Writes use a sibling temporary file followed by rename. On any failure, completed operations are reversed in order and the restored state is verified. Explicit rollback remains available while backups exist and every applied target still matches the transaction; target drift stops rollback before restoration.

Saddle only removes a file when its current digest matches a prior Saddle-managed record. It never deletes an unrecognized file.

### Customization publication

Customization validates a complete private staging profile before it reserves the absent output directory. Publication uses exclusive, no-overwrite file creation and writes `saddle.profile.json` last as the validity marker. A failed publish removes only Saddle-created files whose digests are unchanged and only empty directories; foreign or modified content is preserved with the reservation marker for diagnosis.

This is a manifest-committed protocol, not a claim that an entire directory tree appears in one filesystem operation. A process interruption during publication can leave an incomplete reserved directory without a manifest. The directory is not a loadable profile and blocks retry at the same path until it is inspected and removed.

## 8. CLI contract

Version 1 commands:

```text
saddle init [directory]
saddle scan [--target <root>] [--json]
saddle export --profile <directory> --out <directory>
saddle import <bundle> --target <root> [--runtime claude,codex] [--apply] [--json]
saddle doctor --profile <directory> --target <root> [--json]
saddle rollback <transaction-id> --state <directory>
saddle customize --profile <directory> --out <new-directory>
```

`import` is dry-run by default. `--apply` must display or accept the exact plan digest. Non-interactive JSON mode must never infer consent for personal, restricted, conflicting, or executable content.

Exit codes:

- `0`: requested operation completed and verified;
- `1`: validation, conflict, drift, verification, or usage failure; and
- `2`: apply failed but rollback completed;
- `3`: apply failed and rollback could not fully restore state.

## 9. Local onboarding interface

The local interface is a thin client over the engine and follows the sequence in `DESIGN-SYSTEM.md`. It may be delivered after the CLI vertical slice, but package architecture must leave a `saddle setup` entrypoint available.

The interface binds only to loopback, never opens a remote listener, stores no analytics by default, and performs no file write outside an accepted transaction.

## 10. Package contract

- Node.js 20+ ESM package with a `saddle` executable.
- Installable from a local tarball, a GitHub package reference, and eventually the npm registry.
- No install or postinstall scripts.
- No dependency on the user's existing private harness, Saddle, Claude, or Codex installation.
- Package contents are restricted by the `files` allowlist and inspected in tests.
- The repository remains unmerged until clean-profile, privacy, rollback, and packed-install gates pass.
