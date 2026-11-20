# Kotlin rulebook

Read only the leaves that apply to the change; choose multiple rows when contracts overlap. Start with the module's Kotlin compiler, target platform, and dependency versions. JVM interop examples are JVM-only. Coroutine examples apply to projects already using `kotlinx.coroutines`; use the installed core and test APIs rather than adding or upgrading a dependency for these examples.

| If you are changing… | Read |
| --- | --- |
| Nullable inputs, Java platform types, or distinct lookup outcomes | [Nullability and explicit outcomes](nullability-and-outcomes.md) |
| Concurrent suspend functions, timeout behavior, or lifecycle cleanup | [Coroutine ownership and cancellation](coroutine-ownership.md) |
| Collection mappings, nested scope functions, or effect order | [Readable transformations and explicit effects](transformations.md) |
| Suspend, cancellation, state, or event tests | [Deterministic coroutine and stream tests](testing.md) |
| Cold streams, shared subscriptions, or visibility changes | [Flow sharing and lifecycle](flow-lifecycle.md) |
| Retrying or recovering a failing stream | [Flow failure and retry boundaries](flow-failures.md) |
| A Kotlin API called from Java | [Java-facing JVM APIs](java-interop.md) |
| New variants or version skew in a sealed model | [Sealed model evolution](sealed-evolution.md) |
| Published state snapshots or concurrent reducers | [Immutable state snapshots](immutable-state.md) |
| Extension dispatch or extension receiver contracts | [Extension dispatch](extension-dispatch.md) |
| A public inline or reified library API | [Public inline compatibility](inline-compatibility.md) |

For a coroutine-driven lookup, start with the caller-visible outcomes, then decide which scope owns the work and tests its cancellation.
