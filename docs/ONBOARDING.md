# Onboarding

Saddle setup turns authored material from supported runtimes into one neutral profile. It does not copy a runtime directory.

## Setup flow

1. Run `saddle setup`.
2. Enter the absolute home-directory path to inspect.
3. Select Claude, Codex, or both.
4. Inventory the authored guidance on that computer.
5. Review the suggested type and sensitivity for each item.
6. Select the items to include and choose a new profile directory.
7. Review each target, module, risk label, and proposed content block.
8. Confirm each personal or restricted module on the destination computer.
9. Apply the accepted plan, then run doctor or rollback from the finish screen.

Inventory is read-only. Creating a profile writes a new neutral bundle to the directory you choose. Apply writes runtime projections and creates a transaction journal beneath the selected home directory at `.saddle/`.

## What Saddle offers

Saddle splits global instruction files at level-two Markdown headings. The heading drives the first classification signal, and the section body provides a fallback signal. Every classification remains advisory.

Offer these items in this order:

1. Safety rules that prevent data loss or machine instability, including local server process-tree memory limits.
2. Session continuity: session start, durable checkpoints, notes, pre-context-reset capture, post-reset recovery, and session end.
3. Project operating rules, durable sources of truth, test requirements, and delivery conventions.
4. Model-neutral routing preferences, including minimum-cost routing and escalation conditions.
5. Reusable capabilities with their references and inert scripts.
6. Design and writing standards that should follow the user across projects.
7. Canonical `human.md` personal context only when the user selects each offered section.
8. Integration declarations without credentials or trust state.

The first six categories can improve the first task on the destination computer. Personal context and integrations do not belong in the default selection. No capability is required for setup, and capabilities remain unchecked until the user chooses a workflow they use.

Saddle transfers continuity procedures, not session history. It does not inventory project session notes automatically. Copy or reconnect a project's durable dashboard and notes separately when that project must resume on the destination computer.

Saddle applies narrowly defined portable replacements when the intent is clear:

- dev-server references become a self-contained 2 GB process-tree policy with the Next.js Turbopack-root audit;
- memory roots and session commands become neutral start, checkpoint, pre-reset, post-reset, and session-end procedures;
- provider model names become low, balanced, and frontier capability tiers with explicit escalation conditions; and
- runtime commands for project kickoff, writing preflight, and durable session capture become self-contained procedures.

Other unresolved runtime-home references are excluded instead of producing broken destination instructions.

## Default selection

Saddle preselects selectable standard instruction sections. It does not preselect personal context, restricted content, or any capability. Selectable capabilities are optional; when Claude and Codex both contain the same logical capability, the user can choose one source or leave it out. Capabilities containing provider names, runtime-specific tools, or runtime commands remain under **Needs attention** until they are rewritten as a neutral `CAPABILITY.md`. Excluded candidates remain visible with a reason when the inventory can safely describe them.

Selecting an item approves profile creation only. It does not approve runtime permission changes or script execution.

Personal and restricted modules require a second item-level confirmation before destination apply. The confirmation applies only to the previewed plan and does not become runtime permission.

## Existing profiles

Select **Use an existing profile** when a portable bundle already exists on the destination computer. Saddle validates the manifest, content digests, paths, lifecycle references, routing preferences, and portability policy before it creates a plan.

## Conflicts

Saddle preserves content outside its managed block in `CLAUDE.md` and `AGENTS.md`. It stops when markers are malformed or duplicated.

Capabilities use namespaced runtime directories such as `skills/saddle-release-check/`. Saddle stops when an unmanaged file already occupies a planned managed target.
