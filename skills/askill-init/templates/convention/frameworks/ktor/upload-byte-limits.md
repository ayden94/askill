# Upload byte limits

**Invariant:** Over-budget or interrupted uploads never publish, regardless of the advertised length.

**Compatibility:** Plugin availability gate at Ktor 3.0 (first stable `ktor-server-body-limit` in the [published artifact history](https://repo.maven.apache.org/maven2/io/ktor/ktor-server-body-limit/maven-metadata.xml)). This is a request-body receive limit, not the engine's multipart-item limit.

**Acceptance check:** At-cap publishes once; declared overflow, unknown-length overflow and interrupted reads never publish; both size violations map to 413.

## When to read

Read when an upload route needs a limit on bytes read, not just field validation.

## Scope the budget to the upload and consume through the limit

**Wrong —** an upload without a length skips the check, then `receive<ByteArray>()` can buffer the entire payload.

```kotlin
if ((call.request.contentLength() ?: 0) > uploadLimit) {
    call.respond(HttpStatusCode.PayloadTooLarge)
    return@post
}
uploads.publish(call.receive<ByteArray>())
```

**Right —** install `RequestBodyLimit` on the upload route and read via the receive pipeline. Stage privately until reading to EOF succeeds.

```kotlin
install(StatusPages) {
    exception<PayloadTooLargeException> { call, _ ->
        call.respond(HttpStatusCode.PayloadTooLarge, ApiError("upload_too_large"))
    }
}
routing {
    route("/imports") {
        install(RequestBodyLimit) { bodyLimit { 2L * 1024 * 1024 } }
        post {
            uploads.stage().use { stage ->
                stage.copyUntilEof(call.receiveChannel())
                stage.publish()
            }
            call.respond(HttpStatusCode.Created)
        }
    }
}
```

## Tradeoffs and assumptions

- **Ktor 3.x:** Install the matching `ktor-server-body-limit` artifact and [plugin](https://api.ktor.io/3.0.x/ktor-server-body-limit/io.ktor.server.plugins.bodylimit/-request-body-limit.html). Consume via `call.receiveChannel()` as above and merge the exception mapping into the existing `StatusPages` block.
- **Ktor 2.x:** Keep the route-local reader and stage in the handler. Optionally reject a declared length over the limit first. After `receiveChannel()`, loop with [`readAvailable(buffer, 0, buffer.size)`](https://api.ktor.io/2.3.x/ktor-io/io.ktor.utils.io/-byte-read-channel/read-available.html) into a fixed-size `ByteArray`. For each positive `n`, reject with a local `UploadTooLarge` (mapped to 413) if `n.toLong() > limit - total`; otherwise append those `n` bytes to staging and advance `total`. On `-1`, propagate `channel.closedCause` if present before publishing. Do not publish after any read, write, or cancellation failure.

The local stage is closeable and discards uncommitted content on close; `copyUntilEof` must propagate channel failures instead of treating them as EOF. Staging is necessary because bytes may reach the consumer before an over-limit failure. Budget aggregate staging separately; if accepting compressed content, verify which byte representation is limited and cap decoded output too.

## Verification

On the mounted route send exactly the cap, a declared body over the cap, and a length-unknown stream that crosses the cap. Verify the two excess requests produce 413 with no published data and that the first publishes once. Simulate an interrupted read on a real engine; assert the stage is discarded and never published.
