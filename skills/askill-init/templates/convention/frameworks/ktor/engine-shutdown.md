# Engine shutdown

**Invariant:** Stop admission and drain accepted calls before releasing their dependencies, within the deployment deadline.

**Compatibility:** Engine-dependent behavior and Ktor API differences. JVM [EngineMain deployment settings](https://ktor.io/docs/server-configuration-file.html) are separate from [Ktor 3.0's embedded server and application lifecycle changes](https://ktor.io/docs/migrating-3.html).

**Acceptance check:** On the real engine, an accepted call that finishes within the window completes before store closure; an over-budget call does not prevent timely process exit.

## When to read

Read when changing deployment termination or configuring an EngineMain-based JVM application.

## Give the engine a bounded shutdown window

**Wrong —** a JVM shutdown hook that closes the store can race the engine's own shutdown and break calls already using the store.

```kotlin
Runtime.getRuntime().addShutdownHook(Thread { store.close() })
```

**Right —** configure shutdown at the engine, then attach dependency cleanup to the application lifecycle. In `application.conf` for an EngineMain deployment, for example:

```hocon
ktor.deployment {
    shutdownGracePeriod = 5000
    shutdownTimeout = 10000
}
```

- **Ktor 2.x:** Subscribe via `environment.monitor.subscribe(ApplicationStopped) { store.close() }`; `embeddedServer` returns `ApplicationEngine`.
- **Ktor 3.x:** Subscribe via `monitor.subscribe(ApplicationStopped) { store.close() }`; `embeddedServer` returns `EmbeddedServer`.

In either embedded branch, keep the returned owner and call its `stop(5_000, 10_000)` from the controlled shutdown path, rather than assuming EngineMain loaded these values. Verify the selected engine's implementation and allow time for shutdown hooks and cleanup.

```kotlin
fun Application.widgetModule() {
    val store = openWidgetStore()
    monitor.subscribe(ApplicationStopped) { store.close() }
    routing { widgetRoutes(store) }
}
```

## Tradeoffs and assumptions

Values are milliseconds and illustrative. The application owns this store. For `embeddedServer`, configure the owning engine and its stop path rather than assuming it reads the same file. Withdraw readiness through the deployment platform; budget for readiness propagation, engine shutdown, and cleanup before hard termination. Confirm the grace and timeout behavior on the actual engine; a long-lived stream may not finish in the window.

## Verification

On the deployed engine, hold a request after it starts using the store and send the platform's normal stop signal. Release the request within the grace period; check that its response completes before store closure. Repeat with a request that outlives the budget and verify the process terminates within the platform window and cleanup is observable.
