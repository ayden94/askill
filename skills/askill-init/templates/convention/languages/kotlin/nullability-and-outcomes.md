# Nullability and explicit outcomes

**Invariant:** Convert platform nullability at the boundary, and represent distinguishable lookup outcomes without absorbing unexpected failures.

**Compatibility:** Version-sensitive in the language. [Sealed interfaces](https://kotlinlang.org/docs/whatsnew15.html#sealed-interfaces) became stable in Kotlin 1.5; on Kotlin 1.3–1.4 use `sealed class DocumentLookup` and inherit as `: DocumentLookup()` for all three nested variants. Keep exhaustive `when` expressions on both. The JVM mapping uses the same Java getter and Kotlin [`takeIf`](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin/take-if.html) (since 1.1); neither the sealed interface nor the mapping requires a newer JDK. Exercise found, missing, denied, and unexpected failure with either outcome type.

## When to read

Read when mapping unannotated Java APIs, validating a DTO, or choosing whether a store's public return type should be nullable. Start with the actual annotations and transport/storage state diagram.

## Pin down Java platform nullability at the adapter

Assume a legacy Java `RecipientRow.getEmail()` has no nullability annotation and can return null. Error-prone: Kotlin allows the platform type to flow into a non-null operation without enforcing the Java producer's contract.

```kotlin
fun toRecipient(row: RecipientRow): Recipient =
    Recipient(row.email.trim())
```

Recommended: explicitly receive a nullable value and check the data the domain requires.

```kotlin
data class Recipient(val email: String)
class InvalidRecipientRow(message: String) : RuntimeException(message)

fun toRecipient(row: RecipientRow): Recipient {
    val stored: String? = row.email
    val email = stored?.trim()?.takeIf { it.isNotEmpty() }
        ?: throw InvalidRecipientRow("recipient email is missing or blank")
    return Recipient(email)
}
```

This is a nonblank check, not full email validation; additional rules belong to the owning contract. A bad stored row should not automatically become client validation failure. If the Java source is yours, prefer declaring trustworthy nullability there too. Java collection contents can carry platform types independently of the outer reference; validate elements when their producer cannot guarantee them. If any Kotlin constructor can create a `Recipient` and nonblank is a domain invariant, enforce it in the type as well.

## Use a sealed outcome for actionable differences

Here `gateway.fetch` is nullable only for a missing document and throws `AccessDenied` when permission is denied. Error-prone:

```kotlin
suspend fun find(id: String): Document? =
    try {
        gateway.fetch(id)
    } catch (e: AccessDenied) {
        null
    }
```

Recommended for an internal consumer that must distinguish missing from forbidden:

```kotlin
sealed interface DocumentLookup {
    data class Found(val document: Document) : DocumentLookup
    object Missing : DocumentLookup
    object Forbidden : DocumentLookup
}

suspend fun find(id: String): DocumentLookup =
    try {
        gateway.fetch(id)?.let { DocumentLookup.Found(it) }
            ?: DocumentLookup.Missing
    } catch (e: AccessDenied) {
        DocumentLookup.Forbidden
    }
```

Handle the cases in an exhaustive `when` expression without a catch-all when adding a new outcome should force a caller review. A public access-control boundary may deliberately render forbidden as not found to avoid disclosing existence; make that mapping there, not in every data adapter. Do not absorb a timeout, cancellation, or unrelated failure into these variants.

## Verification and pass criteria

Map Java fixtures with null, whitespace-only, and padded nonblank email values. Invalid rows produce the named mapping failure; the valid case returns trimmed content. Then exercise found, missing, denied, and unexpected gateway failure. Consumer-visible outcomes match the contract, and unexpected failure still propagates. If the public route intentionally hides existence, assert identical public responses for denied and missing without losing the internal distinction.
