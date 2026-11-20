# Resource ownership and exception translation

## When to read

Read when a method opens a stream, result set, connection, or similar resource, or when an adapter converts an I/O failure to a service failure. Check who acquires, consumes, and closes the resource, and which resources the framework owns.

## Consume lazy results inside the owner's scope

Error-prone: line iteration is lazy, but the underlying file closes as the method returns.

```java
static java.util.stream.Stream<String> nonEmptyLines(java.nio.file.Path path)
        throws java.io.IOException {
    try (var lines = java.nio.file.Files.lines(path)) {
        return lines.filter(line -> !line.isBlank());
    }
}
```

Recommended for large inputs: keep iteration in the resource owner's scope, passing one line at a time.

```java
static void forEachNonEmptyLine(java.nio.file.Path path,
                                java.util.function.Consumer<String> consumer)
        throws java.io.IOException {
    try (var lines = java.nio.file.Files.lines(path)) {
        lines.filter(line -> !line.isBlank()).forEachOrdered(consumer);
    } catch (java.io.UncheckedIOException e) {
        // Files.lines reports failures during traversal as unchecked I/O.
        // Preserve the wrapper: it may also carry a suppressed close failure.
        throw new java.io.IOException("could not complete line processing", e);
    }
}
```

Here the consumer is synchronous and does not itself throw `UncheckedIOException`; if that can happen, give consumer failures their own contract or separate reading from callback execution so they stay distinguishable. Already-consumed records are not rolled back if reading fails later. For bounded inputs, a materialized list may be simpler. If you return a resource-backed stream intentionally, do not close it before returning; document ownership and require caller-side try-with-resources. Conversely, don't close an injected resource merely because it implements `AutoCloseable`.

## Translate failure once and preserve the cause

Error-prone: this signature hides the storage fault from callers and leaks driver details if the public response reuses the message.

```java
catch (java.sql.SQLException failure) {
    throw new IllegalStateException(failure.getMessage());
}
```

Recommended at a storage adapter whose service contract declares `CatalogReadFailed`:

```java
catch (java.sql.SQLException failure) {
    throw new CatalogReadFailed("catalog read failed", failure);
}
```

```java
final class CatalogReadFailed extends RuntimeException {
    CatalogReadFailed(String message, Throwable cause) {
        super(message, cause);
    }
}
```

Catch outside the try-with-resources so cleanup completes before translation; if the body and close both fail, the first failure retains the suppressed cleanup error. At the transport boundary, map the service exception to a stable public error without DB names, SQL, or raw parameters. Never infer retry safety from a generic storage exception: writes can fail after reaching the database.

## Verification and pass criteria

Use a close-tracking resource in the adapter test layer. Run full consumption, a mid-read failure, and a body failure followed by a close failure. Cleanup must run once on each path; a simultaneous close error must be discoverable on the primary throwable even after translation. At the public boundary verify that the failure does not turn into an empty successful result or expose the raw cause.
