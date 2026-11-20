# Outbound HTTP timeouts

**Invariant:** Apply a budget to the dependency call without classifying request cancellation or unrelated failure as a dependency timeout.

**Compatibility:** Stable [client `HttpTimeout` recipe](https://ktor.io/docs/client-timeout.html) for Ktor 2.x and 3.x with a supporting engine; the example selects CIO, not a server engine. Timeout support varies by engine and timeout kind. Client `ContentNegotiation` and the JSON converter are separate from the timeout plugin.

**Acceptance check:** A delayed upstream returns the route's 504; an ordinary upstream error and explicit cancellation do not take the same path.

## When to read

Read when a route depends on a Ktor HTTP client and needs a defined budget and timeout response.

## Time the outbound exchange without relabeling cancellation

**Wrong —** catching all exceptions makes request cancellation, programming faults, and upstream timeouts look the same.

```kotlin
try {
    call.respond(upstream.get(inventoryUrl).body<Inventory>())
} catch (failure: Exception) {
    call.respond(HttpStatusCode.GatewayTimeout)
}
```

**Right —** configure the shared client with `HttpTimeout` and narrow the mapping to the expected request timeout.

```kotlin
val upstream = HttpClient(CIO) {
    install(HttpTimeout)
    expectSuccess = true
    install(ContentNegotiation) { json() }
}

get("/inventory") {
    val inventory = try {
        upstream.get(inventoryUrl) {
            timeout { requestTimeoutMillis = 700 }
        }.body<Inventory>()
    } catch (failure: HttpRequestTimeoutException) {
        call.respond(HttpStatusCode.GatewayTimeout, ApiError("inventory_timeout"))
        return@get
    }
    call.respond(inventory)
}
```

## Tradeoffs and assumptions

Client and server `ContentNegotiation` are different imports; alias as needed. Build and close the client at the owner boundary. The example has one dependency and no retries. Connect and socket timeouts are different knobs and can surface different exceptions; classify those separately if enabled and verify support on the chosen engine.

If also mapping socket timeouts on JVM, use the exception from the pinned line and rebuild at the [Ktor 3.0 cutover](https://ktor.io/docs/migrating-3.html#sockettimeoutexception-is-now-a-typealias):

- **Ktor 2.x:** Catch `io.ktor.client.network.sockets.SocketTimeoutException` for this Ktor socket timeout.
- **Ktor 3.x:** Catch `java.net.SocketTimeoutException` for the JVM typealias, scoped to the outbound operation.

This is not a change to the `HttpRequestTimeoutException` catch shown above. Keep retries and all attempts within the end-to-end budget, and do not treat a timeout as proof that an upstream write did not occur.

## Verification

Run a local upstream that holds a response past the budget, plus one that returns valid JSON promptly and one that returns an upstream error. Assert 504 with the documented code only for the timed-out exchange, and verify cancellation of a request does not get translated into that timeout path. Use bounded waits and leave slack for scheduler timing.
