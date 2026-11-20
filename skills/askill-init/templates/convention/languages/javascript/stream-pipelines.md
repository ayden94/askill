# Join Node streams with backpressure and failure propagation

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
import { pipeline } from "node:stream/promises";

function copy(source, destination, signal) {
  return pipeline(source, destination, { signal });
}
```

## Assumptions and trade-offs

The caller transfers ownership of two disposable Node streams, not a shared socket or response that must survive an error. `pipeline` can destroy unfinished streams on error or abort; don't reuse failed stages. Rejection does not undo output already written. For all-or-nothing publication, stage the result and publish only after successful completion.

## Verification

Use a small high-water mark and a writable whose first write callback is held by the test; release it to resume copying. Repeat with the callback failing and separately abort while it is held. **Pass:** the source does not drain a large input into the stalled sink, the happy path resolves after `finish`, and both failure paths reject and tear down the unfinished chain.
