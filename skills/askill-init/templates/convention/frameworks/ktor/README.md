# Ktor rulebook

| Task | Read |
| --- | --- |
| Decode JSON or parameters, validate a DTO, or change negotiation | [Request boundaries](request-boundaries.md) |
| Assemble application modules, mount protected routes, or map failures | [Routing and plugins](routing-and-plugins.md) |
| Change coroutine scope, downstream I/O, or resource shutdown | [Coroutine and resource lifetimes](coroutines-and-resources.md) |
| Verify the installed plugin pipeline and route contracts | [Testing](testing.md) |

Examples target Ktor 3.x on the JVM and assume matching Ktor artifact versions. JSON examples use server ContentNegotiation with kotlinx.serialization and the Kotlin serialization compiler plugin. Testing examples use `ktor-server-test-host` and `kotlin.test`. Follow the project build and wire contract; snippets omit ordinary imports and use local application types where indicated.
