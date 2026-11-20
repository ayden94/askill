# FastAPI rulebook

Read the leaves that cover the changed behavior. Check the lockfile for the FastAPI, Pydantic, Starlette, HTTPX, and AnyIO versions before copying examples; the request model examples use Pydantic v2.

| Task | Read |
| --- | --- |
| Change request validation, response serialization, or API errors | [HTTP contracts](http-contracts.md) |
| Change authentication wiring, app startup, or resource teardown | [Dependencies and lifespan](dependencies-and-lifespan.md) |
| Add blocking I/O, an outbound call, or work after the response | [Concurrency and side effects](concurrency-and-side-effects.md) |
| Choose an HTTP test harness or override dependencies | [Testing](testing.md) |

For write endpoints, combine HTTP contracts with testing; add concurrency guidance when an operation can be interrupted, retried, or acknowledged before completion.
