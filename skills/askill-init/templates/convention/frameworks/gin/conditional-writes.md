# Conditional writes

**Invariant:** A stale precondition cannot commit a write; the comparison and update share one storage operation.

**Compatibility:** Stable application/store policy across Gin 1.x; the transport uses [standard Go HTTP headers](https://pkg.go.dev/net/http#Header) and the semantics are defined by [HTTP `If-Match`](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match), not Gin.

**Acceptance check:** Two concurrent writes using the same valid tag yield exactly one 204 and one 412; the stored row and new tag belong to the winner.

## When to read

Read when editors can overwrite each other's changes to a versioned resource.

## Compare the version in the write itself

**Wrong —** another request can update the widget between the version check and an unconditional update.

```go
if h.store.Version(ctx, id) != expected {
    c.Status(http.StatusPreconditionFailed)
    return
}
h.store.Replace(ctx, id, command)
```

**Right —** require the agreed precondition and use one atomic compare-and-replace operation.

```go
expected, err := requiredStrongVersion(c.Request.Header.Values("If-Match"))
if err != nil {
    writePreconditionError(c, err)
    return
}
newVersion, err := h.store.ReplaceIfVersion(c.Request.Context(), actor.TenantID, id, expected, command)
switch {
case errors.Is(err, ErrStaleVersion):
    c.Status(http.StatusPreconditionFailed)
case err != nil:
    writeWidgetError(c, err)
default:
    c.Header("ETag", strongVersionTag(newVersion))
    c.Status(http.StatusNoContent)
}
```

## Tradeoffs and assumptions

This API documents one strong version tag emitted by its read endpoint. The local parser maps missing to 428 and unsupported forms to 400; if the endpoint promises general HTTP `If-Match` semantics, implement lists, wildcard, and strong comparison instead. The store checks scope and version atomically (or under a transaction), advances the version on success, and follows the API's missing/hidden-resource policy separately.

## Verification

Read the initial tag, then send two concurrent replacements with that tag against a real store. Assert one 204 with a new tag, one 412, and a final row matching only the winner. Test missing and malformed preconditions and verify neither attempts a write.
