## 2026-08-10 — Verify model routing from the runtime receipt

Context: A Terra Medium subagent reported itself as Sol High after receiving a limited parent-history fork. Earlier, a full-history fork with an override was rejected.

Learning: Full-history forks inherit the parent and cannot accept overrides. Limited or fresh forks can accept overrides. The tone-audit task did run on Terra Medium; only its completion-card prose was wrong. The child session's first `turn_context.payload.model` and `.effort` are the source of truth.

Risk: Trusting a self-written completion card can make correct cost routing look broken and can hide a real mismatch later.

Follow-up: Use fresh context for explicitly routed work, verify the child `turn_context`, and label the model unverified when the agent cannot read that metadata.
