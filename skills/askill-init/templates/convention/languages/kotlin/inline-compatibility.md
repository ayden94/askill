# Public inline compatibility

**Invariant:** Separately built clients keep linking, and library-controlled policy lives outside consumer-inlined code.

**Compatibility:** Portable in the supported range of Kotlin/JVM with [`@PublishedApi`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/-published-api/) (since Kotlin 1.1); the JVM class token is not a newer JDK feature. The same wrapper and helper apply across that range, but changing the compiler or JVM target does not waive the old-binary linkage check.

## When to read

Read when publishing or changing a public inline/reified API used by modules that may not rebuild with the library.

Assume an existing JVM API and a `Decoder` whose format defaults should follow the installed library. Error-prone: the literal default embedded in the inline body can remain in old consumers.

```kotlin
inline fun <reified T> Decoder.decode(text: String): T =
    readAs(text, T::class.java, strict = false)
```

Recommended for a new API: keep only type-token capture in the inline wrapper; dispatch to a stable non-inline entry point that owns the library-controlled policy.

```kotlin
inline fun <reified T> Decoder.decode(text: String): T =
    decodeWithType(text, T::class.java)

@PublishedApi
internal fun <T> Decoder.decodeWithType(text: String, type: Class<T>): T =
    readAs(text, type, strict = false)
```

`@PublishedApi` lets generated consumer code call the helper; treat its JVM name and signature as binary API even though Kotlin source marks it internal. A `Class<T>` token does not carry nested type arguments; use the decoder's richer token when generic payloads require it. If no reification is needed, prefer an ordinary function. A previously inlined policy cannot be recalled from old artifacts: preserve prior linkage and document which changes require recompilation and which are behavior-compatible.

## Verification and pass criteria

Compile a fixture against the initial wrapper version, then execute it against a library-only update that changes the helper's policy in a test fixture. The old caller must observe the new helper behavior without recompiling. Verify the helper signature survives the upgrade and test generic payloads separately if the API claims to support them.
