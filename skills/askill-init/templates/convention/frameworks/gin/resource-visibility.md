# Resource visibility

**Invariant:** No visible match has one public outcome regardless of whether a hidden row exists.

**Compatibility:** Stable application authorization/store policy; Gin 1.x [`Context.JSON`](https://pkg.go.dev/github.com/gin-gonic/gin@v1.11.0#Context.JSON) only renders the chosen outcome. The rule does not depend on Gin middleware versions or the storage driver.

**Acceptance check:** Owned returns 200; foreign and absent produce the same status and body; a backend failure remains distinguishable from not-found.

## When to read

Read when defining whether callers may learn that a widget belongs to another tenant.

## Use a visibility-scoped lookup

**Wrong —** different responses for missing and out-of-scope rows reveal existence even when the body is withheld.

```go
widget, err := h.store.Find(c.Request.Context(), id)
if err != nil {
    writeWidgetError(c, err)
    return
}
if widget.TenantID != actor.TenantID {
    c.Status(http.StatusForbidden)
    return
}
c.JSON(http.StatusOK, widget.View())
```

**Right —** make tenant scope an input to the lookup and use the same public result for no matching row.

```go
widget, err := h.store.FindInTenant(c.Request.Context(), actor.TenantID, id)
switch {
case errors.Is(err, ErrWidgetNotFound):
    c.JSON(http.StatusNotFound, gin.H{"code": "widget_not_found"})
case err != nil:
    writeWidgetError(c, err)
default:
    c.JSON(http.StatusOK, widget.View())
}
```

## Tradeoffs and assumptions

The identity guard has already supplied a trusted actor; the store applies both predicates in one query. This contract hides existence from other tenants, not from a caller allowed to discover but not edit the widget; that case may warrant 403. Mutations need their own scoped or transactional checks. Identical status and body do not establish identical timing.

## Verification

Use two authenticated tenant fixtures and exercise an owned ID, a foreign ID, and a nonexistent ID. Assert 200 only for the owned row, identical documented error representations for the latter two, and tenant scope on each store call. Inject a store failure and assert it is not rewritten as not-found.
