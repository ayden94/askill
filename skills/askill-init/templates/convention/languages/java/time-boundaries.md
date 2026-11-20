# Time and zone boundaries

## When to read

Read when a local schedule becomes an instant, an interval is measured, or timestamps cross a wire or database boundary.

Error-prone when callers must correct ambiguous input: `atZone` can shift a local time in a gap or choose an offset in an overlap.

```java
static java.time.Instant resolve(java.time.LocalDateTime local, java.time.ZoneId zone) {
    return local.atZone(zone).toInstant();
}
```

Recommended for a booking input that requires one unambiguous instant:

```java
static java.time.Instant resolve(java.time.LocalDateTime local, java.time.ZoneId zone) {
    var offsets = zone.getRules().getValidOffsets(local);
    if (offsets.size() != 1) {
        throw new IllegalArgumentException("booking time must have exactly one valid offset");
    }
    return local.toInstant(offsets.get(0));
}
```

Take the business zone from the booking, not the host. Compare persisted instants at the agreed precision; a store that discards fractions can change a deadline comparison. Use `System.nanoTime()` differences for an elapsed budget inside one process, not for timestamps. If the business explicitly chooses a gap-shift or overlap policy, implement and name it; a recurring civil schedule may need to retain local time and zone rather than freezing a future UTC instant.

## Verification and pass criteria

For `America/New_York`, reject `2025-03-09T02:30` and `2025-11-02T01:30`; resolve `2025-11-02T03:30` to `2025-11-02T08:30:00Z`. Round-trip an instant with excess fractional digits through the actual storage adapter and assert the documented precision and comparison at the boundary.
