# Python conventions

## When to read

Before editing Python code, identify supported interpreter versions, the configured runner, and the process or framework that owns startup. Read the leaf for the behavior you are changing.

| Task | Read |
| --- | --- |
| Add a CLI, file importer, or code run at startup | [Entry points and resource ownership](entry-points.md) |
| Accept a generator, accumulate results, or add an optional collection | [Iterators and call-local state](iterators-and-state.md) |
| Translate a recoverable failure or decide which exceptions to catch | [Exception boundaries](exception-boundaries.md) |
| Test missing configuration, filesystem effects, or rollback | [Testing side effects](testing.md) |
| Acquire a runtime-sized group of resources with partial-failure cleanup | [Dynamic context management](context-stacks.md) |
| Define a versioned JSON record independent of a dataclass layout | [Explicit serialization](serialization.md) |
| Keep a validated dataclass value stable after construction | [Dataclass invariants](dataclass-invariants.md) |
| Run sibling coroutines that must stop together on failure | [Structured asyncio cancellation](async-cancellation.md) |
| Publish a new file without exposing partially written contents | [Atomic file replacement](atomic-file-replacement.md) |
| Launch a CLI with literal argument values and a checked outcome | [Subprocess arguments](subprocess-arguments.md) |
| Interpret an ambiguous local appointment time | [Local time ambiguity](local-time.md) |

Examples use the standard library on Python 3.9+ unless a leaf states a newer requirement. Follow the project's current test framework and configuration rather than adopting another one for these examples.
