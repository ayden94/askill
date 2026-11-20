# Deterministic coroutine and stream tests

**Invariant:** Test retry and event behavior on a controlled scheduler, with an active subscriber and deterministic cleanup.

**Compatibility:** Version-sensitive in `kotlinx-coroutines-test`. [`runTest`, `StandardTestDispatcher` and `TestCoroutineScheduler`](https://github.com/Kotlin/kotlinx.coroutines/blob/1.6.4/kotlinx-coroutines-test/MIGRATION.md) arrived with 1.6.0; [`backgroundScope`](https://github.com/Kotlin/kotlinx.coroutines/blob/1.6.4/CHANGES.md#version-164) arrived in 1.6.4. On 1.6.0–1.6.3 launch the collector directly in the test and `cancelAndJoin()` it in `finally`. In an existing [JVM 1.5.x test setup](https://github.com/Kotlin/kotlinx.coroutines/blob/1.5.2/kotlinx-coroutines-test/README.md), use `runBlockingTest` with the same `TestCoroutineDispatcher` injected into the client; use its `advanceTimeBy` and `runCurrent`, and a fixture-owned collector cancelled and joined in `finally`. Check the retry just before and at its deadline and require an active collector before emission in all cases. Resolve compatible core/test artifacts, Kotlin compiler and test runner separately from the application's target; the coroutines JVM artifacts changed their bytecode target to Java 8 in [1.5.0](https://github.com/Kotlin/kotlinx.coroutines/blob/1.6.4/CHANGES.md#version-150).

## When to read

Read when verifying suspend code, retry timing, cancellation, `StateFlow`, or event delivery. Use the configured runner and compatible `kotlinx-coroutines-test` version; examples assume `runTest`, `TestCoroutineScheduler`, and `backgroundScope` are available. Test names describe unit, scenario, and expected behavior; blank lines separate Arrange, Act, and Assert.

## Share the scheduler and test a boundary, not a sleep

Error-prone: sleeping independently of the retry scheduler does not prove when a retry ran.

```kotlin
@Test
fun testRetry() = runTest {
    launch { client.refresh() }
    Thread.sleep(1000)
    assertEquals(2, transport.attempts)
}
```

Recommended: the fixture's transport fails once; `RetryClient.refresh` runs on its injected dispatcher and retries once after `delay(1_000)`. Use the test scope's scheduler for both the fixture and test. Imports for the fragment:

```kotlin
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

@OptIn(ExperimentalCoroutinesApi::class)
@Test
fun refresh_afterFirstFailure_retriesAtDeadline() = runTest {
    val transport = FailOnceTransport()
    val client = RetryClient(transport, StandardTestDispatcher(testScheduler))
    val refresh = launch { client.refresh() }
    testScheduler.runCurrent()
    assertEquals(1, transport.attempts)
    testScheduler.advanceTimeBy(999)
    assertEquals(1, transport.attempts)

    testScheduler.advanceTimeBy(1)
    testScheduler.runCurrent()

    assertEquals(2, transport.attempts)
    refresh.join()
}
```

The earlier assertions are setup checkpoints to establish the pre-deadline condition. Call `runCurrent()` at the final time because advancing time does not execute tasks scheduled exactly at its destination. Unsupplied `Dispatchers.IO` or `Default` work does not run on this virtual clock. Test real thread synchronization in a separate integration case. For cancellation, start on a known checkpoint, `cancelAndJoin`, advance beyond the next planned retry, and verify cleanup and no extra attempts.

## Assert current state or subscribe before testing an event

Error-prone: an unreplayed event emitted before collection is not guaranteed to arrive later.

```kotlin
screen.submit()
assertEquals(ScreenEvent.Submitted, screen.events.first())
```

Recommended: for a fixture exposing `events` as a replay-zero `SharedFlow`, start a collector and drain queued setup on the shared scheduler before invoking the producer. The `screen` uses this test's dispatcher where it launches work.

```kotlin
@Test
fun submit_withActiveCollector_deliversSubmitted() = runTest {
    val screen = createScreen(StandardTestDispatcher(testScheduler))
    val seen = mutableListOf<ScreenEvent>()
    backgroundScope.launch(StandardTestDispatcher(testScheduler)) {
        screen.events.collect { seen.add(it) }
    }
    testScheduler.runCurrent()

    screen.submit()
    testScheduler.runCurrent()

    assertEquals(listOf(ScreenEvent.Submitted), seen)
}
```

The event fixture needs no delays to emit; otherwise advance to the documented deadline or await a bounded signal. For `StateFlow`, read `state.value` after driving the scheduler to a meaningful checkpoint; slow collectors may skip intermediate values, and equal updates are conflated. If production promises delivery to absent or slow collectors, replay-zero alone does not implement that policy. Test the selected replay, buffering, or acknowledgment behavior separately.

## Verification and pass criteria

Run each case alone and in the configured suite. The retry must not start early, must finish on schedule, and must not run after cancellation. Removing the event emission must fail the event case; the test must finish without real-time sleeps, leaked collectors, or `Dispatchers.Main` overrides left in place.
