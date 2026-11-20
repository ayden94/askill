# Upload byte budgets

**Invariant:** Only a complete upload within the actual byte limit may become visible.

**Compatibility:** Go standard-library version gate, not a Gin 1.x routing change: [`http.MaxBytesError`](https://go.dev/doc/go1.19#nethttppkgnethttp) starts at Go 1.19. Respect the selected Gin release's separate toolchain floor.

**Acceptance check:** Exactly the cap publishes once; cap plus one at unknown length returns 413 and interrupted or oversized uploads never publish.

## When to read

Read when accepting a raw upload whose actual byte count must be bounded, independently of JSON binding.

## Count bytes at the reader and publish only complete uploads

**Wrong —** a length check does not cover a request with no declared length, and writes directly to the destination can expose partial data on disconnect.

```go
if c.Request.ContentLength > maxUpload {
    c.Status(http.StatusRequestEntityTooLarge)
    return
}
_, _ = io.Copy(publicFile, c.Request.Body)
c.Status(http.StatusCreated)
```

**Right —** use a bounded reader and private staging; publish after reaching EOF without a limit or transport error.

```go
body := http.MaxBytesReader(c.Writer, c.Request.Body, maxUpload)
defer body.Close()
n, err := io.Copy(stage, body)
var oversized *http.MaxBytesError
switch {
case errors.As(err, &oversized):
    c.Status(http.StatusRequestEntityTooLarge)
case err != nil:
    failUpload(c, err)
default:
    if err := stage.Commit(n); err != nil {
        failUpload(c, err)
        return
    }
    c.Status(http.StatusCreated)
}
```

- **Go 1.19 or newer:** Copy through `http.MaxBytesReader` as above, recognizing `*http.MaxBytesError`.
- **Go before 1.19, with a compatible Gin pin:** `n, err := io.Copy(stage, io.LimitReader(c.Request.Body, maxUpload+1))` for a finite cap below `math.MaxInt64`. If `n > maxUpload`, return 413 and discard the private stage; otherwise reject any `err` and commit only on successful EOF. The overflow probe can write one excess byte to private staging, never to the public object.

## Tradeoffs and assumptions

The local staging writer is created before the snippet and the handler defers discarding uncommitted data. `failUpload` distinguishes input errors from staging failures, without pretending a disconnected peer can receive an error. The endpoint accepts identity encoding; if it adds decompression, budget decoded bytes separately. A per-upload ceiling does not bound aggregate disk usage.

## Verification

With a recording stage, send exactly the cap, cap plus one with unknown length, and a request whose body reader errors after a short read. Assert only the first publishes, the over-limit response is 413, and both failures discard staged bytes. Inject a stage write or commit failure and assert it never returns 201.
