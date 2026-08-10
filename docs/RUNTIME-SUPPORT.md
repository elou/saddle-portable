# Runtime support

Version `0.1` projects one neutral profile into Claude and Codex.

| Behavior | Claude | Codex |
| --- | --- | --- |
| Global instructions | Managed block in `.claude/CLAUDE.md` | Managed block in `.codex/AGENTS.md` |
| Capabilities | `.claude/skills/saddle-<id>/SKILL.md` | `.codex/skills/saddle-<id>/SKILL.md` |
| Capability references | Copied as managed inert text | Copied as managed inert text |
| Runtime settings | Not changed | Not changed |
| Permissions and trust | Not changed | Not changed |

## Lifecycle support

| Event | Claude | Codex |
| --- | --- | --- |
| Session start | Instruction fallback | Instruction fallback |
| Session checkpoint | Instruction fallback | Instruction fallback |
| Before context reset | Instruction fallback | Instruction fallback |
| After context reset | Instruction fallback | Instruction fallback |
| Session end | Instruction fallback | Instruction fallback |
| Before tool | Unsupported | Unsupported |
| After tool | Instruction fallback | Instruction fallback |
| Tool error | Instruction fallback | Instruction fallback |
| Subagent start | Instruction fallback | Instruction fallback |
| Subagent end | Instruction fallback | Instruction fallback |

These labels describe Saddle version `0.1`, not every feature a runtime may expose. Saddle does not install runtime hooks in this release.

Run `saddle doctor` after apply. Doctor reports missing, drifted, exact, or unverifiable managed artifacts and prints the lifecycle matrix.

