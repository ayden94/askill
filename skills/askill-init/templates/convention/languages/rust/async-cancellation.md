# Async cancellation and partial progress

**Invariant:** A timeout must not lose track of any bytes already read if the same connection will be reused.

**Compatibility:** Version-sensitive in the Tokio dependency, separately from edition and compiler. On Tokio 1.x use the [`read`/`read_exact` cancellation contracts](https://docs.rs/tokio/1.48.0/tokio/io/trait.AsyncReadExt.html), with `io-util` and `time` enabled and a running timer driver. On an existing Tokio 0.2.25 runtime, use its [`AsyncReadExt::read`](https://docs.rs/tokio/0.2.25/tokio/io/trait.AsyncReadExt.html#method.read) with [`timeout_at`](https://docs.rs/tokio/0.2.25/tokio/time/fn.timeout_at.html) and the same caller-owned cursor: the [old `read` future forwards one poll](https://github.com/tokio-rs/tokio/blob/tokio-0.2.25/tokio/src/io/util/read.rs) and has no hidden offset to discard on cancellation. Keep dependencies and I/O adapters on the same Tokio major: [Tokio 1.x changed `poll_read` to `ReadBuf`](https://tokio.rs/blog/2020-12-tokio-1-0). Use the dependency release's actual MSRV in addition to the crate's edition floor. In both branches verify a partial read, timeout, resume, and an untouched following frame.

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
