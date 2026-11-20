# Drain HTTP handlers with a fresh shutdown deadline

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

The process owns this server and supplies the stop context, for example from `signal.NotifyContext`. Handler request contexts should not already be canceled by that same stop signal if handlers are meant to drain. After timeout, `Close` terminates ordinary connections; it cannot join arbitrary work a handler started. Track hijacked connections and background jobs separately. Returning from `Serve` after the listener immediately fails is not treated as a clean drain.

## Verification

With a loopback listener, wait for a handler to signal entry before canceling `stop`, then release it and wait for both the response and `Serve`. Repeat with an already closed listener and an uncanceled stop context. **Pass:** the first request finishes and shutdown returns nil; the second returns the listen/serve error without waiting for a signal.
