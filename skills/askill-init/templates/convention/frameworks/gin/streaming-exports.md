# Streaming exports

## When to read

Read when a download must deliver records before the complete export is ready.

## Flush incremental records and handle partial delivery

**Wrong —** collecting the export delays the first byte and retains every row even when the client disconnects.

```go
rows, err := h.exports.All(c.Request.Context())
writeExportJSON(c, rows, err)
```

**Right —** open the iterator before writing, then read and flush incrementally. This example emits NDJSON; `Next` returns `io.EOF` only on normal completion.

```go
ctx := c.Request.Context()
rows, err := h.exports.Open(ctx)
if err != nil {
    writeExportError(c, err)
    return
}
defer rows.Close()
c.Header("Content-Type", "application/x-ndjson")
c.Status(http.StatusOK)
enc := json.NewEncoder(c.Writer)
for {
    row, err := rows.Next(ctx)
    if errors.Is(err, io.EOF) {
        return
    }
    if err == nil {
        err = enc.Encode(row)
    }
    if err != nil {
        if c.Writer.Written() {
            recordExportFailure(ctx, err)
        } else {
            c.Writer.Header().Del("Content-Type")
            writeExportError(c, err)
        }
        return
    }
    c.Writer.Flush()
}
```

## Tradeoffs and assumptions

This stream contract allows partial results; a clean-looking EOF is not proof of a complete export. If completeness matters, define an explicit terminal record or generate a downloadable artifact before serving. Flush per batch when throughput matters; proxy buffering can hide flushes. Source, writes and deployment need a finite lifetime policy, and Gin's `Flush` does not return a write error.

## Verification

Use a real listener and hold the iterator after its first row. Read one complete line with a client deadline before releasing the iterator. Cancel the client and assert the context-aware iterator closes. Inject a source failure before the first row and after the first flush; expect the documented error response in the first case and a failure event rather than a second JSON body in the second. Repeat the first-line test through the deployed proxy.
