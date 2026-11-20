# Routing and plugins

**Invariant:** Require a named provider on protected routes and map expected failures without swallowing cancellation.

**Compatibility:** Plugin-dependent across Ktor 2.x and 3.x: install matching [Authentication](https://ktor.io/docs/server-auth.html) and [StatusPages](https://ktor.io/docs/server-status-pages.html) artifacts. The principal type bound changes at Ktor 3.0; resource authorization remains application policy.

**Acceptance check:** Health stays public; anonymous, invalid and forbidden calls cannot mutate; authorized success and domain conflict return their exact documented responses.

## When to read

Read when wiring modules, adding a protected route, or deciding which layer translates exceptions.

## Give protected routes an explicit provider scope

**Wrong —** installing Authentication registers a provider but does not require it on an unwrapped route.

```kotlin
install(Authentication) {
    bearer("api") { authenticate { credential -> verify(credential.token) } }
}
routing {
    delete("/widgets/{id}") { deleteWidget(call, widgets) }
}
```

**Right —** use one application assembly for production and tests, and pass the authenticated identity into the protected operation. Here `verify` returns `ActorPrincipal?`.

- **Ktor 2.x:** Declare `data class ActorPrincipal(val id: Long) : Principal` using `io.ktor.server.auth.Principal`; the [2.x API](https://api.ktor.io/2.3.x/ktor-server-auth/io.ktor.server.auth/-authentication-context/principal.html) requires the marker.
- **Ktor 3.x:** Declare `data class ActorPrincipal(val id: Long)`; the [3.0 API](https://api.ktor.io/3.0.x/ktor-server-auth/io.ktor.server.auth/-authentication-context/principal.html) accepts any non-null principal object. Continue retrieving the specific type with `call.principal<ActorPrincipal>()`.

```kotlin
install(Authentication) {
    bearer("api") { authenticate { credential -> verify(credential.token) } }
}
routing {
    get("/healthz") { call.respondText("ok") }
    authenticate("api") {
        delete("/widgets/{id}") {
            val actor = checkNotNull(call.principal<ActorPrincipal>())
            val id = call.parameters["id"]?.toLongOrNull()
            if (id == null || id <= 0) {
                call.respond(HttpStatusCode.BadRequest, ApiError("invalid_id"))
                return@delete
            }
            widgets.delete(actor.id, id)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
```

A principal is not a resource permission. The delete operation checks ownership or policy using the validated actor and ID. Failure to supply the expected principal after required authentication is a wiring error, not anonymous access.

## Map known exceptions centrally without swallowing cancellation

**Wrong —** a route-level catch conflates domain conflicts, cancellation, and unexpected infrastructure failures.

```kotlin
try {
    widgets.delete(actor.id, id)
    call.respond(HttpStatusCode.NoContent)
} catch (failure: Exception) {
    call.respond(HttpStatusCode.BadRequest, failure.message.orEmpty())
}
```

**Right —** configure narrow status mappings with the shared module. `ApiError` is the serializable error DTO; JSON negotiation is installed separately.

```kotlin
install(StatusPages) {
    exception<WidgetConflict> { call, _ ->
        call.respond(HttpStatusCode.Conflict, ApiError("widget_conflict"))
    }
    exception<BadRequestException> { call, _ ->
        call.respond(HttpStatusCode.BadRequest, ApiError("invalid_request"))
    }
}
```

Known infrastructure and domain failures can map differently. Log unexpected exceptions at the selected application boundary; if adding catch-all handling, rethrow coroutine cancellation and do not attempt to replace an already committed response.

## Exceptions and tradeoffs

Optional authentication is appropriate only for a route whose anonymous behavior is defined. Multiple providers require a deliberate authentication strategy and challenge tests. A route may handle a failure locally if it needs endpoint-specific recovery, but do not define competing status mappings for the same failure without checking which one applies.

## Verification and pass criteria

Send anonymous, invalid-credential, valid-but-forbidden, accepted, and conflict requests through the shared module. Pass if denied requests never perform the mutation, the challenge is present where required, success has a 204 with no body, and conflict returns 409 with the stable error code. An unhandled internal exception must not be presented as a client validation error. Check that `/healthz` remains accessible without credentials.
