# FastAPI

- Keep request validation and dependency wiring at the HTTP boundary.
- Exercise routes through a test client and clean up dependency overrides between cases.

## Separate validation from policy

Use request models for input shape and dependencies for shared authentication or resource setup. Keep business decisions in a callable that need not import FastAPI. Use a response model or explicit projection to avoid returning private stored fields.

## Test the real boundary

Send malformed input through the test client and assert no side effect. Test valid but unauthorized input separately. When lifecycle hooks own resources, start and stop the app in the test harness; do not treat a direct function call as proof of request validation.
