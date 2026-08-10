export const profile = Object.freeze({
  profile: { id: 'portable-test', name: 'Portable test', version: '1.2.3' },
  digest: 'a'.repeat(64),
  modules: [
    { id: 'standards', kind: 'project-standard', enabled: true, source: 'instructions/project-standards.md', content: 'Use the project dashboard before acting.' },
    { id: 'operating', kind: 'operating-policy', enabled: true, source: 'instructions/operating.md', content: 'Keep changes reversible.' },
    { id: 'ignored', kind: 'session-continuity', enabled: false, source: 'instructions/session.md', content: 'Do not project me.' },
    { id: 'release-notes', kind: 'capability', enabled: true, source: 'capabilities/release-notes/CAPABILITY.md', content: '# Release notes\n\nInputs and outputs are documented.' },
  ],
});

