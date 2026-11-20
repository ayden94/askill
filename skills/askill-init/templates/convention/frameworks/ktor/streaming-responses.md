# Streaming responses

## When to read

Read when a route returns a large export and the client should see data as it becomes ready.

## Own the source inside the response producer

**Wrong —** the engine can invoke the writer later, after the route's `use` block has closed the cursor.

```kotlin
exports.open().use { rows ->
    call.respondBytesWriter(ContentType.Text.Plain) {
        writeFully(rows.nextLine()!!.encodeToByteArray())
    }
}
```

**Right —** tie the resource lifetime to the engine's writer callback, and use suspended writes rather than a detached producer.

```kotlin
get("/export") {
    call.respondBytesWriter(ContentType.Text.Plain.withCharset(Charsets.UTF_8)) {
        exports.open().use { rows ->
            while (true) {
                val line = rows.nextLine() ?: break
                writeFully("$line\n".encodeToByteArray())
                flush()
            }
        }
    }
}
```

## Tradeoffs and assumptions

`nextLine` is a suspending operation with bounded record size; the cursor closes in `use` even on failure. The engine owns the output channel. This contract permits partial output, so a producer error after headers cannot be turned into a normal JSON error. If source opening must choose an HTTP error, validate that prerequisite before starting the response or serve a completed artifact. Per-line flush improves latency at a throughput cost and does not defeat proxy buffering.

## Verification

With a real engine, pause the source after one line and assert a socket client can read that line before release. Disconnect the client, release the source if necessary to allow another write, and await its close signal with a deadline. Inject a later read failure and check that cleanup and stream failure are observable.
