# Flow sharing and lifecycle

**Invariant:** Active collectors share one upstream subscription owned by the screen; the last departure starts a bounded grace period, then the upstream closes and the cached value resets.

**Compatibility:** Version-sensitive. [`stateIn`](https://github.com/Kotlin/kotlinx.coroutines/blob/1.6.4/CHANGES.md#version-140-m1) and the [millisecond `WhileSubscribed` policy](https://github.com/Kotlin/kotlinx.coroutines/blob/1.4.0/kotlinx-coroutines-core/common/src/flow/SharingStarted.kt) shipped in `kotlinx-coroutines-core` 1.4.0; the sample's [trailing commas](https://kotlinlang.org/docs/whatsnew14.html#trailing-comma) separately require Kotlin 1.4 syntax. On a supported pre-1.4 core with Flow, use a single screen-scope coordinator to serialize subscription changes. Start one upstream job on demand and broadcast updates to per-subscriber conflated channels seeded with the cached value (`null` initially). On last departure start a 5-second timer; invalidate it if someone resubscribes. On expiry, cancel and join the upstream and reset the cache before starting another job; ignore any queued updates from the stopped job. Close the channels and cancel child work on screen shutdown. Run the same two-collector, grace-period, reset, and scope-cancellation checks on either design.

## When to read

Read when several collectors observe one upstream connection or a screen should stop work when it loses its last collector.

Assume `repository.observeCount()` is a cold `Flow<Int>` that opens a new subscription per collection and closes it on cancellation. Error-prone when the source should be shared and started only while observed:

```kotlin
val count: Flow<Int> = repository.observeCount()
```

Recommended for screen state: share in the scope owned by the screen model. Here `null` means not currently loaded, not zero.

```kotlin
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

val count: StateFlow<Int?> = repository.observeCount()
    .map<Int, Int?> { it }
    .stateIn(
        scope = screenScope,
        started = SharingStarted.WhileSubscribed(
            stopTimeoutMillis = 5_000,
            replayExpirationMillis = 0,
        ),
        initialValue = null,
    )
```

The grace period avoids reconnects for short gaps; once stopped, the cached state resets to `null`. The consumer must actually stop collecting when invisible using the host's lifecycle integration; a long-lived observer keeps the upstream alive. Sharing scope cancellation is independent of subscriber count and ends the sharing job. Use a cold flow if subscriptions intentionally have independent inputs or lifetimes. Use an explicitly longer-lived owner if the upstream must stay running without a screen.

## Verification and pass criteria

With one test scheduler and a counting upstream, start two collectors: only one subscription opens. Cancel both; at 4,999 ms it is still open, and at 5,000 ms after scheduled work runs it closes and the value resets. Resubscribe and assert a fresh connection; cancel the screen scope and assert cleanup without waiting for the grace period.
