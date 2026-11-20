# Server-sent events

**Invariant:** Bound each subscriber's queue and unsubscribe when its response body disappears, even if no new event arrives.

**Compatibility:** Stable [`Sse`/`KeepAlive`](https://docs.rs/axum/0.8.0/axum/response/sse/index.html) pattern in Axum 0.6–0.8. Backpressure and close notification are from [Tokio 1's bounded MPSC](https://docs.rs/tokio/1/tokio/sync/mpsc/fn.channel.html) (`sync` feature); `ReceiverStream` is from `tokio-stream`, not Axum.

**Acceptance check:** An event arrives before the feed ends, a slow client stalls rather than grows the queue, and dropping the body releases the subscription during both a pending feed read and a pending send.

## When to read

Read when an endpoint serves live events to a browser or another SSE client.

## Bound the per-client queue and stop when the body is dropped

**Wrong —** an unbounded queue can retain events indefinitely for a slow client, and ignoring a failed send leaves the subscription task running.

```rust
let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
tokio::spawn(async move {
    while let Some(update) = feed.next().await {
        let _ = tx.send(update);
    }
});
```

**Right —** use a finite queue, stop reading when the receiver closes, and terminate if a pending send loses its receiver.

```rust
let (tx, rx) = tokio::sync::mpsc::channel(32);
tokio::spawn(async move {
    loop {
        let update = tokio::select! {
            _ = tx.closed() => break,
            update = feed.next() => update,
        };
        let Some(update) = update else { break };
        if tx.send(update).await.is_err() {
            break;
        }
    }
});
let events = ReceiverStream::new(rx)
    .map(|update: String| Ok::<_, Infallible>(Event::default().data(update)));
Sse::new(events).keep_alive(KeepAlive::default())
```

## Tradeoffs and assumptions

The local per-client feed yields bounded strings, is cancellation-safe while awaiting `next`, and unsubscribes on drop. `ReceiverStream` and the `StreamExt` used for `map` can come from `tokio-stream`. Backpressure here pauses the per-client feed; a shared producer may require dropping or disconnecting slow consumers instead. Keepalives are not replay; define reconnection, lag handling, and a shutdown signal separately if required.

## Verification

Use a real listener and client to read an SSE event before the feed finishes. Stop consuming in a controlled test and assert the bounded sender stalls instead of accumulating entries. Drop the response while the producer is waiting on the feed, and again while send is blocked; in both cases await a fixture signal confirming unsubscription.
