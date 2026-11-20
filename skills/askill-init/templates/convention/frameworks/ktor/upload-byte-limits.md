# Upload byte limits

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

Use the matching `ktor-server-body-limit` artifact if present. Merge the status mapping into the application's existing `StatusPages` block. The local stage is closeable and discards uncommitted content on close; `copyUntilEof` honors channel failures and does not turn them into EOF. Staging is necessary because bytes may reach the consumer before an over-limit failure. Budget aggregate staging separately; if accepting compressed content, verify which byte representation is limited and cap decoded output too.

## Verification

On the mounted route send exactly the cap, a declared body over the cap, and a length-unknown stream that crosses the cap. Verify the two excess requests produce 413 with no published data and that the first publishes once. Simulate an interrupted read on a real engine; assert the stage is discarded and never published.
