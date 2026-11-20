# Testing Ktor

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

Choose explicit module loading or test configuration that loads the real module; do not accidentally load it twice. Keep fakes scoped to a test and make unexpected effects fail visibly.

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
