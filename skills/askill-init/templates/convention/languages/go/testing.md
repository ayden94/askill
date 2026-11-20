# Test Go contracts with table subtests and explicit synchronization

## When to read

Read when building a test table, exercising errors or filesystem effects, or verifying that a worker exits. This example is a `worker_test.go` file using Go's standard testing runner.

## Rules

- Give table rows names that include the condition and expected outcome. Use one row per meaningful contract; compare error identity via `errors.Is` or `errors.As` and assert returned results or side effects.
- Arrange a signal proving work started before canceling. Wait for completion with a deadline; a sleep cannot prove ordering. Only call `t.Fatal` from the goroutine running the test or subtest, not from the worker.
- Use `t.TempDir()` for file fixtures and `t.Cleanup` for per-test resource cleanup. `t.Setenv` changes process-wide state: don't use it in parallel tests or tests with parallel ancestors. Run concurrency cases with `-race` when supported in CI or locally.

## Error-prone

```go
package worker

import (
	"context"
	"testing"
	"time"
)

func TestProcessing(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	go func() { <-ctx.Done() }()
	time.Sleep(10 * time.Millisecond)
	cancel()
}
```

The test can pass whether or not the worker ever sees cancellation or terminates.

## Recommended

```go
package worker

import (
	"context"
	"errors"
	"testing"
	"time"
)

func waitForStop(ctx context.Context, started chan<- struct{}) error {
	close(started)
	<-ctx.Done()
	return ctx.Err()
}

func TestWaitForStop(t *testing.T) {
	for _, tc := range []struct {
		name      string
		cancelNow bool
	}{
		{"pre-canceled context returns canceled", true},
		{"active context stops when canceled", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			t.Cleanup(cancel)
			started := make(chan struct{})
			result := make(chan error, 1)
			deadline := time.NewTimer(2 * time.Second)
			defer deadline.Stop()
			if tc.cancelNow {
				cancel()
			}

			go func() { result <- waitForStop(ctx, started) }()
			select {
			case <-started:
			case <-deadline.C:
				t.Fatal("worker did not start")
			}
			if !tc.cancelNow {
				select {
				case err := <-result:
					t.Fatalf("worker returned before cancellation: %v", err)
				default:
				}
				cancel()
			}

			select {
			case err := <-result:
				if !errors.Is(err, context.Canceled) {
					t.Fatalf("got %v, want context.Canceled", err)
				}
			case <-deadline.C:
				t.Fatal("worker did not stop")
			}
		})
	}
}
```

## Why and trade-offs

The signal establishes startup before cancellation and the buffered one-shot result lets the worker report even if the test has already stopped receiving. The deadline is a failure guard rather than a synchronization mechanism. The nonblocking check catches results already published before cancellation; it does not prove a stronger timing or liveness property.

## Edge cases and exceptions

These subtests run synchronously. If adding `t.Parallel` on modules with pre-Go-1.22 loop semantics, explicitly capture the row before the closure and check that fixtures are independent. Treat `-race` as a dynamic check for executed code, not proof that no concurrent path can race. Keep timeouts consistent with the project's CI so loaded machines don't pass or fail based on expected scheduler speed.

## Verification

Run the test alone, in the suite, and with `go test -race` where supported. Replace the worker's returned error with `nil` in a scratch variant. **Pass:** both the pre-canceled and active-cancel paths return `context.Canceled`, and the mutation fails an error identity check.
