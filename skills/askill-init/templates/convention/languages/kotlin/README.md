# Kotlin rulebook

Start with the module's Kotlin compiler, target platform, and dependency versions. JVM interop examples are JVM-only. Coroutine examples apply to projects already using `kotlinx.coroutines`; use the installed core and test APIs rather than adding or upgrading a dependency for these examples.

| If you are changing… | Read |
| --- | --- |
| Nullable inputs, Java platform types, or distinct lookup outcomes | [Nullability and explicit outcomes](nullability-and-outcomes.md) |
| Concurrent suspend functions, timeout behavior, or lifecycle cleanup | [Coroutine ownership and cancellation](coroutine-ownership.md) |
| Collection mappings, nested scope functions, or effect order | [Readable transformations and explicit effects](transformations.md) |
| Suspend, cancellation, state, or event tests | [Deterministic coroutine and stream tests](testing.md) |

For a coroutine-driven lookup, start with the caller-visible outcomes, then decide which scope owns the work and tests its cancellation.
