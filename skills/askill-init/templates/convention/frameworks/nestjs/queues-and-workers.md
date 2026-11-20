# Queue consumers and retry ownership

**Invariant:** Redelivery after failure or a lost acknowledgment produces at most one durable business effect per consumer and event; invalid jobs reach a visible terminal outcome.

**Compatibility:** The transaction example uses application-owned datastore ports and assumes atomic uniqueness and rollback. It is independent of Nest's HTTP adapter. Bull and BullMQ wire processors differently; use the package that owns the queue, its matching Redis client, and compatible Nest peers.

**Read when:** Only when the change touches background delivery, scheduled jobs, or worker lifecycle.

## Decision

Assume a job can be redelivered after committing but before acknowledgment. Put the processed marker and domain write in the same transaction. Scope keys to the correct consumer and event identity. Do not retry invalid payloads indefinitely.

## Bad

```ts
await ledger.credit(job.account, job.amount);
await processed.mark(job.id); // crash here can repeat the credit
```

## Good

```ts
const event = parseCreditEvent(job.data);
await db.transaction(async tx => {
  if (!await tx.processed.claimOnce('credit', event.id)) return;
  await tx.ledger.credit(event.account, event.amount);
}); // acknowledge only after commit
```

## Assumptions and exceptions

The example assumes an atomic unique claim and a single transactional datastore. `event.id` is the stable business event ID, not the broker job ID (republishing can create a new job). Report a permanently invalid event using the installed queue's terminal-failure mechanism rather than retrying it indefinitely. For external side effects that cannot participate, use a durable dispatch record and an idempotent receiver.

- **Bull (`@nestjs/bull` + `bull`):** use `@Processor('ledger')` with `@Process('credit')`; the decorated method returns the shared credit handler's promise.
- **BullMQ (`@nestjs/bullmq` + `bullmq`):** use `@Processor('ledger')` on a class extending `WorkerHost`; its `process(job)` dispatches `job.name === 'credit'` to the same handler and returns its promise. Do not use Bull's `@Process` with BullMQ or silently acknowledge an unrecognized name. See [Nest's queue consumer examples](https://docs.nestjs.com/application/queues#consumers).

Define how shutdown stops intake and drains or releases active jobs. For an application-owned BullMQ worker, [await `worker.close()`](https://docs.bullmq.io/guide/workers/graceful-shutdown) during shutdown; it stops taking new work and waits for active jobs, so configure a host grace period and test the forced-stop path too. Do not close a worker a second time if the integration owns its lifecycle.

## Verification

On either processor setup, deliver the same event concurrently under distinct job IDs, including redelivery after commit. Simulate a failure after the claim but before the write. Verify rollback allows one successful retry, durable balance changes once, acknowledgment follows commit, and a permanent failure is visible to operators. Stop the worker during a job and verify the documented drain or recovery behavior.
