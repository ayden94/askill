# Testing Ktor

**Invariant:** The route-contract test runs the production module once and asserts both the wire outcome and committed effects.

**Compatibility:** Ktor test-host migration at 2.0 (new API) and 3.0 (legacy API removed and module auto-loading changed); use the matching `ktor-server-test-host` version. See the [Ktor 3.0 testing migration](https://ktor.io/docs/migrating-3.html#testing).

**Acceptance check:** The mounted production route accepts a well-formed write exactly once and returns the exact malformed-body error without writing.

## When to read

Read when changing routing, installed plugins, authentication, negotiation, or HTTP failure behavior.

## Load the real module with a controlled dependency

**Wrong —** recreating an endpoint in the test does not exercise the production route or its plugins.

```kotlin
@Test
fun createWidget() = testApplication {
    routing { post("/widgets") { call.respond(HttpStatusCode.Created) } }
    assertEquals(HttpStatusCode.Created, client.post("/widgets").status)
}
```

**Right —** load the production module with a fake service and exercise it over the test client's HTTP boundary.

```kotlin
@Test
fun `create widget with valid body writes once`() = testApplication {
    val widgets = RecordingWidgets()
    application { widgetModule(widgets) }

    val response = client.post("/widgets") {
        contentType(ContentType.Application.Json)
        setBody("""{"name":"dial"}""")
    }

    assertEquals(HttpStatusCode.Created, response.status)
    assertEquals(listOf("dial"), widgets.createdNames)
}
```

- **Ktor 1.x legacy test host:** Use `withTestApplication({ widgetModule(widgets) })` and `handleRequest(HttpMethod.Post, "/widgets") { addHeader(HttpHeaders.ContentType, "application/json"); setBody(rawJson) }`. Assert `response.status()` and `response.content` as well as the fake's writes. Use that line's compatible server module imports and test artifact.
- **Ktor 2.x:** Prefer `testApplication` with the HTTP client as shown; the old functions are deprecated. The host can load modules from default config, so set `environment { config = MapApplicationConfig() }` when explicitly injecting `widgetModule(widgets)` and supply needed settings there.
- **Ktor 3.x:** Use `testApplication` as shown; default config no longer auto-loads the module and `withTestApplication` is removed. Alternatively set `environment { config = ApplicationConfig("application-test.conf") }` to load configured modules; omit the explicit install of the same module.

Keep fakes scoped to a test and make unexpected effects fail visibly.

## Test the server's error path with raw wire input

**Wrong —** a typed client serializer cannot construct truncated JSON from a valid DTO; this never tests malformed input.

```kotlin
val response = jsonClient.post("/widgets") {
    contentType(ContentType.Application.Json)
    setBody(CreateWidgetBody("dial"))
}
assertNotEquals(HttpStatusCode.OK, response.status)
```

**Right —** send literal negative input and assert the specific outcome. `assertApiError` checks response JSON media type and decodes the stable code.

```kotlin
@Test
fun `create widget with broken JSON rejects without a write`() = testApplication {
    val widgets = RecordingWidgets()
    application { widgetModule(widgets) }

    val response = client.post("/widgets") {
        contentType(ContentType.Application.Json)
        setBody("{\"name\":")
    }

    assertEquals(HttpStatusCode.BadRequest, response.status)
    assertApiError(response, "invalid_request")
    assertTrue(widgets.createdNames.isEmpty())
}
```

## Exceptions and tradeoffs

Unit-test command policy without the test host. Use the test host for plugin order and route behavior, not as evidence of real socket close, TLS, or engine/proxy timeout behavior. For tests of downstream HTTP serialization use `externalServices` or the project's mock engine instead of a fake that silently skips the gateway boundary.

## Verification and pass criteria

Run the server module's test task, for example `./gradlew test`. Test valid, malformed, and unsupported-media requests independently; add denied and conflict tests where the route defines those outcomes. Pass when each status, body where documented, and effect count match the contract. Temporarily remove the relevant status mapping or guard and verify its regression test fails before restoring it.
