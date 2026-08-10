# Universal profile

The neutral profile is the source of truth. Runtime instruction and skill files are generated outputs.

## Bundle layout

```text
my-profile/
  saddle.profile.json
  instructions/
  capabilities/
    release-check/
      CAPABILITY.md
      references/
      scripts/
  integrations/
```

The manifest uses schema version `1.0`. Unknown fields fail validation.

## Modules

Each module declares a stable id, kind, relative source, enabled state, sensitivity, consent mode, and SHA-256 digest. Supported kinds are:

- `operating-policy`
- `session-continuity`
- `project-standard`
- `capability`
- `personal-context`
- `integration-declaration`

Standard modules use implicit consent after the user selects them. Personal and restricted modules require explicit item-level consent during export and destination apply.

Personalization is not an enum of allowed life categories. A profile may contain any number of user-labeled `personal-context` modules. Each module has its own file, digest, and explicit consent boundary. Onboarding may suggest sections from `human.md`; customization may add broader categories without changing the schema.

## Lifecycle

Every profile maps these events to headings in an enabled session-continuity module:

- `session.start`
- `session.checkpoint`
- `context.before-reset`
- `context.after-reset`
- `session.end`

Adapters report each event as `native`, `fallback`, or `unsupported`. A fallback is an instruction that the runtime must follow. It is not an automatic hook.

## Routing

Routing stores capability requirements instead of provider model names. A route declares task kinds, a capability level, a reasoning level, and an escalation condition. Model names and prices stay in destination-local configuration.

## Capabilities

Write a universal capability in `CAPABILITY.md`. Describe its inputs, outputs, constraints, and verification without provider names, runtime-specific tools, or runtime commands. Version `0.1` marks a captured skill that contains those details as **Needs attention** instead of renaming it and claiming it is universal.

List every reference, script, or asset in the capability module. Each asset needs a relative path, kind, and SHA-256 digest. Scripts are text-only in version `0.1`, remain inert during every Saddle operation, and make the capability restricted.

Adapters can rename `CAPABILITY.md` to a runtime entrypoint such as `SKILL.md`. Do not maintain separate Claude and Codex source copies. If both source runtimes offer the same capability id, onboarding requires one source choice and profile creation rejects selecting both; Saddle does not attempt an unsafe semantic merge.

The customizer can also create prose-based capabilities directly in the neutral format. It does not author provider adapter assets or runtime-specific command wrappers.

## Derived profiles

Customization writes a new profile directory instead of mutating the current profile. It retains selected validated modules and assets, preserves lifecycle, routing, and portability contracts, increments the patch version, and adds user-authored modules only after a deterministic preview digest is accepted. The writer reserves an absent output, never overwrites a destination entry, and publishes the manifest last so an interrupted partial directory is not loadable as a profile.

## Portability

Portable paths use `${home}`, `${workspace}`, or `${profile}`. Saddle rejects unresolved, ambiguous, escaping, and symlink-traversing paths.

See [schemas/profile-manifest.schema.json](../schemas/profile-manifest.schema.json) for the interchange schema and [ARCHITECTURE.md](../ARCHITECTURE.md) for the implementation contract.
