# Testing asynchronous contracts

## When to read

Read when a test involves promises, overlap, retries, injected I/O, or fake time. Use the project's runner and CI command. The examples use `node:test` and `node:assert/strict` in an ES module on Node.js 22+.

## Rules

- Return or await asynchronous assertions; calling one is not proof the test owns its completion. Name the unit, scenario, and observable expectation.
- Drive races by controlling the events that determine order, not by sleeping. Resolve competing promises in the order that would trigger the bug and join all started operations before asserting the final state.
- Prefer a per-test dependency over changing global `fetch` or timers. If global replacement is unavoidable, register restoration before assertions or use `try/finally`; don't run such tests concurrently in the same process.
- Check cancellation separately from stale-write prevention: a transport mock that ignores abort cannot prove real I/O was stopped, but can prove a late response cannot overwrite current state.

## Error-prone

```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("load fails", () => {
  assert.rejects(Promise.resolve("unexpected success"), /offline/);
});
```

The runner may report the unhandled rejection separately, but the test callback has already returned; its verdict does not own the assertion.

## Recommended

```js
import { test } from "node:test";
import assert from "node:assert/strict";

function latestLoader(load, publish) {
  let generation = 0;
  return async function refresh(key) {
    const current = ++generation;
    const value = await load(key);
    if (current === generation) publish(value);
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("refresh: older request completes last -> only latest value is published",
  { timeout: 1000 }, async () => {
    const old = deferred();
    const fresh = deferred();
    const published = [];
    const refresh = latestLoader(
      (key) => (key === "old" ? old.promise : fresh.promise),
      (value) => published.push(value),
    );

    const previous = refresh("old");
    const current = refresh("new");
    fresh.resolve("new value");
    await current;
    old.resolve("stale value");
    await previous;

    assert.deepEqual(published, ["new value"]);
  });

test("refresh: transport rejects -> caller observes the original error", async () => {
  const offline = new Error("offline");
  const refresh = latestLoader(async () => { throw offline; }, () => {});

  const result = refresh("item");

  await assert.rejects(result, (error) => error === offline);
});
```

## Why and trade-offs

The test retains control of promise order and asserts the published sequence rather than private counters. Fixture size is higher than a resolved stub, but neither the system clock nor transport speed can change the outcome.

## Edge cases and exceptions

Use the runner's fake clock only when testing actual time semantics such as debounce or retry deadlines. Follow timer advancement with the awaited observable result; advancing timers is not in itself a promise assertion. Failed and superseded requests may follow a different error contract; test it separately if callers depend on it.

## Verification

Run the test file alone and in the suite. Then in a scratch copy remove the generation guard and separately replace the rejecting dependency with a fulfilled promise. **Pass:** original tests pass both ways; each mutation fails the corresponding test.
