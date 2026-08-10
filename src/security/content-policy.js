const ASSIGNED_SECRET = /(?:\b(?:api[_-]?key|access[_-]?token|authorization|password|secret|private[_-]?key|cookie)\b\s*[:=]|https?:\/\/[^\s/]+[^\s]*[?&](?:token|api[_-]?key|key|secret|signature|sig|password|credential)=)/i;
const BARE_CREDENTIAL = /\b(?:sk-(?:proj|live|test)-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xoxb-[A-Za-z0-9-]{12,}|AKIA[A-Z0-9]{16})\b|-----BEGIN PRIVATE KEY-----/;

export const ABSOLUTE_HOME_PATH = /(?:^|[\s"'`(])(?:\/Users\/[^/\s]+|\/home\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/;
const PROVIDER_RUNTIME_GUIDANCE = /\b(?:anthropic|claude(?: code)?|codex|openai|chatgpt|gemini|haiku|sonnet|opus|gpt(?:-[a-z0-9.]+)?)\b|\b(?:agent|task) tool\b/i;
export const RUNTIME_BOUND_GUIDANCE = /`\$[a-z][a-z0-9-]*`|`\/[a-z][a-z0-9-]*`|\b(?:[Ii]nvoke(?:s|d)?|[Rr]un(?:s|ning)?|[Uu]se(?:s|d|ing)?)\s+(?:the\s+)?(?:command\s+)?[/$][a-z][a-z0-9-]*\b/;
export const DESTINATION_INTEGRATION_GUIDANCE = /\b(?:AGENTS|CLAUDE|SKILL)\.md\b|\b(?:linear\s+)?mcp\s+(?:server|connection)\b|\bmodel_reasoning_effort\b/i;
const EXTERNAL_RUNTIME_INSTRUCTION = /\b(?:npm\s+(?:install|i|run)|node\s+[A-Za-z0-9_.-]+\.js)\b|\b(?:configure|set up|install|connect|create)\s+(?:the\s+)?(?:slack|linear|notion)\s+(?:webhook|oauth|api|configuration|integration)|\b(?:slack|linear|notion)\s+(?:webhook|oauth|api|configuration)\b/i;

export function hasSecretBearingContent(value) {
  return typeof value === 'string' && (ASSIGNED_SECRET.test(value) || BARE_CREDENTIAL.test(value));
}

export function classifyContent(value, { tier = 'profile' } = {}) {
  if (hasSecretBearingContent(value)) return 'secret-bearing';
  if (typeof value === 'string' && ABSOLUTE_HOME_PATH.test(value)) return 'machine-specific-path';
  if (tier === 'profile') return null;
  if (typeof value === 'string' && (RUNTIME_BOUND_GUIDANCE.test(value) || DESTINATION_INTEGRATION_GUIDANCE.test(value) || EXTERNAL_RUNTIME_INSTRUCTION.test(value))) return 'runtime-bound';
  if (tier === 'portable' && typeof value === 'string' && PROVIDER_RUNTIME_GUIDANCE.test(value)) return 'runtime-bound';
  return null;
}
