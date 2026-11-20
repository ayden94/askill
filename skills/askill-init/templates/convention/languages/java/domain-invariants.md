# Domain invariants and collection ownership

**Invariant:** An aggregate owns its stored and returned snapshots and rejects every construction or transition that would violate its domain rules.

**Compatibility:** Version-sensitive. Java 16+ supports the [record](https://openjdk.org/jeps/395) declarations as shown; on earlier targets use final classes with private final fields, validating constructors and accessors (and value equality if exposed). Below Java 10 [`List.copyOf`/`Set.copyOf`](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/util/List.html#copyOf(java.util.Collection)), null-check each element while creating a new `ArrayList` or `HashSet`, then wrap that private copy with `Collections.unmodifiableList` or `unmodifiableSet`; don't wrap the caller's input. Also use declared local types below [Java 10 `var`](https://openjdk.org/jeps/286). Below Java 11 [`isBlank`/`strip`](https://docs.oracle.com/en/java/javase/11/docs/api/java.base/java/lang/String.html#strip()), test `text.codePoints().allMatch(Character::isWhitespace)` on Java 8–10 and strip draft edges with `text.replaceAll("\\A\\p{javaWhitespace}+|\\p{javaWhitespace}+\\z", "")`, not `trim()`, which uses a different character rule. In either version, test source mutation, empty/blank/null labels, Unicode whitespace, and last-seat rejection.

## When to read

Read when constructing a value from collections or editing a state transition that must preserve business rules. Check how the aggregate is created and reconstructed, including persistence hydration and serialization.

## Snapshot the data you own, not just the outer API

Error-prone: the caller can still mutate the list through its own reference, and the accessor returns mutable elements through the view.

```java
record StopDraft(StringBuilder label) {}

record Route(List<StopDraft> stops) {
    Route {
        stops = Collections.unmodifiableList(stops);
    }
}
```

Recommended: convert editing objects at the boundary and store only immutable route elements. This example accepts trimmed, nonblank labels and requires at least one stop.

```java
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

record StopDraft(StringBuilder label) {}

record Route(List<String> stops) {
    Route {
        stops = List.copyOf(stops);
        if (stops.isEmpty() || stops.stream().anyMatch(String::isBlank)) {
            throw new IllegalArgumentException("route requires nonblank stops");
        }
    }

    static Route fromDrafts(List<StopDraft> drafts) {
        var labels = new ArrayList<String>(drafts.size());
        for (StopDraft draft : drafts) {
            labels.add(Objects.requireNonNull(draft.label()).toString().strip());
        }
        return new Route(labels);
    }
}
```

Here direct construction requires nonblank labels but preserves their exact text; trimming is the draft mapping policy. If canonical whitespace is a domain invariant instead, normalize or reject it in the constructor for every caller. `List.copyOf` rejects null elements and is shallow; array, buffer, or mutable object elements need their own snapshot policy. Do not snapshot a collection concurrently mutated by another thread without coordination. A live view is reasonable for a deliberately shared model, but state that lifetime and mutability explicitly.

## Put state changes behind domain operations

Error-prone: the caller can remove the last seat, and a check elsewhere cannot enforce the rule for every future caller.

```java
final class Booking {
    final java.util.Set<String> seats = new java.util.HashSet<>();
}
```

Recommended: make illegal transitions unrepresentable through the public methods, and state what removal of an absent seat does.

```java
final class Booking {
    private final java.util.Set<String> seats = new java.util.HashSet<>();

    Booking(String firstSeat) {
        seats.add(java.util.Objects.requireNonNull(firstSeat));
    }

    boolean release(String seat) {
        if (!seats.contains(seat)) return false;
        if (seats.size() == 1) {
            throw new IllegalStateException("cannot release the last seat");
        }
        return seats.remove(seat);
    }

    java.util.Set<String> seats() {
        return java.util.Set.copyOf(seats);
    }
}
```

This example is thread-confined: the size check and removal are not an atomic database or multithreaded operation. For shared bookings, enforce the transition through the project's transaction/concurrency mechanism. Use a domain-specific rejection if remaining-seat conflicts are part of a public business API. If an ORM bypasses constructors, keep persistence constraints and mapping checks aligned rather than assuming constructors run.

## Verification and pass criteria

Build a route from mutable drafts, then change the original list and a builder; the stored labels and order must not change. Direct construction with empty or blank input fails. For a one-seat booking, release an absent seat and then the sole seat: the former returns false, the latter is rejected, and the original seat remains visible.
