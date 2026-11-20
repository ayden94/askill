# Queue consumers and retry ownership

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
await db.transaction(async tx => {
  if (!await tx.processed.claimOnce("credit", job.id)) return;
  await tx.ledger.credit(job.account, job.amount);
}); // acknowledge only after commit
```

## Assumptions and exceptions

The example assumes an atomic unique claim and a single transactional datastore. For external side effects that cannot participate, use a durable dispatch record and an idempotent receiver. Define final failure handling, visibility, and how shutdown stops intake while draining or releasing active jobs.

## Verification

Deliver the same event twice, including concurrent delivery. Simulate a failure after the claim but before the write. Verify rollback allows one successful retry, durable balance changes once, and a permanent failure is visible to operators.
