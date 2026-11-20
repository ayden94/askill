# Testing JavaScript

- Use the existing runner and await asynchronous work; a test must fail on a rejected promise.
- Restore fake timers, spies, and shared globals after each test.

## Make async failures observable

Return or await the assertion on a rejected promise. A test that finishes before the promise rejects can pass without checking the error path. For competing requests, use two controllable promises and resolve them in reverse order.

## Keep fixtures independent

Prefer a fresh module dependency or per-test factory over changing global state. When a clock or spy is necessary, restore it even if the assertion fails and verify the next test can run alone.
