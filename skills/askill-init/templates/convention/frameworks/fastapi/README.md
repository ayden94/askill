# FastAPI rulebook

Read the leaves that cover the changed behavior. Check the lockfile for the FastAPI, Pydantic, Starlette, HTTPX, and AnyIO versions before copying examples; the request model examples use Pydantic v2.

| Task | Read |
| --- | --- |
| Change request validation, response serialization, or API errors | [HTTP contracts](http-contracts.md) |
| Change authentication wiring, app startup, or resource teardown | [Dependencies and lifespan](dependencies-and-lifespan.md) |
| Add blocking I/O, an outbound call, or work after the response | [Concurrency and side effects](concurrency-and-side-effects.md) |
| Choose an HTTP test harness or override dependencies | [Testing](testing.md) |
| Mount a sub-application that needs startup resources | [Mounted app lifecycle](mounted-app-lifecycle.md) |
| Add query filters, repeated parameters, or bounded pagination | [Query parameter models](query-parameter-models.md) |
| Chain best-effort callbacks or handle a callback failure after a response | [Background callback failures](background-callback-failures.md) |
| Standardize error envelopes without losing authentication or retry headers | [Error handlers and diagnostic ownership](error-handlers.md) |
| Declare OAuth2 scopes and enforce resource-level policy | [Scopes and resource access](scopes-and-resource-access.md) |
| Return incremental data or clean up a disconnected stream | [Streaming response ownership](streaming-responses.md) |
| Rename endpoints or split routers without breaking generated clients | [OpenAPI operation IDs](openapi-operation-ids.md) |

For write endpoints, combine HTTP contracts with testing; add concurrency guidance when an operation can be interrupted, retried, or acknowledged before completion.
