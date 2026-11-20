# Sealed model evolution

## When to read

Read when adding a sealed variant, exposing one to consumers, or decoding values that can be sent by a newer producer.

Assume `ReviewStatus` has `Pending`, `Approved`, and `Rejected`. Error-prone: the catch-all silently renders a future known variant as rejected.

```kotlin
fun label(status: ReviewStatus): String = when (status) {
    ReviewStatus.Pending -> "Pending"
    ReviewStatus.Approved -> "Approved"
    else -> "Rejected"
}
```

Recommended inside a module rebuilt with its consumers: enumerate the known variants. If the wire protocol is open, preserve an explicit unknown case at the decoding boundary.

```kotlin
sealed interface ReviewStatus {
    object Pending : ReviewStatus
    object Approved : ReviewStatus
    object Rejected : ReviewStatus
    data class Unknown(val code: String) : ReviewStatus
}

fun label(status: ReviewStatus): String = when (status) {
    ReviewStatus.Pending -> "Pending"
    ReviewStatus.Approved -> "Approved"
    ReviewStatus.Rejected -> "Rejected"
    is ReviewStatus.Unknown -> "Unknown"
}
```

Map supported tags explicitly and preserve a well-formed but unrecognized tag as `Unknown`; malformed messages remain errors. A new subtype can break downstream exhaustive `when` at source level and cause old compiled consumers to fail at runtime if they see that subtype. For separately released callers, design a stable open representation from the start or version the change. A catch-all is reasonable when grouping remaining outcomes is the actual contract and has its own tests.

## Verification and pass criteria

Feed each known tag, one well-formed future tag, and malformed input into the decoder; only the future tag maps to `Unknown`. Temporarily add a known variant and verify exhaustive first-party consumers require updates. For mixed versions, test a new producer against an old published consumer and verify the decoder does not hand it an unsupported subtype.
