# Async cancellation and partial progress

## When to read

Read when a timeout or `select!` can drop active I/O, especially when the same connection will be reused.

These examples assume Tokio with the relevant I/O and time features. The caller supplies a fixed-size frame buffer and may retry after a timeout. Error-prone: a cancelled `read_exact` can already have consumed bytes, but the retried operation starts filling at index zero.

```rust
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::time::{timeout_at, Instant};

async fn fill<R: AsyncRead + Unpin>(
    stream: &mut R, frame: &mut [u8], deadline: Instant,
) -> std::io::Result<()> {
    timeout_at(deadline, stream.read_exact(frame)).await
        .map_err(|_| std::io::ErrorKind::TimedOut)??;
    Ok(())
}
```

Recommended for one reader on a resumable connection: keep progress outside the timed future and retry with the same initialized buffer and cursor.

```rust
use std::io::{self, ErrorKind};
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::time::{timeout_at, Instant};

async fn fill<R: AsyncRead + Unpin>(
    stream: &mut R, frame: &mut [u8], filled: &mut usize, deadline: Instant,
) -> io::Result<()> {
    assert!(*filled <= frame.len(), "invalid caller-owned frame cursor");
    while *filled < frame.len() {
        let n = timeout_at(deadline, stream.read(&mut frame[*filled..])).await
            .map_err(|_| ErrorKind::TimedOut)??;
        if n == 0 {
            return Err(ErrorKind::UnexpectedEof.into());
        }
        *filled += n;
    }
    Ok(())
}
```

Tokio's `read` is cancellation-safe; once a read succeeds, this loop advances the cursor before the next suspension. Pass a new deadline only for a deliberate retry budget. Allocate the bounded frame and initialize the cursor once, and deliver no frame until complete. After EOF or other I/O error, discard the partial state and do not assume the connection can be reused. When the policy is to discard the whole connection on timeout, a non-resumable `read_exact` is simpler. Dropping a future does not undo already committed remote operations.

## Verification and pass criteria

Feed a prefix into a duplex fixture, withhold the suffix until the timeout, and assert the cursor equals the prefix length. Resume with the same buffer and cursor; the frame must match exactly, and bytes of the next frame must remain available. Separately close the peer mid-frame and assert `UnexpectedEof` with no delivery.
