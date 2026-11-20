# Request boundaries

## When to read

Read when binding path/query parameters or request bodies, or changing the status for media type, conversion, or field errors.

## Distinguish media type, decoding, and input rules

**Wrong —** valid JSON is not necessarily a valid command. Decoding a `String` manually also skips the project's configured JSON converter.

```kotlin
post("/widgets") {
    val body = Json.decodeFromString<CreateWidgetBody>(call.receiveText())
    widgets.create(body.name)
    call.respond(HttpStatusCode.Created)
}
```

**Right —** configure negotiation once, apply the route's accepted media-type policy, and validate the decoded DTO before effectful work. In this example `CreateWidgetBody` and `ApiError` are `@Serializable`.

```kotlin
install(ContentNegotiation) {
    json(Json { ignoreUnknownKeys = false })
}
routing {
    post("/widgets") {
        if (!call.request.contentType().withoutParameters().match(ContentType.Application.Json)) {
            call.respond(HttpStatusCode.UnsupportedMediaType, ApiError("json_required"))
            return@post
        }
        val body = call.receive<CreateWidgetBody>()
        val name = body.name.trim()
        if (name.isEmpty() || name.length > 80) {
            call.respond(HttpStatusCode.BadRequest, ApiError("invalid_name"))
            return@post
        }
        widgets.create(name)
        call.respond(HttpStatusCode.Created)
    }
}
```

Register the project's conversion-error mapping for `receive`, and verify that mapping with the installed converter. `Content-Type` selects request decoding; `Accept` describes response preferences. A failure to negotiate a response is not an invalid request field.

## Preserve the difference between absent and invalid scalar parameters

**Wrong —** `?: 20` silently accepts incorrect values.

```kotlin
val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 20
```

**Right —** read all values for this scalar field and default only when absent.

```kotlin
val values = call.request.queryParameters.getAll("limit")
val limit = if (values == null) 20 else values.singleOrNull()?.toIntOrNull()
if (limit == null || limit !in 1..100) {
    call.respond(HttpStatusCode.BadRequest, ApiError("invalid_limit"))
    return@get
}
val page = widgets.list(limit)
call.respond(page)
```

## Exceptions and tradeoffs

Use permissive unknown-field handling for clients that need forward compatibility, but make the choice explicit. A PATCH field may need to distinguish omitted, explicit null, and a value; a nullable Kotlin property with a default does not preserve all three. Treat `receive` as consuming the body; if another component legitimately needs the same bytes, choose a bounded, deliberate caching strategy rather than reading twice by accident.

## Verification and pass criteria

Send a valid JSON request with media-type parameters, unsupported media type, truncated JSON, wrong field type, blank name, and unknown key. Pass if only the valid request reaches the write and each failure has its documented status and error code. For `limit`, check missing, empty, repeated, nonnumeric, 1, 100, and 101; the default applies only when missing and only a valid scalar reaches the query.
