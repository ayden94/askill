# Call correlation

**Invariant:** The edge establishes one request ID before guarded routes, and logs and response headers use that same ID.

**Compatibility:** Plugin-dependent on JVM Ktor 2.x and 3.x: install the matching `ktor-server-call-id` and `ktor-server-call-logging` artifacts and an MDC-capable backend. The [Ktor 3.0 migration](https://ktor.io/docs/migrating-3.html#calllogging-plugin-package-has-been-renamed) changes the logging package, not the correlation policy.

**Acceptance check:** Two calls with the same untrusted header, including a guarded rejection, have distinct generated response IDs and matching captured MDC values.

## When to read

Read when logs, response headers, and downstream work should share a request correlation ID.

## Establish one ID through CallId

**Wrong —** setting a header only in the handler leaves plugin rejections without correlation, and trusting the inbound value lets unrelated public calls share an ID.

```kotlin
get("/widgets") {
    val id = call.request.headers["X-Request-ID"] ?: UUID.randomUUID().toString()
    call.response.headers.append("X-Request-ID", id)
    call.respond(widgets.list())
}
```

- **Ktor 2.x:** Import `io.ktor.server.plugins.callloging.*` (the historical spelling).
- **Ktor 3.x:** Import `io.ktor.server.plugins.calllogging.*`.

Both branches use `io.ktor.server.plugins.callid.*` and the same [`CallId` setup](https://ktor.io/docs/server-call-id.html).

**Right —** establish the ID in the application pipeline and have logging read it from the same call.

```kotlin
install(CallId) {
    generate { UUID.randomUUID().toString() }
    replyToHeader("X-Request-ID")
}
install(CallLogging) {
    mdc("request_id") { call -> call.callId }
}
```

## Tradeoffs and assumptions

This edge generates its own ID and requires the project's matching CallId and CallLogging plugins and an MDC-capable log backend. If adopting IDs from a trusted proxy, enforce a bounded format and establish who strips unsolicited input. For outbound propagation, pass the ID explicitly rather than assuming a worker's logging context crosses process boundaries. Do not use it as a metric dimension or credential.

## Verification

Send two calls with the same inbound ID, one accepted and one rejected by an installed route guard. Assert each has a different generated response ID and that its captured call-log MDC matches that ID. If the application forwards the ID, verify the accepted call's fake gateway observes the same value.
