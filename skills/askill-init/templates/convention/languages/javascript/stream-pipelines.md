# Join Node streams with backpressure and failure propagation

**Invariant:** Completion follows destination finish, backpressure bounds buffering, and either a stream failure or cancellation tears down the unfinished chain.

**Compatibility — Node version boundary:** The [Streams Promises API](https://nodejs.org/api/stream.html#streams-promises-api) arrived in Node 15.0; its `pipeline` got `{ signal }` in [15.11](https://nodejs.org/en/blog/release/v15.11.0). Use the promise example on Node 15.11+. On Node 14.17–14.x or 15.0–15.10 use the callback-pipeline adapter below; those ranges have `AbortController` according to the [Node globals history](https://nodejs.org/api/globals.html#class-abortcontroller). These are API cutoffs, not release lifecycle recommendations or browser Streams versions.

## When to read

Read when moving bytes from a Node readable into an output file, socket, or transform chain.

## Decision

Use the promise-based `pipeline` for a one-shot chain you own. A `data` listener that ignores `write()` returning `false` lets the writable buffer grow, and source completion does not mean the output has finished.

## Bad

```js
function copy(source, destination) {
  source.on("data", (chunk) => destination.write(chunk));
  source.on("end", () => destination.end());
}
```

## Good

```js
import { pipeline } from "stream/promises";

function copy(source, destination, signal) {
  return pipeline(source, destination, { signal });
}
```

For the legacy range, install the callback pipeline before acting on an already-aborted signal. Destroy the owned destination with an error: a source that has already ended cannot signal an abort while the destination is still flushing.

```js
import { pipeline } from "stream";

function copy(source, destination, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      error.code = "ABORT_ERR";
      destination.destroy(error);
    };
    pipeline(source, destination, (error) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    });
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
```

## Assumptions and trade-offs

The caller transfers ownership of two disposable Node streams, not a shared socket or response that must survive an error. `pipeline` can destroy unfinished streams on error or abort; don't reuse failed stages. Rejection does not undo output already written. For all-or-nothing publication, stage the result and publish only after successful completion.

## Verification

Run the same check with each implementation. Use a small high-water mark and a writable whose first write callback is held by the test; release it to resume copying. Repeat with the callback failing and separately abort while it is held. Also try abort with a single chunk after the source has closed but the destination is still flushing. **Pass:** the source does not drain a large input into the stalled sink, the happy path resolves after `finish`, and the failure and abort paths reject and tear down the unfinished chain.
