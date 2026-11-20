# Java rulebook

Read only the leaves that apply to the change; choose multiple rows when contracts overlap. Start with the repository's JDK/toolchain and target release, nullability conventions, and build wrapper. The examples use Java 17 syntax as a reference, not as a project minimum; adapt syntax to the configured release.

| If you are changing… | Read |
| --- | --- |
| Request fields, configuration, or lookup outcomes | [Boundary validation and absence](boundary-validation.md) |
| Constructors, mutable collections, or domain transitions | [Domain invariants and collection ownership](domain-invariants.md) |
| File/JDBC lifetimes or exception translation | [Resource ownership and exception translation](resource-ownership.md) |
| A reproducible bug, time-based rule, or database transaction | [Testing behavior and durable effects](testing.md) |
| Shared state or atomic claims across threads | [Concurrent state transitions](concurrent-state.md) |
| Executor tasks, interruption, or shutdown | [Task ownership and interruption](task-ownership.md) |
| Calendar deadlines, zone transitions, or timestamp storage | [Time and zone boundaries](time-boundaries.md) |
| Decimal amounts, currency scale, or rounding | [Decimal precision](decimal-precision.md) |
| Collection keys, equality, or order | [Collection semantics](collection-semantics.md) |
| A published Java method, interface, or JAR upgrade | [API and binary compatibility](api-compatibility.md) |
| Stream reductions, parallelism, or aggregation | [Stream reductions](stream-reductions.md) |

For a new persistence endpoint, read boundary validation for the input contract, resource ownership for the adapter, and testing for the durable effect. Use actual project libraries and runner settings; these examples do not mandate new dependencies.
