# Spring Boot scheduled work and overlap

**Invariant:** A slow run does not queue overlapping local batches, and concurrent replicas cannot overwrite rows that left the eligible state.

**Scope:** Portable for synchronous Spring `@Scheduled` fixed-delay work; it is not a guarantee for async/reactive callbacks or a cluster-wide lock.

**Read when:** A periodic operation runs longer than its interval or begins running on multiple application replicas.

## Decision

For bounded synchronous maintenance, let a fixed-delay callback finish before the next delay begins. Don't hand it blindly to another executor: the registered callback's completion is then submission, not work completion. Treat every replica as a separate scheduler; protect the write with a database-side precondition or use the deployment's single-owner scheduling mechanism.

## Bad

```java
@Scheduled(fixedDelayString = "${drafts.sweep-delay:PT1M}")
void sweep() {
    executor.execute(() -> drafts.expireBefore(clock.instant()));
}
```

Slow runs can queue repeatedly. Adding another replica doubles submissions rather than sharing ownership.

## Good

```java
@Component
class DraftSweep {
    private final DraftMaintenance drafts;
    private final Clock clock;

    DraftSweep(DraftMaintenance drafts, Clock clock) {
        this.drafts = drafts;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${drafts.sweep-delay:PT1M}")
    void sweep() {
        drafts.expireBatch(clock.instant(), 500);
    }
}
```

## Assumptions and exceptions

Scheduling is already enabled and `DraftMaintenance` is a separate, injected transactional service. It limits each batch, applies query timeouts, and rechecks `status = DRAFT` and the cutoff in the update predicate. Duplicate attempts across replicas are harmless here; fixed delay is not a cluster lock. Separate long-running jobs from scheduling threads if `sweep()` would starve unrelated jobs, and bound the worker handoff rather than using an unbounded queue.

## Verification

Hold a fake batch with a latch in a local scheduling configuration with a short delay; verify only one invocation enters during the block, then release and verify the next invocation. Separately invoke the real batch concurrently from separate transactions on the intended database, including a draft that just became published. Verify the total number of actual transitions equals eligible rows and the published state remains unchanged.
