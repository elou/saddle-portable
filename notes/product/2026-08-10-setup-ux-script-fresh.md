# Saddle Portable setup script

Saddle has two separate paths. **Setup** puts one set of instructions into Claude and/or Codex on this computer. **Customize profile** makes a new, changed copy of an existing set of instructions; it does not install anything.

The setup header says `Saddle` and `Local session`. The progress labels are `01 Welcome`, `02 Runtimes`, `03 Profile`, `04 Preview`, and `05 Finish`. The customization labels are `01 Compose`, `02 Review`, and `03 Saved`.

## Setup

### 1. Welcome

**What the person is doing**

Starting a local setup and learning the safety boundary.

**On screen**

> Bring your working methods with you.
>
> Saddle sets up one neutral operating profile, then generates the files Claude and Codex understand. Everything stays on this computer.
>
> Before any write — You will see the exact files and conflicts.
>
> Never transferred — Credentials, transcripts, trust grants, and runtime permission state.
>
> After setup — Doctor verifies managed files. Rollback restores them only while applied targets remain unchanged.

`Scan this computer` only moves to the next screen. It does not scan or write files. There are no choices here. Nothing can be changed yet, and nothing happens automatically.

**Important decision**

The claim says files and conflicts appear before writing, but this first button’s label suggests a scan even though it only advances.

### 2. Choose Claude and Codex

**What the person is doing**

Choosing this computer’s home folder and which assistant folders Saddle should inspect and later receive files.

**On screen**

> Which runtimes should receive the profile?
>
> Scanning is read-only. Enter the home directory you want to inspect; Saddle will look only for supported runtime folders.

The field is `Computer home directory` with the placeholder `/Users/you`. It must be an absolute path. `Claude` and `Codex` are checked by default under `Install to`. At least one must stay checked.

`Scan` reads only the selected `.claude` and `.codex` folders below that home folder. It reports either `Runtime folder detected` or `No runtime folder yet — Saddle can create managed files`. No files are written, including when a folder is missing. `Continue` starts disabled and becomes available after a successful scan. `Back` only returns to Welcome. `Continue` only moves forward.

**What can change later**

The home folder and checked assistants can be changed before the preview. The person can go back from later setup screens. A later apply does not create an assistant installation; it may create Saddle-managed files in its folder.

**Important decision**

The heading asks where to install, but this screen only scans. The chosen assistant folders are not shown again until the file-by-file preview.

### 3. Gather instructions or choose an existing set

**What the person is doing**

Either gathering instructions already on this computer into a new portable set, or choosing a set that was already brought here.

**On screen**

> Build the neutral profile.
>
> Start from the authored guidance already on this computer, or use a Saddle profile you transferred here.
>
> Build from this computer
>
> Use an existing profile
>
> Suggestions are advisory. Low-risk operating and continuity guidance is preselected. Personal context, scripts, unsafe content, and generated runtime files are never selected automatically.

`Build from this computer` is the default. It shows `Profile name` set to `My profile`, `Profile id` set to `my-profile`, and `Save the neutral profile to` with `/Users/you/saddle-profiles/my-profile` as a placeholder. The name identifies the set to a person. The id becomes its lowercase, hyphenated file-safe name. The save location must be an unused absolute folder.

`Inventory authored guidance` reads selected Claude and Codex folders. It shows `Reading authored sections and capability entrypoints…` while working. It writes nothing. Results are grouped as follows.

- `Recommended foundation` says `Portable instruction sections selected by default.` These safe instruction sections start checked.
- `Optional capabilities` says `No capability is required for setup. Choose only portable workflows you use; one universal capability will project to every selected runtime.` They start unchecked. When the same capability appears in more than one assistant folder, the person must pick one copy or `Do not include`; Saddle will not combine them.
- `Personalization` says `Personal context stays optional and requires consent before it can be applied.` These start unchecked.
- `Needs attention · [number]` is closed by default and says `These items are excluded, restricted instruction sections, or need review before capture.` It can contain unavailable items and skipped-file reasons. It may say `Nothing needs review.`

Each available item shows its heading, assistant, kind, sensitivity, original file path, and reason. Unavailable items are disabled. Empty groups say `Nothing found.` or `No portable capabilities found.`

`Create profile and preview` requires a name, id, unused save location, and at least one selected item. It then reads the selected files and writes a new instruction set at the chosen location before showing the next screen. Saddle always adds its own session-continuity instructions; selected continuity instructions are added to them. It does not copy credentials, transcripts, trust grants, permission state, generated assistant files, unsafe content, or unselected items. Scripts inside a selected capability are copied as restricted files, not run.

`Use an existing profile` replaces the gathering fields with `Existing profile directory`, placeholder `/path/to/my-profile`. `Build preview` does not write a new set. It reads the chosen existing set later, when the preview is built.

`Back` only returns to the scan screen. Switching modes changes the button text but does not erase a saved set. All choices can be changed before creating or using a set.

**Important decision**

Creating a new set is hidden behind a button that sounds like previewing. A file write happens before the person sees the install preview.

### 4. Review proposed files

**What the person is doing**

Checking every proposed change to the selected Claude and Codex folders, then expressly allowing personal or restricted instructions to go there.

**On screen**

> Review every proposed change.
>
> The digest binds Apply to this exact profile and filesystem state. If either changes, Saddle stops and asks for a new preview.

While loading, the screen says `Reading the profile and current target state…`. It reads the chosen instruction set and current Claude/Codex files. It does not write files.

The result shows `Profile`, `Plan digest`, and `Target`, then one row for each proposed file. Each row shows the literal action, target path, reason, originating instructions, risk, and, when text is available, `Review proposed content`. Conflicts appear as their planned file action and reason rather than as a generic success message.

If personal or restricted instructions are included, the screen adds `Confirm destination use` and says `These items are personal or restricted. Confirm each item before Apply.` Each checkbox approves one named item. `Apply this preview` stays disabled until every required box is checked. No consent box appears for standard instructions.

`Back` only returns to the previous screen. `Apply this preview` writes files only after this exact preview remains current. If the selected instruction set or target files changed, Saddle refuses to apply and says `The target or profile changed after preview. Review a new plan before applying.`

**What can change later**

The person can go back and change assistants, instructions, or paths, then build a new preview. They cannot alter the preview in place or apply a stale one. Saddle does not automatically accept personal or restricted instructions.

**Important decision**

The preview exposes a technical digest before the human decision. Its useful promise is that Saddle rechecks the files; the digest itself is not explained in ordinary language.

### 5. Finish, check, or undo

**What the person is doing**

Confirming that the selected assistants received the files, checking their state, or restoring the pre-setup files.

**On screen after a verified install**

> Profile installed and verified.
>
> Claude and Codex can now reference the same operating profile. Keep the source bundle; generated runtime files are outputs.

The details show `Transaction`, `Profile source`, and `Installed to`.

`Run doctor` reads managed files and lifecycle support. It says `Checking managed files and lifecycle support…`, then reports each selected assistant as `claude: [status]` or `codex: [status]`. It writes nothing.

`Roll back` says `Restoring the previous files…`, then restores the files changed by this setup transaction from its saved transaction record. On success the copy becomes `The profile was rolled back.` and `Saddle restored the files that existed before this setup transaction.` The notice says `Rollback verified.` and the button is disabled. Rollback only works while the files Saddle applied have not since changed.

**Failure state**

If files were written but verification does not pass, the screen changes to:

> The apply needs attention.
>
> Verification did not pass. Roll back this transaction before continuing.

It shows the verification error and directs the person to `Roll back this setup below.`

**What can change later**

Doctor can be run again. Rollback is a one-time recovery action for this transaction. Setup does not automatically open Claude or Codex, confirm a first task, or keep files synchronized after this point.

**Important decision**

The finish copy promises both Claude and Codex can use the instructions even if the person selected only one of them.

## Customize profile

This path replaces the setup path when Saddle is opened in customization mode. It starts with a selected existing instruction set and an output location supplied when Saddle starts.

### 1. Compose a new set

**What the person is doing**

Making a new version of existing instructions without changing the original.

**On screen**

> Customize profile
>
> Make the profile yours.
>
> Create a new profile from the current one. Keep what still fits, remove what does not, and add context or working rules in your own language.

The screen shows `Source profile`, `Source directory`, and `Safety — A new profile will be created; the source stays unchanged`.

`New profile name` defaults to `[current name] — customized`. `Profile id` defaults to `[current id]-custom`. `Save the new profile to` defaults to the location supplied when Saddle starts. The output must be an unused absolute folder outside the original set.

`Keep from the current profile` lists every existing instruction with a checked box, its kind, and whether it is standard, personal, or restricted. `Required continuity stays enabled. Everything else can be removed from the new version without changing the source profile.` Required continuity boxes cannot be unchecked.

`Add your own entries` begins with one blank `New entry 1`. `Add an entry` creates another. Every entry has:

- `Type`, default `Personal context`. Other choices are `Operating rule`, `Project standard`, and `Universal capability`.
- `Label`, placeholder `How I like feedback`. It names the entry.
- `Entry id`, placeholder `feedback-preferences`. It is automatically made lowercase and hyphenated from the label until the person edits the id themselves.
- `What should an agent know or do?`, a six-line text box.
- `Remove entry`, which removes only that unsaved entry.

For `Personal context`, Saddle says `This entry is marked personal and receives its own consent check when the profile is exported or installed.` For `Universal capability`, it says `Saddle creates one neutral CAPABILITY.md and generates runtime projections from it.` For the other choices, it says `This standard entry is included in the derived profile after preview.`

The notice says `No preset ceiling. Onboarding stays short; customization can grow with the person. The active profile is never edited in place.`

`Review new profile` reads the original instruction files and checks the new draft and empty output location. It does not write files. It rejects duplicate or reserved ids, empty fields, secret-bearing content, this-computer paths, assistant-specific instructions, output inside the original folder, and an output folder that already exists. The button temporarily says `Building preview…`.

**What can change later**

Every draft choice can be changed by returning from review and making a new preview. The original set will not be changed automatically. This path does not choose a computer, Claude, or Codex, and does not install anything.

**Important decision**

The first screen explains granular consent but offers no way to choose consent now. Consent is deferred to a later export or installation.

### 2. Review the new set

**What the person is doing**

Checking what will be kept, removed, and added before Saddle creates the new folder.

**On screen**

> Review
>
> Check the profile before saving.
>
> This preview is bound to the source profile, your draft, and the empty output location. Changing any of them requires a new preview.

The result shows `Source`, `New profile`, `Save to`, and `Preview digest`. It then lists `Kept`, `Removed`, and `Added`, with `No existing modules kept.`, `No modules removed.`, or `No new entries added.` when appropriate. Each item shows its label or id, kind, and sensitivity.

If personal entries are present, the notice says `Personal consent remains granular.` followed by `[number] personal entry requires separate confirmation when this profile is exported or installed.` It also lists `Files to create`. Every file row shows the action, risk, location, reason, digest, and either `Review proposed content` or `Review exact proposed bytes (base64)`.

`Back` only returns to the draft. `Create this profile` writes the reviewed files to a temporary folder, checks them, then creates the new output folder. It temporarily says `Creating…`. If the original set, draft, or output location changed since preview, Saddle refuses and says `The profile or draft changed after preview. Review a new preview before applying.`

**What can change later**

The person can go back before creating the new set. They cannot change the reviewed file list in place. Saddle does not install the result into Claude or Codex, and it does not automatically approve personal entries for another computer.

**Important decision**

`Create this profile` is accurate about the folder write, but the preview speaks in internal terms such as “digest” and “modules” without plain-language help.

### 3. Saved

**What the person is doing**

Confirming where the new set lives and what remained unchanged.

**On screen**

> Saved
>
> Your new profile is ready.
>
> The source profile is unchanged. Use setup on any computer to preview where this derived profile would be installed.

The details show `New profile`, `Saved to`, and `Source profile`.

There are no fields or buttons. No further files are read or written on this screen. The person can later use the separate setup flow to inspect a computer and preview an installation. Saddle does not automatically install, export, synchronize, or alter the original set.

**Important decision**

The success copy calls the result a “derived profile,” which is accurate but does not plainly say it is a new separate folder of instructions.
