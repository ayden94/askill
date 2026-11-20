# Readable transformations and explicit effects

## When to read

Read when changing collection projections, using several scope functions in one expression, or combining a transformation with storage, logging, or delivery. Check duplicate and ordering rules before choosing a collection operator.

## Make duplicate policy visible next to key extraction

Error-prone for an import where duplicate normalized codes indicate invalid input: `associateBy` keeps the last value, hiding the first row.

```kotlin
fun index(rows: List<ImportRow>): Map<String, ImportRow> =
    rows.associateBy { it.code.trim().uppercase() }
```

Recommended: pin down normalization, reject blank and duplicate keys, and return the index only if the whole batch passes.

```kotlin
import java.util.Locale

data class ImportRow(val code: String)

fun index(rows: List<ImportRow>): Map<String, ImportRow> {
    val byCode = linkedMapOf<String, ImportRow>()
    for ((position, row) in rows.withIndex()) {
        val code = row.code.trim().uppercase(Locale.ROOT)
        require(code.isNotEmpty()) { "blank item code at row ${position + 1}" }
        require(code !in byCode) { "duplicate item code at row ${position + 1}" }
        byCode[code] = row
    }
    return byCode
}
```

Use `associateBy` when last-wins is the intended contract, and `groupBy` when all collisions matter. The JVM normalization shown is locale-independent but is not Unicode canonical normalization or an ASCII allowlist; define equivalence before accepting arbitrary identifiers. A Kotlin read-only `Map` type is not a promise of deep immutability or a hard JVM mutation barrier; choose an appropriate immutable/public API if crossing an untrusted interop boundary.

## Give effects a name and an execution point

Error-prone: sequence mapping is lazy. Here a caller that only inspects the first item saves one label, while a caller traversing the same sequence twice repeats the writes.

```kotlin
fun createLabels(orders: List<Order>): Sequence<Label> =
    orders.asSequence().map { order ->
        buildLabel(order).also { labels.save(it) }
    }
```

Recommended for a bounded batch with eager writes: complete the transformation before starting any writes; keep effect order visible.

```kotlin
fun createLabels(orders: List<Order>): List<Label> {
    val prepared = orders.map(::buildLabel)
    for (label in prepared) {
        labels.save(label)
    }
    return prepared
}
```

This prevents writes if label preparation fails, but a later save can still leave a partial batch. Use a transaction when all writes must succeed together, or a streaming protocol with explicit partial-progress and retry semantics for large imports. A single `also` for an incidental effect in an eager expression can be readable; avoid layering `let`, `also`, and `apply` when that hides which value or receiver is being mutated.

## Verification and pass criteria

Index `[" a1 ", "A1"]` and a blank code; each invalid batch reports the appropriate row and produces no index. For distinct keys, values retain the intended mapping and encounter order. With a recording label store, fail the second preparation and assert zero saves; then run a valid batch, traverse the returned list twice, and assert exactly one save per label in input order.
