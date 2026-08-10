# Where the new voice rules belong

## Put these in the shared harness

These rules should apply to Claude, Codex, and any future agent.

### Plain language is the default

> Use concise, plain English in every conversation. Context changes how much detail Emily needs. It does not change how plainly you should speak.

### Start with the person's job

> Say what the person is doing and why before naming an internal object. If a technical term is necessary, explain it in the same sentence.

### Repair confusing language immediately

> When Emily says something is confusing, too technical, or too long, restate it in one or two literal sentences. Do not explain or defend the previous wording.

### Keep draft handoffs simple

> When Emily will edit a draft, say what she can do in one sentence. Do not give her an editing framework unless different kinds of feedback require different actions.

### Keep technical proof behind the answer

> Lead with what changed, whether it worked, what remains, and what Emily needs to decide. Put commands, paths, hashes, test names, and implementation details afterward and only when useful.

### Report subagent models from evidence

> Do not infer a subagent's model from its completion card or inherited context. Verify the child session's runtime model and effort. If that record is unavailable, report the model as unverified.

Recommended durable targets:

- `~/.claude/CLAUDE.md` under **Conversational Tone**. `~/.codex/AGENTS.md` already points to this file, so the change would cover both agents.
- `~/.claude/CLAUDE.md` under **Agent completion card** for verified model reporting.
- `~/.claude/skills/delivery-orchestration/SKILL.md` for the short user-facing update rule.

## Put these in the global design guidance

These rules apply to onboarding and setup interfaces, not every conversation.

### Make every screen answer four questions

> What am I doing? What happens when I continue? What can I change later? What will not happen automatically?

### Make controls say what they do

> A button that only moves forward should not claim that it scans, saves, installs, or verifies. A button that writes files must say so before the user clicks it.

### Prefer familiar controls over raw paths

> Use a native file or folder chooser for ordinary setup. Keep raw paths as a fallback or technical detail.

Recommended durable target:

- `~/.codex/DESIGN-SYSTEM.md` under **Components** or a new **Onboarding** section.

## Keep these in Saddle

These rules depend on Saddle's product and should not govern unrelated tools.

- Say **this Mac**, **another computer**, **Claude**, **Codex**, **folder**, **file**, **instructions**, and **setup** in the interface.
- Treat `profile`, `manifest`, `module`, `projection`, `digest`, `runtime`, `source`, and `destination` as technical details.
- Explain a Saddle setup folder as “the folder copied from your other computer.” Keep `saddle.profile.json` as a technical detail or error-recovery clue.
- Do not show an editable machine id when Saddle can generate it from the setup name.
- Use a folder chooser for the Mac account, the transferred setup, and the place where a new setup will be saved.
- State clearly when Saddle saves a separate copy and when it changes Claude or Codex.
- Keep personal instructions off until the person selects and approves them.
- Show the exact file changes before installation, but keep hashes and internal ids in technical details.
- Finish with an observable test and a plain **Undo this setup** action.

Recommended durable targets:

- `/Users/emily/Developer/saddle-portable/DESIGN-SYSTEM.md`
- `/Users/emily/Developer/saddle-portable/docs/ONBOARDING.md`
- onboarding copy tests in `/Users/emily/Developer/saddle-portable/test/integration/ui-server.test.js`

## Recommendation

Push the six shared communication rules and verified model reporting into the harness. Put the three interface rules in the global design system. Keep Saddle's nouns, consent model, file behavior, and finish test inside Saddle.

Do not copy the full Saddle voice manifest into the harness. That would make other products inherit product-specific words and flows.
