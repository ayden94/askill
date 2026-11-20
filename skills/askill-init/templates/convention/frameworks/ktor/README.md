# Ktor rulebook

Read only the topics that match the task.

| Task | Read |
| --- | --- |
| Decode JSON or parameters, validate a DTO, or change negotiation | [Request boundaries](request-boundaries.md) |
| Assemble application modules, mount protected routes, or map failures | [Routing and plugins](routing-and-plugins.md) |
| Change coroutine scope, downstream I/O, or resource shutdown | [Coroutine and resource lifetimes](coroutines-and-resources.md) |
| Verify the installed plugin pipeline and route contracts | [Testing](testing.md) |
| Configure the engine's deploy and shutdown window | [Engine shutdown](engine-shutdown.md) |
| Set the byte ceiling for a route that receives an upload | [Upload byte limits](upload-byte-limits.md) |
| Continue a tenant-scoped list after a saved cursor | [Cursor pagination](cursor-pagination.md) |
| Define whether a resource's existence is visible to a caller | [Resource visibility](resource-visibility.md) |
| Correlate request logs and response IDs across the pipeline | [Call correlation](call-correlation.md) |
| Produce and flush a streaming response | [Streaming responses](streaming-responses.md) |
| Budget an outbound HTTP call and classify its timeout | [Outbound HTTP timeouts](outbound-http-timeouts.md) |

Examples target Ktor 3.x on the JVM and assume matching Ktor artifact versions. JSON examples use server ContentNegotiation with kotlinx.serialization and the Kotlin serialization compiler plugin. Testing examples use `ktor-server-test-host` and `kotlin.test`. Follow the project build and wire contract; snippets omit ordinary imports and use local application types where indicated.
