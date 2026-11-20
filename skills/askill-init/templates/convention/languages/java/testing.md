# Testing behavior and durable effects

**Invariant:** A regression test holds time fixed at the contract boundary and observes committed state through the real transaction path.

**Compatibility:** Version-sensitive. Java 8+ has [`Clock.fixed`](https://docs.oracle.com/javase/8/docs/api/java/time/Clock.html#fixed-java.time.Instant-java.time.ZoneId-); declare `Instant`, `Clock`, and `Expiry` explicitly on Java 8–9 rather than using [Java 10 `var`](https://openjdk.org/jeps/286). The runner version is separate: [JUnit 5](https://docs.junit.org/5.13.4/user-guide/#overview-java-versions) can run the same Jupiter `@Test`/`assertThrows` fixtures starting at Java 8, while [JUnit 6](https://docs.junit.org/6.0.0/overview.html#java-versions) needs Java 17+ for the test runtime, independently of the code-under-test target. Use the project's configured version, and require the same deadline and rollback assertions in either setup.

## When to read

Read when fixing a bug or testing a Java service, expiry rule, or persistence transition. Use the repository wrapper and CI-configured unit/integration tasks. These examples assume JUnit Jupiter and use Unit–Scenario–Expected names plus Arrange–Act–Assert sections.

## Inject time and test the exact comparison boundary

Error-prone: the wall clock can move between setup and execution; sleeping only makes the race slower.

```java
@Test
void testExpiry() throws InterruptedException {
    var expiresAt = java.time.Instant.now().plusMillis(5);
    Thread.sleep(5);
    assertFalse(expiry.allows(expiresAt));
}
```

Recommended: `Expiry` accepts a `Clock` and implements the public rule that a request is allowed only strictly before `expiresAt`.

```java
@Test
void allows_atDeadline_returnsFalse() {
    var deadline = java.time.Instant.parse("2025-02-03T10:00:00Z");
    var clock = java.time.Clock.fixed(deadline, java.time.ZoneOffset.UTC);
    var expiry = new Expiry(clock);

    boolean allowed = expiry.allows(deadline);

    assertFalse(allowed);
}
```

Add neighboring before/after cases to catch both inverted comparison and off-by-one changes. If the rule depends on a local calendar day, supply the business zone and include a date with a zone transition; UTC only suffices for an instant-based deadline. Don't override JVM-wide time zone settings for local fixture needs.

## Assert durable behavior at the real transaction boundary

Error-prone: verifying a mock records intent, not a committed transaction or a rolled-back partial write.

```java
service.move("parcel-4", "zone-b");
verify(repository).save(any());
```

Recommended integration fragment: `integration` writes fixtures and reads from fresh transactions, and `service.move` writes the assignment first, then attempts the audit insert in the same transaction. The fixture makes that insert violate a real constraint.

```java
@Test
void move_auditInsertConflicts_keepsCommittedOriginalZone() {
    String parcel = integration.createParcelWithConflictingAudit("zone-a", "zone-b");

    assertThrows(MoveRejected.class, () -> service.move(parcel, "zone-b"));

    assertEquals("zone-a", integration.readZoneInFreshTransaction(parcel));
}
```

Use the configured integration DB and trigger the real transaction/commit path, including any production service proxy. Do not wrap this whole test in a rollback-only transaction if that changes when the constraint is reported. Flushing can expose a constraint but does not prove a commit; clearing a persistence context can prove a reread but not transaction isolation. Isolate fixture keys per case and clean them up through the integration harness.

## Verification and pass criteria

Run the targeted and full configured tasks. Temporarily invert the strict boundary or split the move into independently committed steps when checking regression sensitivity: the corresponding case must fail, then pass with correct behavior restored. Running cases alone or together must not change the result.
