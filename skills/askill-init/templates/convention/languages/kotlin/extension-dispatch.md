# Extension dispatch

**Invariant:** If a contract depends on the runtime subtype, dispatch through that subtype's member rather than an extension selected by its static type.

**Compatibility:** Portable in the supported range. Static extension selection and virtual member dispatch are [language rules](https://kotlinlang.org/docs/extensions.html); the ordinary interface, data class, and list mapping require no newer API or specific JVM target.

## When to read

Read when adding an extension, overloading one for subtypes, or migrating behavior from an extension to a member.

Error-prone when row formatting should follow the actual subtype: extension overload selection follows the static receiver type.

```kotlin
interface Row
data class Header(val title: String) : Row

fun Row.label(): String = "Row"
fun Header.label(): String = title

fun render(rows: List<Row>): List<String> = rows.map { it.label() }
```

Recommended when each implementor owns its label: declare a member whose implementation is selected at runtime.

```kotlin
interface Row {
    fun label(): String
}

data class Header(val title: String) : Row {
    override fun label(): String = title
}

fun render(rows: List<Row>): List<String> = rows.map { it.label() }
```

Use a single extension for statically shared conveniences whose implementation does not rely on dynamic dispatch. If you cannot change a closed third-party hierarchy, an adapter that branches on the relevant variants can own the policy instead. A matching member takes precedence over an extension on recompilation; do not assume adding that member is behavior-neutral for consumers importing your extension.

## Verification and pass criteria

Pass the same `Header("Summary")` as `Header`, as `Row`, and inside `List<Row>`. Dynamic member behavior must render `Summary` in all three cases. For migration, recompile representative callers and compare any behavior that depended on an imported extension.
