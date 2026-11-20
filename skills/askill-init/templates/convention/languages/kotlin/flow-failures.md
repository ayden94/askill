# Flow failure and retry boundaries

**Invariant:** Retry only documented recoverable upstream failures; neither downstream failures nor cancellation may trigger retry or successful fallback.

**Compatibility:** Portable in the supported range for projects using stable Flow with `kotlinx-coroutines-core` 1.3.0 or later. [`catch` and `retryWhen`](https://github.com/Kotlin/kotlinx.coroutines/blob/1.6.4/CHANGES.md#version-130-m2) were already in the 1.3.0 release cycle; they do not require a newer sharing API or particular JVM bytecode level. The `IOException` example is JVM-specific; use the equivalent typed adapter failure on another target.

## When to read

Read when adding stream recovery, retry, or fallback, especially before converting a cold source into shared state.

Assume `fetchListings()` is an idempotent snapshot read. Error-prone: catching inside `flow` also wraps the call to `emit`, where a downstream failure can surface. Treating every failure as a successful empty listing also hides real bugs.

```kotlin
fun listings(): Flow<ListingState> = flow {
    try {
        emit(ListingState.Ready(fetchListings()))
    } catch (failure: Exception) {
        emit(ListingState.Unavailable)
    }
}
```

Recommended on JVM when only the adapter's documented transient `IOException`s should be retried and rendered unavailable:

```kotlin
import java.io.IOException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.retryWhen

fun listings(): Flow<ListingState> = flow<ListingState> {
    emit(ListingState.Ready(fetchListings()))
}.retryWhen { failure, attempt ->
    if (failure !is IOException || attempt >= 1) return@retryWhen false
    delay(250)
    true
}.catch { failure ->
    if (failure !is IOException) throw failure
    emit(ListingState.Unavailable)
}
```

Place those operators upstream of sharing and near the recoverable read; they do not handle downstream consumer failures or flow cancellation. Retry recollects the upstream and can repeat earlier emissions or effects. Do not add automatic retry to a non-idempotent operation without a deduplication/checkpoint contract. If the adapter uses `IOException` for permanent failures too, classify before retrying. If callers must own recovery, expose the original failure instead.

## Verification and pass criteria

Test transient failure followed by success, two transient failures, an unexpected upstream error, a throwing collector, and cancellation during the delay. Expect at most two fetches, fallback only on exhausted transient failure, no retry on collector failure, and no second fetch after cancellation.
