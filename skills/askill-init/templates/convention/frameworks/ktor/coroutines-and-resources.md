# Coroutine and resource lifetimes

## When to read

Read when starting concurrent work in a route, invoking a blocking client, or introducing a shared resource that must shut down with the application.

## Keep request work structured

**Wrong —** the detached operation can start or fail after the server has already reported success.

```kotlin
post("/reports") {
    val input = call.receive<ReportRequest>()
    GlobalScope.launch { reports.generate(input) }
    call.respond(HttpStatusCode.Created)
}
```

**Right —** await results required by the response. Use a child scope only when the operations are independent and concurrency is useful.

```kotlin
post("/reports") {
    val input = call.receive<ReportRequest>()
    val report = coroutineScope {
        val summary = async { reports.summary(input) }
        val totals = async { reports.totals(input) }
        reports.combine(summary.await(), totals.await())
    }
    call.respond(HttpStatusCode.OK, report)
}
```

Cancellation of the request coroutine cancels its children. Do not assume a particular engine or proxy immediately converts every peer disconnect into coroutine cancellation; check the deployed path if this behavior matters. Move a legacy blocking operation onto the project's I/O dispatcher and apply the driver's own timeout; moving threads alone does not make blocking I/O promptly cancellable.

## Own long-lived dependencies in the application assembly

**Wrong —** creating an `HttpClient` per call discards connection reuse and never closes the client in this example.

```kotlin
get("/weather") {
    val gateway = WeatherGateway(HttpClient(CIO))
    call.respond(gateway.current())
}
```

**Right —** construct the client once, register cleanup at the owning lifecycle, and inject the gateway into routes.

```kotlin
fun Application.weatherModule() {
    val client = HttpClient(CIO)
    monitor.subscribe(ApplicationStopped) { client.close() }
    val gateway = WeatherGateway(client)
    routing {
        get("/weather") { call.respond(gateway.current()) }
    }
}
```

This module owns the client it allocates. A module that receives a client from an outer runtime should not close it independently. Configure request and connection timeouts at the client boundary.

## Exceptions and tradeoffs

For durable asynchronous work, acknowledge only after enqueue succeeds and use 202 if the API means “accepted, not complete.” A non-durable background job needs an explicit application-owned scope, shutdown behavior, and error reporting; never carry `ApplicationCall` into it. Close streaming resources in `finally` because errors and cancellation can bypass the successful path.

## Verification and pass criteria

Use fakes with `CompletableDeferred` entry and exit signals. Start the operation, wait for both children to enter, fail one, and wait with a deadline for the blocked sibling's `finally`. Pass when the sibling releases its resource and no success is reported. Stop a test application with an instrumented owned resource; pass when it closes once and injected externally owned resources remain open.
