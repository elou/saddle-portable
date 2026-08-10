# Saddle setup: current-state UX script

Status: review draft. This describes the product exactly as it behaves today. It is not proposed replacement copy.

Purpose: make every screen, control, decision, default, read, and write visible before the onboarding experience is rebuilt.

How to edit this document:

- Rewrite text under **Replacement copy**.
- Comment on flow, controls, defaults, or missing information under **UX decisions to revisit**.
- Treat text under **Current copy** as evidence of the current product, not approved language.

## The product concept the current UI is trying to express

Saddle has two separate jobs:

1. **Set up this computer.** Read selected working instructions from an existing Claude or Codex installation, or open a previously saved Saddle folder, then preview and install generated files for Claude, Codex, or both.
2. **Customize saved instructions.** Start with an existing Saddle folder, keep or remove its contents, add new material, and save a separate revised folder.

The code calls the saved folder a **profile** or **neutral profile**. It is a normal directory containing:

- one manifest named `saddle.profile.json`;
- instruction Markdown files;
- optional capability folders whose canonical instruction file is `CAPABILITY.md`.

“Neutral” means the saved material is not written exclusively for Claude or exclusively for Codex. Saddle generates the runtime-specific files later. The current UI never explains this definition before using the term.

The setup UI runs locally in the browser. It communicates with a loopback-only local server and does not send the selected files to a remote service.

## Setup flow at a glance

| State | What the user is actually doing | Does it read files? | Does it write files? |
| --- | --- | --- | --- |
| 1. Welcome | Entering setup | No | No |
| 2. Runtimes | Choosing a computer home folder and which installed agents to inspect/configure | Yes, after **Scan** | No |
| 3A. Build from this computer | Choosing which existing instructions should become a reusable Saddle folder | Yes, after **Inventory authored guidance** | **Yes, when “Create profile and preview” is clicked** |
| 3B. Use an existing profile | Pointing Saddle to a previously saved Saddle folder | Not until preview | No |
| 4. Preview | Reviewing the files Saddle proposes to create or update for Claude/Codex | Yes | No until **Apply this preview** |
| 5. Finish | Checking the installed files or undoing the installation | Doctor reads; rollback reads | Rollback writes |

Important current contradiction: the welcome screen promises “Before any write, you will see the exact files and conflicts.” In the **Build from this computer** path, Saddle writes the reusable profile folder before showing the runtime installation preview.

## Persistent page chrome

### Current copy

- Product name: **Saddle**
- Status: **Local session**
- Skip link: **Skip to setup**
- Setup progress labels: **Welcome → Runtimes → Profile → Preview → Finish**

### Current behavior

- The status means the browser is connected to a local server. It does not explain whether data leaves the computer.
- The progress labels are not clickable.
- The active step is marked visually and for assistive technology.

### Replacement copy

- Product name:
- Local/privacy status:
- Progress labels:

### UX decisions to revisit

- Is “Runtimes” meaningful to someone who knows only that they use Claude or Codex?
- Is “Profile” the right label before the object has been explained?
- Should the persistent header explicitly say that the session is local and nothing is uploaded?

---

# Setup state 1: Welcome

## What is meant to happen

The user should understand the outcome of setup, the safety boundary, and that nothing changes yet. The only decision is whether to begin.

## Current copy

**Heading**

> Bring your working methods with you.

**Introduction**

> Saddle sets up one neutral operating profile, then generates the files Claude and Codex understand. Everything stays on this computer.

**Promise list**

> **Before any write**  
> You will see the exact files and conflicts.

> **Never transferred**  
> Credentials, transcripts, trust grants, and runtime permission state.

> **After setup**  
> Doctor verifies managed files. Rollback restores them only while applied targets remain unchanged.

**Primary button**

> Scan this computer

## What the button currently does

**Scan this computer** does not scan anything. It only advances to state 2.

## Decisions and defaults

- No user decision is committed in this state.
- No filesystem read or write occurs.
- The UI has already defaulted both Claude and Codex to selected, but the user cannot see that yet.

## Current comprehension risks

- “Neutral operating profile” is undefined.
- “Generates the files” does not say which files or where.
- “Doctor,” “managed files,” and “applied targets” are internal terms.
- “Never transferred” is ambiguous because setup may happen entirely on one computer.
- The button label says an action will happen immediately, but the button only advances.
- The promise of no writes before review is not true in one later branch.

## Replacement copy

**Heading**

> 

**Introduction**

> 

**Safety/reversibility explanation**

> 

**Primary button**

> 

## UX decisions to revisit

- What single outcome should a first-time user expect at the end?
- Which exclusions matter before starting, and which can wait until selection?
- Should this distinguish “move an existing setup” from “start fresh on this computer” immediately?

---

# Setup state 2: Choose agents and computer folder

## What is meant to happen

The user chooses the computer account Saddle should inspect and which supported agents should receive the finished setup. Saddle then checks whether Claude and/or Codex folders already exist.

## Current copy

**Heading**

> Which runtimes should receive the profile?

**Introduction**

> Scanning is read-only. Enter the home directory you want to inspect; Saddle will look only for supported runtime folders.

**Field**

- Label: **Computer home directory**
- Placeholder: `/Users/you`
- Current control: plain text field; there is no file or folder picker.

**Buttons**

- **Scan**
- **Back**
- **Continue** — disabled until a scan succeeds.

**Agent choices**

- Group label: **Install to**
- **Claude** — selected by default.
- **Codex** — selected by default.

## What each control currently does

- **Computer home directory:** accepts a manually typed absolute path. It does not default to the current user’s home folder.
- **Claude/Codex checkboxes:** determine both which folders are scanned and which agents receive files later.
- **Scan:** validates that at least one agent is selected and that the entered path is absolute, then checks for `.claude` and `.codex` beneath that path.
- **Back:** returns to Welcome without clearing entered values.
- **Continue:** advances to state 3. It becomes available after any successful scan, even if neither agent folder exists.

## Loading, results, and errors

**Loading**

> Scanning supported runtime folders…

**Result when found**

> Runtime folder detected

**Result when absent**

> No runtime folder yet — Saddle can create managed files

**Missing path error**

> Enter an absolute home directory.

**No agent selected error**

> Select at least one runtime.

The local server may also return a technical absolute-path validation error.

## Decisions and defaults

- Both agents are selected by default.
- An absent Claude or Codex folder is not treated as a blocker.
- The selected home directory later becomes the installation target and the source searched for existing instructions.
- No files are written.

## Current comprehension risks

- “Runtime” is technical vocabulary.
- “Receive the profile” is undefined.
- “Home directory” and an absolute path are unfamiliar to many users.
- The same folder is doing two jobs: source to inspect and destination to configure.
- The user must type a path that Saddle already has enough local context to infer in the common case.
- There is no Finder-style folder picker.
- “Install to” may sound as though Claude or Codex themselves will be installed.
- The absent-folder result promises Saddle can create files but does not explain whether the Claude/Codex app must already be installed.

## Replacement copy

**Heading**

> 

**Introduction**

> 

**Folder field or picker**

- Label:
- Default:
- Picker button:
- Help text:

**Agent selection label**

> 

**Primary button**

> 

**Found result**

> 

**Not-found result**

> 

## UX decisions to revisit

- Should the current macOS user folder be selected automatically?
- Should the user ever need to see or edit the raw path?
- Should installed-agent detection happen automatically when the screen opens?
- Should source inspection and destination installation be separate concepts?
- What should happen when an agent is selected but its application is not installed?

---

# Setup state 3: Choose where the setup comes from

## What is meant to happen

The user chooses between two fundamentally different jobs:

1. Turn instructions already present on this computer into a reusable Saddle folder.
2. Use a Saddle folder that was created elsewhere and copied to this computer.

## Current copy shared by both branches

**Heading**

> Build the neutral profile.

**Introduction**

> Start from the authored guidance already on this computer, or use a Saddle profile you transferred here.

**Choices**

- **Build from this computer** — selected by default.
- **Use an existing profile**.

**Notice**

> **Suggestions are advisory.** Low-risk operating and continuity guidance is preselected. Personal context, scripts, unsafe content, and generated runtime files are never selected automatically.

## What changing the choice does

- It swaps the visible form between state 3A and state 3B.
- It changes the primary button label.
- It does not read or write files by itself.

## Current comprehension risks

- The screen leads with the implementation object rather than the user’s situation.
- “Neutral profile,” “authored guidance,” “operating guidance,” “continuity guidance,” “generated runtime files,” and “advisory” all require product knowledge.
- The two choices do not explain how a first-time user knows which one applies.
- A new computer receiving a transfer should choose **Use an existing profile**, but the default points to the opposite path.
- The setup flow knows whether agent folders were found but does not use that evidence to recommend or select a branch.

## Replacement copy

**Heading**

> 

**Introduction**

> 

**Choice 1 label and explanation**

> 

**Choice 2 label and explanation**

> 

**Safety notice**

> 

## UX decisions to revisit

- Should this be an explicit “What are you trying to do?” fork earlier in the flow?
- Can Saddle recommend the correct branch from the scan result?
- Should a new computer with no prior harness default to “open the setup I brought”?

---

# Setup state 3A: Build from this computer

## What is meant to happen

Saddle reads existing Claude/Codex instruction files and capability folders, proposes reusable items, and saves the selected material into a new portable folder. That saved folder can later be used on this or another computer.

## Current copy

**Fields**

- **Profile name** — defaults to `My profile`.
- **Profile id** — defaults to `my-profile`.
- **Save the neutral profile to** — empty text field with placeholder `/Users/you/saddle-profiles/my-profile`.

**Buttons**

- **Inventory authored guidance**
- **Back**
- **Create profile and preview**

## What each control currently does

- **Profile name:** human-facing name stored in the manifest.
- **Profile id:** machine-facing identifier stored in the manifest. It is not automatically synchronized with edits to the name.
- **Save location:** requires the user to type an absolute output path. There is no folder picker. The final directory must not already contain conflicting output.
- **Inventory authored guidance:** scans the selected Claude/Codex folders and renders selectable findings. This is functionally required, although the UI presents it like an optional secondary action.
- **Create profile and preview:** requires at least one selected item. It first creates the new Saddle folder at the typed path, then builds a separate preview of changes to Claude/Codex.
- **Back:** returns to state 2.

## Inventory loading copy

> Reading authored sections and capability entrypoints…

## Inventory result groups

### Recommended foundation

Current explanation:

> Portable instruction sections selected by default.

Behavior:

- Includes selectable standard instruction sections.
- Every item in this group is checked by default.

### Optional capabilities

Current explanation:

> No capability is required for setup. Choose only portable workflows you use; one universal capability will project to every selected runtime.

Behavior:

- Capabilities are not selected by default.
- If the same capability exists in both Claude and Codex, the user must choose one source or choose **Do not include**.

### Personalization

Current explanation:

> Personal context stays optional and requires consent before it can be applied.

Behavior:

- Personal items are not selected by default.

### Needs attention

Current summary:

> Needs attention · [count]

Current explanation:

> These items are excluded, restricted instruction sections, or need review before capture.

Behavior:

- Collapsed by default.
- Shows excluded items, restricted instruction sections, and scan warnings.
- Nonselectable items have disabled controls.

### Each discovered item currently shows

- a checkbox or radio button;
- a heading inferred from the source content or folder;
- a technical tag such as `Claude · operating-policy · standard`;
- the source file path;
- machine-generated reasons for inclusion or exclusion.

## Validation and error copy

**Missing fields**

> Profile name, id, and save location are required.

**No selected findings**

> Select at least one authored item to capture.

Other server errors may expose terms such as candidate, canonical capability, digest, source collision, unsafe path, or selectable.

## Decisions and side effects

- The user chooses what becomes part of the reusable setup.
- Standard instruction sections are opted in by default.
- Personal items and capabilities are opted out by default.
- Clicking the primary button writes the new Saddle folder before the next screen appears.
- The original Claude/Codex source files are not changed during this state.
- After creation, the new folder becomes the source used to prepare the installation preview.

## Current comprehension risks

- “Build from this computer” does not explain that Saddle is copying selected instructions into a new reusable folder.
- “Inventory authored guidance” does not describe a recognizable user action.
- “Profile name” and “Profile id” ask for two names without explaining why.
- The output path is a raw filesystem path with no picker and no recommended default.
- The save destination is presented before the object being saved is explained.
- “Create profile and preview” combines a write with a preview, contradicting the earlier promise.
- The selection groups use taxonomy instead of recognizable examples or outcomes.
- “Commit” is not visible here, but backend and documentation language treats writing the manifest as committing the profile. A user is not making a version-control commitment.

## Replacement copy

**Branch label**

> 

**Branch explanation**

> 

**Name field**

- Label:
- Default:
- Help text:

**Save destination**

- Label:
- Default:
- Picker behavior:
- Help text:

**Scan/inventory button**

> 

**Primary button before any write**

> 

**Selection group names and explanations**

1. 
2. 
3. 
4. 

## UX decisions to revisit

- Should the profile id be generated and hidden unless there is a conflict?
- Should Saddle choose a default save folder and let the user change it with Finder?
- Should scanning occur automatically on entry?
- Should creating the reusable folder have its own exact preview and confirmation?
- Should standard instructions ever be selected automatically, or only recommended?
- How should a user inspect the full content before deciding to include it?
- What plain-language categories replace the current internal module taxonomy?

---

# Setup state 3B: Use an existing Saddle folder

## What is meant to happen

The user points Saddle to a previously created folder copied from another computer. Saddle validates it and prepares a preview of what it would add or update for the selected agents on this computer.

## Current copy

**Field**

- Label: **Existing profile directory**
- Placeholder: `/path/to/my-profile`
- Current control: plain text field; there is no folder picker.

**Buttons**

- **Back**
- **Build preview**

## What each control currently does

- **Existing profile directory:** accepts a manually typed path. It is not read or validated until the primary button is clicked.
- **Build preview:** loads and validates the Saddle folder, reads the current destination state, and advances to state 4 if successful. It does not write files.
- **Back:** returns to state 2.

## Decisions and side effects

- The user chooses which transferred Saddle folder to install.
- No personal or restricted item is approved here; those confirmations appear in the preview.
- No file is written.

## Current comprehension risks

- “Existing profile directory” assumes the user knows what file/folder they transferred and what makes it valid.
- The lack of a file picker is especially costly on the destination computer, where the bundle may be in Downloads, AirDrop, iCloud Drive, or an external disk.
- “Build preview” does not state what will be previewed.
- The screen does not show how to recognize the right folder (`saddle.profile.json`) or what to do with a `.tgz`/archive.

## Replacement copy

**Branch label**

> 

**Explanation**

> 

**Folder picker label**

> 

**Empty state / recognition help**

> 

**Primary button**

> 

## UX decisions to revisit

- Should this use a Finder picker that validates the chosen folder immediately?
- Should Saddle accept a packaged archive directly and unpack it into a safe local location?
- Should the user see the saved setup’s name, origin, version, included items, and privacy warnings before proceeding?

---

# Setup state 4: Review changes to this computer

## What is meant to happen

The user sees the exact Claude/Codex files Saddle proposes to create or update. Personal or restricted items require explicit confirmation. Nothing in the agent folders changes until the user applies the preview.

## Current copy

**Heading**

> Review every proposed change.

**Introduction**

> The digest binds Apply to this exact profile and filesystem state. If either changes, Saddle stops and asks for a new preview.

**Buttons**

- **Back**
- **Apply this preview**

## Loading copy

> Reading the profile and current target state…

## Information currently displayed

**Technical metadata**

- Profile: `[id]@[version]`
- Plan digest: a long SHA-256 value.
- Target: absolute home-directory path.

**Required confirmations, when present**

> **Confirm destination use**

> These items are personal or restricted. Confirm each item before Apply.

Each checkbox is labeled with the internal id, kind, and sensitivity, for example:

> `feedback-preferences · personal-context · personal`

**Each proposed file operation shows**

- action such as create file, replace file, or create directory;
- relative target path;
- reason;
- source module ids;
- risk classification;
- expandable **Review proposed content** control containing the exact file body.

## What each control currently does

- **Personal/restricted confirmation checkbox:** approves that one module for this installation. All required confirmations must be checked before Apply is enabled.
- **Review proposed content:** expands the exact generated content inline.
- **Back:** returns to state 3. It does not undo a reusable folder already created in state 3A.
- **Apply this preview:** sends the accepted preview digest, selected confirmations, and current paths to the server. The server recalculates the plan, stops if anything changed, then writes the proposed Claude/Codex files transactionally and verifies them.

## Decisions and side effects

- The user is approving concrete filesystem changes to one or both agent installations.
- Apply is disabled until every required personal/restricted confirmation is selected.
- The preview is invalidated if the saved setup or destination state changes.
- Clicking Apply writes files and creates a transaction record under `.saddle` in the selected home directory.

## Apply states and errors

**While applying**

> Applying…

**Preview changed**

> The target or profile changed after preview. Review a new plan before applying.

Other conflicts can stop before any write. A failure during the transaction attempts to restore the prior state.

## Current comprehension risks

- “Digest,” “filesystem state,” “target,” “module,” and “risk” are implementation vocabulary.
- The primary user question—“What will change in Claude/Codex?”—is visually secondary to ids and hashes.
- Consent labels use ids and types instead of the user-facing label and content summary.
- “Apply” does not say that files will now be installed or updated.
- The user may believe Back returns to a pre-write state, but state 3A may already have created a folder.

## Replacement copy

**Heading**

> 

**Introduction**

> 

**Summary of impact**

> 

**Personal confirmation explanation**

> 

**Technical-details disclosure label**

> 

**Primary button**

> 

## UX decisions to revisit

- Which details belong in the default view versus a technical disclosure?
- Should files be grouped by Claude and Codex with plain-language summaries first?
- Should content previews default open for personal or high-risk material?
- What language clearly distinguishes saving a reusable setup from installing it?

---

# Setup state 5: Finished, verification, and rollback

## What is meant to happen

The user learns whether installation succeeded, what was installed, and how to verify or undo it.

## Current success copy

**Heading**

> Profile installed and verified.

**Introduction**

> Claude and Codex can now reference the same operating profile. Keep the source bundle; generated runtime files are outputs.

**Details**

- Transaction: internal transaction UUID.
- Profile source: absolute path to the Saddle folder.
- Installed to: absolute home-directory path.

**Buttons**

- **Run doctor**
- **Roll back**

## What each button currently does

- **Run doctor:** reads all Saddle-managed files again and reports each selected agent’s verification status, such as `claude: exact · codex: exact`. It does not write.
- **Roll back:** restores files from before this setup transaction, but only if managed targets have not subsequently changed. It does not uninstall the Saddle npm package or delete the reusable Saddle folder.

## Doctor states

**Loading**

> Checking managed files and lifecycle support…

**Success format**

> `[runtime]: exact`

Errors appear as a generic error notice containing the server message.

## Rollback states

**Loading**

> Restoring the previous files…

**Success heading**

> The profile was rolled back.

**Success explanation**

> Saddle restored the files that existed before this setup transaction.

**Success status**

> Rollback verified.

After success, the rollback button is disabled.

## Verification-failed variant

If the files were written but verification is not exact, the UI still advances to Finish and replaces the success copy:

**Heading**

> The apply needs attention.

**Explanation**

> Verification did not pass. Roll back this transaction before continuing.

**Fallback error**

> The files changed, but Saddle could not verify the installed profile. Use Roll back this setup below.

## Decisions and side effects

- Doctor is optional even though verification also runs automatically after Apply.
- Rollback is user-initiated and modifies files.
- There is no guided first-task or context-reset test in the UI.
- There is no “Open Claude,” “Open Codex,” “Show installed files,” or “Copy test script” action.

## Current comprehension risks

- “Profile,” “operating profile,” “source bundle,” “generated runtime files,” “transaction,” “doctor,” and `exact` remain unexplained.
- The screen says verified but still offers Run doctor without explaining the difference.
- It does not tell the user what behavior should now be different.
- It does not guide the first physical transfer acceptance test.
- The rollback boundary is easy to misunderstand.

## Replacement copy

**Success heading**

> 

**Success explanation**

> 

**What changed summary**

> 

**Verification status**

> 

**Next action**

> 

**Rollback action and explanation**

> 

## UX decisions to revisit

- Should verification be automatic and shown as a completed result rather than a “doctor” action?
- What guided behavior test should happen before setup is declared complete?
- Should rollback remain prominent, and for how long?
- What does the user need to retain for another computer?

---

# Global setup errors and recovery gaps

## Current behavior

- Errors appear inside the current screen as a bordered notice.
- The UI usually shows the raw server error message.
- Errors do not include a stable code, next action, or link to reveal technical details.
- The setup state remains in browser memory only. Refreshing the page resets the setup flow.
- If the user created a reusable folder in state 3A and later abandons setup, that folder remains.
- If apply fails after writes begin, the transaction layer attempts automatic restoration.
- If apply succeeds but verification fails, the user is instructed to roll back manually.

## UX decisions to revisit

- Which errors can be prevented through defaults, pickers, and inline validation?
- Which errors need a plain-language recovery action?
- Should the setup remember completed steps after refresh?
- How should Saddle explain the difference between a saved reusable setup, an installed setup, and a rollback record?

---

# Separate customization flow

This flow opens when the user runs:

```sh
saddle customize --profile /path/to/current-profile --out /path/to/new-profile
```

The source and output paths therefore originate in the command line before the browser opens. The browser still exposes the output as an editable text field. There is no folder picker.

## Customization state 1: Compose

### What is meant to happen

Create a revised copy of a previously saved Saddle folder without changing the original.

### Current copy

Progress label: **Compose**

Eyebrow:

> Customize profile

Heading:

> Make the profile yours.

Introduction:

> Create a new profile from the current one. Keep what still fits, remove what does not, and add context or working rules in your own language.

Source metadata:

- **Source profile:** `[id]@[version]`
- **Source directory:** absolute path
- **Safety:** `A new profile will be created; the source stays unchanged`

Fields:

- **New profile name** — defaults to `[old name] — customized`.
- **Profile id** — defaults to `[old id]-custom`.
- **Save the new profile to** — prefilled from the CLI `--out` path, editable as raw text.

Existing-material section:

> **Keep from the current profile**

> Required continuity stays enabled. Everything else can be removed from the new version without changing the source profile.

- Every existing module is selected by default.
- Required continuity modules are selected and disabled, so they cannot be removed.
- Rows show internal module id, translated type, sensitivity, and whether required.

New-material section:

> **Add your own entries**

> Personal context can use any label or category. Each personal entry receives its own preview and consent boundary.

One blank entry is added automatically. Each entry contains:

- **Type:** Personal context, Operating rule, Project standard, or Universal capability. Personal context is the default.
- **Label:** placeholder `How I like feedback`.
- **Entry id:** placeholder `feedback-preferences`; auto-generated from the label until manually edited.
- **What should an agent know or do?:** six-row text area.
- A type-specific privacy/system explanation.
- **Remove entry** button.

Buttons:

- **Add an entry:** appends another blank entry.
- **Remove entry:** removes that entry immediately without confirmation.
- **Review new profile:** validates the form and output path, computes the exact proposed folder, and advances without writing.

Notice:

> **No preset ceiling.** Onboarding stays short; customization can grow with the person. The active profile is never edited in place.

Loading button:

> Building preview…

### Decisions and side effects

- All existing modules remain unless unchecked.
- Required continuity cannot be unchecked.
- Any number of new entries may be added.
- Empty entry forms are ignored.
- No files are written during Compose or preview generation.

### Current comprehension risks

- The user must begin in the command line with two paths before seeing the UI.
- “Profile id,” “source profile,” “source directory,” “module,” “continuity,” “consent boundary,” and “active profile” assume product knowledge.
- The user sees an automatically added blank form before choosing what they want to add.
- The four entry types encode system architecture rather than user intent.
- “Universal capability” and the type-specific `CAPABILITY.md` explanation are technical.

### Replacement copy

**Heading and introduction**

> 

**Existing-material section**

> 

**New-material section**

> 

**Entry types and explanations**

1. 
2. 
3. 
4. 

**Primary button**

> 

### UX decisions to revisit

- Should customization be reachable from the setup finish screen without CLI paths?
- Should the source and destination use Finder pickers?
- Should one blank entry exist automatically?
- Can the internal id be generated and hidden?
- Should entry types be inferred, described with examples, or replaced with jobs the user recognizes?

## Customization state 2: Review

### What is meant to happen

Show exactly what the new saved folder will contain before creating it.

### Current copy

Progress label: **Review**

Heading:

> Check the profile before saving.

Introduction:

> This preview is bound to the source profile, your draft, and the empty output location. Changing any of them requires a new preview.

Metadata:

- Source: `[id]@[version]`
- New profile: `[id]@[version]`
- Save to: absolute path
- Preview digest: SHA-256 value

Groups:

- **Kept**
- **Removed**
- **Added**
- **Files to create**

Each file shows action, risk, path, reason, digest, and an expandable exact-content preview.

Personal-material notice, when applicable:

> **Personal consent remains granular.** [count] personal entry/entries require separate confirmation when this profile is exported or installed.

Buttons:

- **Back:** returns to Compose without writing.
- **Create this profile:** recalculates and compares the preview, then creates the output folder. It never edits the source.

Loading button:

> Creating…

### Decisions and side effects

- This is the final confirmation before the new folder is written.
- No personal consent checkbox appears here; the notice explains that consent happens later during export or installation.
- The output path must remain empty/absent.
- If the source, draft, or destination changed, creation stops and asks for a new preview.

### Current comprehension risks

- “Bound,” “source profile,” “draft,” “output location,” “digest,” “risk,” and technical file operations dominate the explanation.
- The user is asked to understand a later consent boundary without a concrete scenario.
- The review emphasizes implementation proof over a readable summary of what the agent will know or do.

### Replacement copy

**Heading and introduction**

> 

**Change summary labels**

- Kept:
- Removed:
- Added:
- Technical details:

**Personal-material explanation**

> 

**Primary button**

> 

## Customization state 3: Saved

### What is meant to happen

Confirm that the revised reusable folder exists, that the original is unchanged, and explain the next useful action.

### Current copy

Progress label and eyebrow: **Saved**

Heading:

> Your new profile is ready.

Introduction:

> The source profile is unchanged. Use setup on any computer to preview where this derived profile would be installed.

Details:

- New profile: `[id]@[version]`
- Saved to: absolute path
- Source profile: absolute path

There are no buttons or guided next actions.

### Decisions and side effects

- The new folder has been created.
- The original folder is unchanged.
- The user must leave this flow and run setup separately to install or transfer it.

### Current comprehension risks

- “Source profile” and “derived profile” remain unexplained.
- “Use setup” does not say what command or action to take.
- There is no Show in Finder, Install on this computer, Export/copy, or Done action.

### Replacement copy

**Heading and explanation**

> 

**Primary next action**

> 

**Secondary actions**

- 
- 

---

# Product decisions currently hidden from the user

These decisions are made by the product but are not explained at the moment they matter:

1. Both Claude and Codex are selected before the user reaches the agent screen.
2. The same home-directory path is used as both the place to inspect and the place to install.
3. Standard instruction sections are selected automatically after inventory.
4. Personal context and capabilities are not selected automatically.
5. A duplicate capability found in both agents requires choosing one canonical source.
6. Creating from this computer writes the reusable Saddle folder before the installation preview.
7. Installing personal/restricted material requires a separate checkbox for each item.
8. The final generated Claude/Codex files are managed outputs; the reusable Saddle folder remains the editable source.
9. The current source folder is never edited by customization; a separate new folder is always created.
10. Rollback covers one installation transaction. It does not uninstall Saddle or delete saved Saddle folders.

# Questions the revised flow must answer in plain language

At each state, a new user should be able to answer:

1. What am I doing right now?
2. Why does Saddle need this information?
3. What has Saddle found?
4. What is already selected, and why?
5. What will happen when I press the primary button?
6. Will that button read files, create files, change files, or only continue?
7. Where will the result live?
8. What can I undo?
9. What will not transfer or install?
10. What should be observably different when setup is finished?
