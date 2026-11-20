# Resource visibility

## When to read

Read when a protected mutation must not disclose whether an out-of-scope resource exists.

## Apply visibility and mutation together

**Wrong —** a preflight lookup exposes hidden rows through different statuses, and a separate write can run after ownership changes.

```kotlin
val widget = widgets.find(id)
if (widget == null) {
    call.respond(HttpStatusCode.NotFound)
    return@delete
}
if (widget.tenantId != actor.tenantId) {
    call.respond(HttpStatusCode.Forbidden)
    return@delete
}
widgets.delete(id)
call.respond(HttpStatusCode.NoContent)
```

**Right —** keep the `authenticate` scope and give the domain operation a trusted tenant and the validated resource ID. Check visibility in the same write.

```kotlin
when (widgets.deleteInTenant(actor.tenantId, id)) {
    DeleteResult.Deleted -> call.respond(HttpStatusCode.NoContent)
    DeleteResult.NoVisibleMatch ->
        call.respond(HttpStatusCode.NotFound, ApiError("widget_not_found"))
}
```

## Tradeoffs and assumptions

The local store performs an atomic delete with both ID and tenant predicates, or a transaction for more complex policy. Here membership grants deletion; if discoverability and deletion rights differ, return 403 only for a caller permitted to know the row exists. Infrastructure failures are not `NoVisibleMatch`; map those separately. A 404 on repeated deletion is part of this wire contract.

## Verification

Send authenticated delete requests for an owned, foreign, and absent ID. Assert the last two share status and error body and leave the store unchanged; only the owned row is removed. At the repository layer verify the scope check occurs within the same mutation and errors are propagated.
