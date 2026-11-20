# Java-facing JVM APIs

**Invariant:** A compatible Kotlin/JVM release preserves the exact Java-callable method descriptors and their documented default behavior.

**Compatibility:** Portable in the supported range of Kotlin/JVM. Explicit overloads and delegation need neither a newer JDK API nor a particular JVM bytecode level; [Kotlin default arguments alone](https://kotlinlang.org/docs/java-to-kotlin-interop.html#overloads-generation) do not declare the Java overload. Use the configured target, and test the emitted artifact rather than assuming that a Kotlin source call proves Java linkage.

## When to read

Read when Kotlin declares a JVM API used by Java source, frameworks, or already-compiled consumers.

Error-prone when Java callers already rely on `fetch(String)`: replacing the explicit overload with a Kotlin default argument does not preserve that ordinary Java overload.

```kotlin
class Catalog(private val load: (String, Int) -> String) {
    fun fetch(id: String, limit: Int = 20): String = load(id, limit)
}
```

Recommended: preserve the Java-callable signatures explicitly, and delegate the old behavior in one place.

```kotlin
class Catalog(private val load: (String, Int) -> String) {
    fun fetch(id: String): String = fetch(id, 20)

    fun fetch(id: String, limit: Int): String = load(id, limit)
}
```

Use `@JvmOverloads` for a new API when its generated trailing overloads are precisely the Java surface you want to support. Check generated JVM names for erased generics and properties as well as parameter/return types. This pattern preserves the stated Java method, not Kotlin synthetic default-call entry points if a default was already shipped. Keep `@Throws` declarations when checked exceptions are part of the Java source contract. Internal Kotlin-only APIs do not need Java overloads.

## Verification and pass criteria

Compile a Java fixture containing both `catalog.fetch("p1")` and `catalog.fetch("p1", 5)` against the artifact and check the loader receives 20 and 5 respectively. For an upgrade, run an already-compiled old Java fixture against the new artifact, and compare the published method descriptors with the release baseline.
