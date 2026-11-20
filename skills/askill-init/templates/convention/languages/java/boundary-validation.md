# Boundary validation and absence

**Invariant:** Only contractually absent input defaults or yields not-found; malformed values and failed reads remain distinct failures.

**Compatibility:** Portable in the supported range of Java 8 and later: the lookup uses [`Optional.ofNullable`](https://docs.oracle.com/javase/8/docs/api/java/util/Optional.html) from Java 8, and the parser and checked exception require no newer API or syntax.

## When to read

Read before changing input from HTTP, configuration, or another service, or redesigning a lookup that can return no row. Use the wire schema and the project's error translation as the source of truth.

## Parse explicitly instead of defaulting malformed values

Error-prone: this catch turns malformed input into an accepted request and lets an out-of-range integer through.

```java
static int pageSize(String raw) {
    try {
        return Integer.parseInt(raw);
    } catch (NumberFormatException ignored) {
        return 25;
    }
}
```

Recommended: this endpoint defaults only an omitted field (`null` from the adapter), accepts unsigned ASCII decimal text, and reports range and overflow as invalid input.

```java
static int pageSize(String raw) {
    if (raw == null) return 25;
    if (!raw.matches("[0-9]+")) {
        throw new IllegalArgumentException("page size must use decimal digits");
    }
    final int value;
    try {
        value = Integer.parseInt(raw);
    } catch (NumberFormatException cause) {
        throw new IllegalArgumentException("page size must be in 1..100", cause);
    }
    if (value < 1 || value > 100) {
        throw new IllegalArgumentException("page size must be in 1..100");
    }
    return value;
}
```

Map this particular parser failure to the transport's invalid-field response at the call site; do not label every `IllegalArgumentException` thrown anywhere in the service as client error. The transport should bound input size before parsing. If explicit JSON `null` and omission mean different things, let the decoder carry field presence instead of collapsing both into a nullable string.

## Keep absence separate from failure

In these fragments `repository.read(id)` returns a nullable `Item` and throws `java.io.IOException` on storage failure. Error-prone:

```java
Optional<Item> find(String id) {
    try {
        return Optional.ofNullable(repository.read(id));
    } catch (IOException ignored) {
        return Optional.empty();
    }
}
```

Recommended when the service is allowed to expose checked I/O failures:

```java
Optional<Item> find(String id) throws IOException {
    return Optional.ofNullable(repository.read(id));
}
```

If the service signature must be storage-agnostic, translate the I/O failure to a service error with its cause, as in [resource ownership](resource-ownership.md). An empty successful lookup is not a timeout, permission denial, or corrupt result. Use a richer outcome if callers must handle more than ordinary absence and success; when overriding a framework interface, honor its declared contract.

## Verification and pass criteria

Send omitted, empty, whitespace-padded, `+1`, `0`, `1`, `100`, `101`, and overflow-sized values through the actual adapter. Omission gives 25, `1` and `100` are accepted, and the rest get a field error without calling downstream logic. Separately simulate a missing row and a read failure: only a missing row takes the not-found path, and the I/O cause remains available internally.
