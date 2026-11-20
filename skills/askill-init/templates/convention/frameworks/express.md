# Express

- Make middleware order and error propagation explicit.
- Exercise real route matching and middleware with request-level tests.

## Control response ownership

Validate inputs before performing writes and return after sending an early response. Centralize translation of known application errors instead of scattering HTTP status decisions throughout domain code. Check how the installed Express version forwards rejected promises.

## Test the mounted stack

An isolated handler test cannot prove middleware order. Send a request with missing credentials through the router and verify no write occurred, then send an authorized request and verify the response and persisted change. Check that unhandled errors do not expose internal details.
