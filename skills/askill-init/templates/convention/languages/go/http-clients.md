# Reuse the HTTP client and own each response body

**Invariant:** A fetch returns only a complete, bounded successful response and closes every response body it owns, including on failure.

**Compatibility:** Version-independent recipe on Go 1.20+; `http.NewRequestWithContext` (Go 1.13) and `io.ReadAll` (Go 1.16) are both available at that floor.

## When to read

Read when adding an outbound HTTP lookup or diagnosing connections held by an upstream response.

## Decision

Use a reusable client configured at the composition root, a deadline-bearing request, and a bounded body. HTTP error statuses do not make `Client.Do` return an error. Every successful call to `Do` returns a body the caller must close, even on rejected status.

## Bad

```go
package upstream

import (
	"io"
	"net/http"
)

func Fetch(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	return io.ReadAll(resp.Body)
}
```

## Good

```go
package upstream

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

func Fetch(ctx context.Context, client *http.Client, url string) ([]byte, error) {
	const limit = 64 << 10
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected upstream status: %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if len(body) > limit {
		return nil, fmt.Errorf("upstream body exceeds %d bytes", limit)
	}
	return body, nil
}
```

## Assumptions and trade-offs

The upstream URL and redirect policy are configured by the application. Only `200` is a valid full result and the two-second budget includes body reads. Not draining a rejected or oversized body can sacrifice HTTP/1.x connection reuse, but avoids reading arbitrary data just to save a connection. Returning a stream instead would transfer body closure and deadline ownership to the caller.

## Verification

Use a local test server or tracked transport. Send `200` at the byte cap, `200` one byte over, and `503`; also cancel the caller while a body read is blocked. **Pass:** only the at-cap response returns data, all opened bodies close, and the blocked call exits on cancellation rather than waiting for a response.
