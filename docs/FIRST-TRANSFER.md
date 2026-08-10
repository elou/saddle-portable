# First transfer

Use a disposable destination account or test home directory for the first transfer. Do not point version `0.1.0` at the primary home directory until this checklist passes.

## Source computer

1. Install the packed or tagged package.
2. Run `saddle setup`.
3. Inventory Claude, Codex, or both.
4. Confirm that dev-server safety and session-continuity sections appear as separate candidates.
5. Confirm that personal context and script-bearing capabilities are off.
6. Create the neutral profile outside the runtime directories.
7. Open `saddle.profile.json` and every selected source file.
8. Search the bundle for the source username, home path, common token prefixes, `transcript`, `settings`, `permission`, `trust`, and `mcp`.
9. Export the profile to a new path that does not exist yet. Pass explicit consent only for items you intend to transfer.

If any private or machine-specific value appears, stop and keep the bundle on the source computer.

## Destination computer

1. Install the same Saddle version.
2. Copy the exported bundle to a local directory.
3. If the first task must resume an existing project, copy or reconnect that project's durable dashboard and session notes separately. Saddle does not include session history in the operating profile.
4. Run `saddle setup` and select **Use an existing profile**.
5. Preview every target, action, reason, risk, module list, and proposed content block. Confirm that only selected runtime roots and namespaced capability paths appear.
6. Confirm each personal or restricted module on the destination computer.
7. Apply the accepted plan.
8. Run doctor and require `exact` for each selected runtime.
9. Start a disposable first task in each runtime.
10. Confirm that the runtime reads the operating policy and follows the continuity procedure. If project notes were copied or reconnected, confirm that it reads the latest note.
11. Simulate a context reset. Confirm that the runtime saves a checkpoint before reset and reloads it after reset.
12. Run rollback and confirm that unmanaged global instructions match their pre-transfer contents. Rollback must stop if a managed target changed after apply.

## Evidence to record

Record the source and destination operating systems, Node and npm versions, Saddle commit or tag, selected modules, plan digest, transaction id, doctor output, first-task result, rollback result, and any manual step.
