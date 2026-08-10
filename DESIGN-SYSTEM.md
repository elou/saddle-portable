# Saddle Portable Design System

This is a derived child of Emily's global design system, narrowed for a local setup and transfer product.

## Experience promise

At every step, the user should know what Saddle found, what choice is being requested, what local files would change, and how to undo the result.

## Product principles

- Use one linear path with one primary next action.
- Describe customer outcomes before system topology.
- Treat the local machine as authoritative and display the source and precedence of every discovered item.
- Show file-level proposals before writes. Never hide a conflict behind a generic success state.
- Use `native`, `instruction fallback`, and `unsupported` consistently; do not imply runtime control that does not exist.
- Make personal context and integrations clearly optional and off by default.
- Keep recovery visible: backup, rollback, and doctor belong in the primary experience, not an advanced drawer.

## Visual language

- Quiet editorial hierarchy with restrained typography, hairline separators, and compact factual metadata.
- Avoid dashboards made of repeated cards. Prefer a continuous document-like flow with grouped rows.
- Use color for status and risk, not decoration. Every color signal must have a text or icon equivalent.
- Preserve useful density on desktop while keeping the primary action and risk explanation readable at 200% zoom.

## Required states

Every screen or CLI-backed view must define loading, empty, partial, conflict, blocked, failure, success, and rollback states. Keyboard navigation, visible focus, semantic headings, and reduced motion are required.

## Onboarding sequence

1. Welcome and local-only promise
2. Runtime scan
3. Create or import profile
4. Profile inventory and consent
5. Conflict review
6. Exact change preview
7. Apply and verify
8. Finish, first-task check, rollback, and doctor

