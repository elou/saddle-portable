# Onboarding

Saddle helps put the same instructions into Claude and Codex on a Mac. It does not install either application, copy an entire assistant folder, or transfer credentials, transcripts, trust grants, or permission state.

## Setup flow

1. Open `saddle setup`, then choose **Continue to choose assistants**. This only moves to the next step.
2. Choose the Mac account folder with **Choose folder**, or enter its absolute path. Select Claude, Codex, or both. Saddle only checks their folders at this point.
3. Choose where the instructions come from.
   - **Find instructions on this Mac** reads eligible instructions from the selected assistant folders. Name the new setup, choose a parent folder, then select what to bring. Saddle saves a separate setup folder before it reviews installation changes.
   - **Use a setup from another computer** chooses the Saddle setup folder copied to this Mac. Saddle reads it but does not create a new setup folder. It will show every file before installing anything.
4. Review the files Saddle will add, update, or remove. Personal or sensitive instructions need individual approval. The technical details disclosure contains the check code and other implementation evidence. Saddle rechecks the instructions and destination files before installing.
5. Choose **Install these instructions**. Saddle writes only the reviewed managed files and keeps recovery information under `.saddle/` in the selected Mac account folder. It then checks the installed files automatically.
6. The Done screen confirms that the instruction files are ready. It also makes clear that Saddle did not install or sign in to Claude or Codex. Use **Check installed files** to run the check again, or **Undo this setup** to restore the files from before setup while Saddle's installed files remain unchanged.

Folder choosing uses the Mac folder chooser when it is available. Entering a path remains available if it is not, or if the chooser is cancelled. Choosing a save location selects an existing parent folder; Saddle adds the generated setup id as the new folder name.

## What Saddle can find

Saddle splits global instruction files at level-two Markdown headings. The heading drives the first classification signal, and the section body provides a fallback signal. Every classification remains advisory.

Offer these items in this order:

1. Safety rules that prevent data loss or machine instability, including local server process-tree memory limits.
2. Session continuity: session start, durable checkpoints, notes, pre-context-reset capture, post-reset recovery, and session end.
3. Project operating rules, durable sources of truth, test requirements, and delivery conventions.
4. Model-neutral routing preferences, including minimum-cost routing and escalation conditions.
5. Reusable capabilities with their references and inert scripts.
6. Design and writing standards that should follow the user across projects.
7. Canonical `human.md` personal context as an optional starting point, only when the user selects each offered section.
8. Integration declarations without credentials or trust state.

The first six categories can improve the first task after installation. Personal context and integrations do not belong in the default selection. No capability is required for setup, and capabilities remain unchecked until the user chooses a workflow they use. These onboarding defaults do not limit later customization.

Saddle transfers continuity procedures, not session history. It does not inventory project session notes automatically. Copy or reconnect a project's durable dashboard and notes separately when that project must resume on another computer.

Saddle applies narrowly defined portable replacements when the intent is clear:

- dev-server references become a self-contained 2 GB process-tree policy with the Next.js Turbopack-root audit;
- memory roots and session commands become neutral start, checkpoint, pre-reset, post-reset, and session-end procedures;
- provider model names become low, balanced, and frontier capability tiers with explicit escalation conditions; and
- runtime commands for project kickoff, writing preflight, and durable session capture become self-contained procedures.

Other unresolved runtime-home references are excluded instead of producing broken destination instructions.

## What Saddle selects by default

Saddle preselects selectable standard instruction sections. It does not preselect personal context, restricted content, or any capability. Selectable capabilities are optional; when Claude and Codex both contain the same logical capability, the user can choose one source or leave it out. Capabilities containing provider names, runtime-specific tools, or runtime commands remain under **Needs attention** until they are rewritten as a neutral `CAPABILITY.md`. Excluded candidates remain visible with a reason when the inventory can safely describe them.

Selecting an item approves saving it into the separate setup folder only. It does not approve assistant permission changes or script execution.

Personal and restricted modules require a second item-level confirmation before destination apply. The confirmation applies only to the previewed plan and does not become runtime permission.

## Setups from another computer

Choose **Use a setup from another computer** when the folder already exists on this Mac. The folder must contain `saddle.profile.json`. Saddle validates its files and references before it prepares the installation review.

## Ongoing customization

Run the customizer when the starter profile no longer expresses enough of the person or their working method:

```sh
saddle customize --profile /path/to/current-profile --out /path/to/new-profile
```

Customization is separate from installation and does not require a runtime or target computer. Saddle reads the existing profile, then creates a new derived profile at an absent output path after a digest-bound preview. The source profile remains unchanged. Its manifest is the commit marker; if the process stops before that marker, run `saddle recover-customization --out /path/to/new-profile`. Recovery preserves unknown or changed files for manual review.

The v0.1 customizer supports unlimited user-labeled entries in four portable forms:

1. personal context;
2. operating rules;
3. project standards; and
4. prose-based universal capabilities.

Users may keep or remove existing modules, except modules referenced by required lifecycle procedures. Every personal entry becomes a separate module with its own explicit export and installation consent. Routing and portability policy carry forward from the source profile. Integration authoring remains unavailable until Saddle has a credential-free declaration contract.

## Conflicts

Saddle preserves content outside its managed block in `CLAUDE.md` and `AGENTS.md`. It stops when markers are malformed or duplicated.

Capabilities use namespaced runtime directories such as `skills/saddle-release-check/`. Saddle stops when an unmanaged file already occupies a planned managed target.
