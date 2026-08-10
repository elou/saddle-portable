# Security policy

Saddle Portable version `0.1` is a local single-user tool. It does not provide authentication, remote access, cloud sync, team authorization, or organizational policy enforcement.

Do not publish a suspected secret, private profile, transaction backup, or real runtime file in a public issue. Send the maintainer the Saddle version, operating system, command or setup step, affected path category, and a minimal redacted reproduction.

Treat these reports as release-blocking:

- a secret, transcript, trust grant, permission rule, or machine-specific private path enters an exported bundle
- scan or preview changes a runtime file
- apply changes a file not listed in the accepted plan
- rollback does not restore pre-existing managed target content
- the setup service accepts a write without its session token or binds outside loopback
- an imported capability executes during any Saddle operation

The public reporting address must be added before the GitHub repository becomes public.
