# Test Go contracts with table subtests and explicit synchronization

**Invariant:** Each test row exercises its own case and proves that its worker reports the expected cancellation outcome before the deadline.

**Compatibility:** The synchronous test works on Go 1.20+. Parallel closures need different capture recipes under pre-1.22 versus 1.22+ Go language semantics ([Go 1.22 release notes](https://go.dev/doc/go1.22#language), [loop-variable migration guide](https://go.dev/blog/loopvar-preview)).

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

These subtests run synchronously. Treat `-race` as a dynamic check for executed code, not proof that no concurrent path can race. Keep timeouts consistent with the project's CI so loaded machines don't pass or fail based on expected scheduler speed.

## Compatibility: capture rows for parallel subtests

In an ordinary module file without a per-file language override, use the module's `go` directive to choose the semantics, not the installed compiler version or the `toolchain` directive. For example, Go 1.22 compiling a package in a module declaring `go 1.21` still uses the old loop semantics. Version build constraints can affect individual files. The new rule applies to variables declared by the loop (`:=`), not to assignments into predeclared variables (`=`). Since [Go 1.21](https://go.dev/doc/go1.21#tools), the module's `go` directive is also a required minimum toolchain version; `toolchain` can suggest a newer toolchain without opting the module into newer language semantics.

For module language versions **Go 1.20–1.21**, shadow the range variable in the loop body:

```go
// go.mod: go 1.20 or go 1.21 (ordinary module file)
for _, tc := range cases {
	tc := tc
	t.Run(tc.name, func(t *testing.T) {
		t.Parallel()
		check(t, tc)
	})
}
```

For module language versions **Go 1.22+**, declare the variable in the range clause so each iteration gets its own binding:

```go
// go.mod: go 1.22 or later, with a toolchain that supports it
for _, tc := range cases {
	t.Run(tc.name, func(t *testing.T) {
		t.Parallel()
		check(t, tc)
	})
}
```

With either loop, use two distinctly named rows with different data and have `check` assert that the subtest name's final component matches `tc.name` and that the result matches that row's expected value. **Pass:** both subtests exercise their own row, even though the closures continue after the parent loop. A row copy does not make referenced fixtures independent.

## Verification

Run the test alone, in the suite, and with `go test -race` where supported. Replace the worker's returned error with `nil` in a scratch variant. **Pass:** both the pre-canceled and active-cancel paths return `context.Canceled`, and the mutation fails an error identity check.
