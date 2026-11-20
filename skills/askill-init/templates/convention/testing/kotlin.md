# Testing Kotlin

- Test null and sealed-result branches at the public boundary.
- For suspend code use the configured coroutine test dispatcher and advance virtual time instead of sleeping.

## Control coroutine scheduling

Use a shared test scheduler for the scopes involved in a timing-sensitive case. Start work, advance the scheduler, and assert the transition; do not rely on real dispatcher timing. Verify cancellation leaves no active child work.

## Test flow contracts, not every emission by habit

For state streams, assert the states the consumer is guaranteed to observe. If intermediate events must never be lost, use a collector that is active before triggering the producer and test that guarantee explicitly.
