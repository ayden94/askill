# Give every goroutine a stop and join path

## When to read

Read when spawning a goroutine, returning a channel, or making a blocking call that must stop when its caller is done.

## Rules

- Pass context into each blocking operation. Checking `ctx.Err()` once does not unblock a later send or receive; select on `ctx.Done()` where the channel operation can wait.
- Specify who closes each channel. The sender or a coordinating owner closes an output after all sends are finished; a receiver abandoning reads should cancel, not close the sender's channel.
- A caller stopping early must be able to request shutdown and observe completion. Don't silently detach request work; when the caller creates a child context it must call the cancel function even on success.

## Error-prone

```go
package stream

import "context"

func Forward(ctx context.Context, input <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for value := range input {
			if ctx.Err() != nil {
				return
			}
			out <- value
		}
	}()
	return out
}
```

It can block forever waiting for input or after starting a send to a caller that stopped receiving.

## Recommended

```go
package stream

import "context"

// Forward's caller cancels ctx when abandoning out, then waits for done.
// Forward owns out, not input; the upstream sender owns input's lifetime.
func Forward(ctx context.Context, input <-chan int) (out <-chan int, done <-chan struct{}) {
	values := make(chan int)
	finished := make(chan struct{})
	go func() {
		defer close(finished)
		defer close(values)
		for {
			if ctx.Err() != nil {
				return
			}
			var value int
			select {
			case <-ctx.Done():
				return
			case next, ok := <-input:
				if !ok {
					return
				}
				value = next
			}
			select {
			case <-ctx.Done():
				return
			case values <- value:
			}
		}
	}()
	return values, finished
}
```

## Why and trade-offs

Both blocking points have an escape path, and the worker acknowledges shutdown after closing `values`. Unbuffered output provides backpressure; a buffer can reduce scheduling overhead, but only postpones blocking and changes the number of values that can be pending.

## Edge cases and exceptions

If cancellation and a send are both ready, `select` can still complete that send. Do not promise that cancellation alone synchronizes delivery; wait for completion before asserting no new sends. A separate upstream producer needs its own cancellation path; stopping this forwarding worker doesn't automatically unblock the producer. For multiple senders, close the shared output only after all senders have joined.

## Verification

First cancel when the input has no ready values. Then hand off one input on an unbuffered channel without receiving output, and cancel after the handoff. In both cases wait for `done` with a test deadline. Also exercise input closure. **Pass:** the worker announces completion and output is closed in all three cases without sleeps, receiver-side close, or a blocked goroutine.
