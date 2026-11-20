# Drain HTTP handlers with a fresh shutdown deadline

**Invariant:** A stop signal gives ordinary handlers a fresh bounded drain window, and the owner observes the serving result before returning.

**Compatibility:** Standard-library API floor, not a split: Go 1.20+ for this implementation because it uses `errors.Join` ([Go 1.20 release notes](https://go.dev/doc/go1.20#errors)). The drain protocol itself is not new in Go 1.20.

## When to read

Read when a command owns an HTTP listener and must stop accepting connections while allowing in-flight handlers to finish.

## Decision

Wait for either the serving result or the process stop signal. When stopping, call `Shutdown` with a fresh bounded context and join the serving goroutine. Passing the already canceled stop context abandons the wait immediately instead of giving handlers a drain window.

## Bad

```go
package service

import (
	"context"
	"net"
	"net/http"
)

func Serve(stop context.Context, server *http.Server, listener net.Listener) error {
	go server.Serve(listener)
	<-stop.Done()
	return server.Shutdown(stop)
}
```

## Good

```go
// Go 1.20+ (errors.Join)
package service

import (
	"context"
	"errors"
	"net"
	"net/http"
	"time"
)

func Serve(stop context.Context, server *http.Server, listener net.Listener) error {
	served := make(chan error, 1)
	go func() { served <- server.Serve(listener) }()

	select {
	case err := <-served:
		return serveError(err)
	case <-stop.Done():
	}

	drain, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	drainErr := server.Shutdown(drain)
	if drainErr != nil {
		drainErr = errors.Join(drainErr, server.Close())
	}
	return errors.Join(drainErr, serveError(<-served))
}

func serveError(err error) error {
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
```

## Assumptions and trade-offs

The process owns this server and supplies the stop context, for example from `signal.NotifyContext` (Go 1.16+). Handler request contexts should not already be canceled by that same stop signal if handlers are meant to drain. After timeout, `Close` terminates ordinary connections; it cannot join arbitrary work a handler started. `errors.Join` returns nil when all inputs are nil and preserves each non-nil error for `errors.Is`/`errors.As`. Track hijacked connections and background jobs separately. Returning from `Serve` after the listener immediately fails is not treated as a clean drain.

## Verification

With a loopback listener, wait for a handler to signal entry before canceling `stop`, then release it and wait for both the response and `Serve`. Repeat with an already closed listener and an uncanceled stop context. **Pass:** the first request finishes and shutdown returns nil; the second returns the listen/serve error without waiting for a signal.
