# Privacy and local safety

Saddle operates on local files and does not include login, cloud sync, analytics, or team administration.

## Export exclusions

Saddle rejects or excludes:

- transcripts, conversation history, prompts, and telemetry
- tool inputs, outputs, payloads, and errors
- environment files, credentials, keys, tokens, cookies, and secret-bearing URLs
- runtime settings, permission allowlists, trust grants, MCP connection details, plugin state, notifications, and cron entries
- machine-specific absolute home paths
- generated runtime projections

File-name and content checks are a safety boundary, not a complete secret scanner. Review every selected module before you share a bundle.

## Personal context

Personal candidates remain off by default during onboarding. Customization may add any number of user-labeled personal entries; each becomes a separate module with explicit consent. Export and installation each require item-level consent, while runtime permissions remain unchanged. Consent controls where an entry is used—it does not restrict what the user may choose to personalize.

## Scripts

Saddle treats scripts as restricted text assets. Inventory, capture, export, import, projection, and verification never execute them. Destination execution trust is outside the portable profile.

## Local setup service

`saddle setup` binds only to loopback. Each process creates a random request token. API requests without the token fail. Responses disable caching and set a same-origin content-security policy.

Stop the setup process when the transfer is complete.

## Filesystem writes

Apply requires the digest of the current preview. Saddle checks the expected prior digest for every file before the first target mutation. A changed target stops the transaction.

Saddle writes a transaction journal and backups before apply. A failed apply reverses completed operations. Explicit rollback first verifies that every applied target is unchanged; it stops before any restore when a user or another process changed a target.

Report a local privacy or data-loss issue according to [SECURITY.md](../SECURITY.md).
