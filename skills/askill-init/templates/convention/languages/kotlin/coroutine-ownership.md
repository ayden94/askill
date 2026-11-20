# Coroutine ownership and cancellation

**Invariant:** Required child work completes or is cancelled with its caller; cancellation never produces a successful fallback.

**Compatibility:** Version-sensitive in `kotlinx-coroutines-core`, not the JVM target. [`currentCoroutineContext`](https://github.com/Kotlin/kotlinx.coroutines/blob/1.6.4/CHANGES.md#version-137) arrived in 1.3.7; the sample uses core 1.3.8+ for the [`ensureActive` empty-context fix](https://github.com/Kotlin/kotlinx.coroutines/blob/1.6.4/CHANGES.md#version-138). On core 1.3.0–1.3.7 use `kotlin.coroutines.coroutineContext[Job]?.ensureActive()` (import `Job` and `ensureActive` from `kotlinx.coroutines`). Both check the suspending caller's job, not an enclosing scope. The error-prone [`runCatching`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/run-catching.html) is a separate Kotlin stdlib 1.3 API, not a coroutine cancellation construct. In both variants, cancel the caller, join child cleanup, and verify the fallback was not invoked.

## When to read

Read when launching sibling operations, moving work off a UI thread, implementing a fallback, or changing the owner of background work. Check which job should cancel the work: a request, UI lifecycle, or application-owned worker.

## Keep required sibling work inside the caller's scope

Error-prone: the two `Deferred`s are born in a separately managed scope. Cancelling the caller's `await`, or failing one fetch, does not by itself make that scope's other work part of request cleanup.

```kotlin
suspend fun loadDashboard(id: String): Dashboard {
    val profile = appScope.async { profiles.fetch(id) }
    val quotas = appScope.async { limits.fetch(id) }
    return Dashboard(profile.await(), quotas.await())
}
```

Recommended: both fetches are required, so use a scope whose children complete before the function returns and whose child failure cancels its siblings.

```kotlin
suspend fun loadDashboard(id: String): Dashboard = coroutineScope {
    val profile = async { profiles.fetch(id) }
    val quotas = async { limits.fetch(id) }
    Dashboard(profile.await(), quotas.await())
}
```

Use sequential calls if one result determines whether to start the next. Use `supervisorScope` only for deliberate independent failures; convert expected failures inside the child or handle its `await` explicitly, since an uncaught failure escaping the supervisor body still cancels its children. Work meant to outlive this caller needs an explicit longer-lived owner, shutdown policy, and observable completion. A suspend function does not automatically make blocking I/O safe; confine blocking work at its adapter.

## Map expected failures without swallowing cancellation

Error-prone: `runCatching` captures cancellation along with other throwables, so unconditional fallback can run after the caller cancels.

```kotlin
suspend fun currentForecast(city: String): Forecast =
    runCatching { remote.fetch(city) }.getOrElse { cache.require(city) }
```

Recommended: this adapter permits stale fallback on its documented I/O failures, not cancellation, parsing bugs, or authorization errors.

```kotlin
import java.io.IOException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

suspend fun currentForecast(city: String): Forecast =
    try {
        remote.fetch(city)
    } catch (e: IOException) {
        // An adapter that aborts I/O on cancellation may surface an I/O error.
        currentCoroutineContext().ensureActive()
        cache.read(city) ?: throw e
    }
```

If the project needs a broader catch, explicitly rethrow `CancellationException`. Keep fallback work cancellable too: an activity check does not close the race with cancellation on a subsequent line. For a timeout owned by this layer, prefer an explicit local timeout operation (such as `withTimeoutOrNull` for a non-null success value) so external cancellation is not mistaken for an ordinary deadline. Use `finally` for cleanup; do not make the whole operation non-cancellable to protect one cleanup step.

## Verification and pass criteria

Suspend both dashboard fakes after signalling entry. Fail one and confirm the other reaches its `finally`; repeat by cancelling the parent and joining it. Neither path returns a partial dashboard. For forecasts, assert that recoverable I/O reads the available cache, a cache miss preserves the upstream failure, and cancellation of a suspended fetch does not call the cache or produce a forecast.
