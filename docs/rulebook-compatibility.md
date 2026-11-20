# Using a version-aware rulebook

A rulebook describes an observable outcome, not a mandate to adopt the newest API. The host selects topics at preflight; the initializer copies Markdown and does not choose a code branch or verify a runtime version.

1. **Identify the consumer.** For an application, inspect the affected workspace's resolved dependencies, runtime, compiler options, rendering or transport mode, and feature flags. For a published library, check its promised minimum supported configuration as well. The development machine alone is not a support contract.
2. **Read the invariant first.** For example, two sequences that must have the same length must not silently lose trailing input. If the project already has a compatible implementation and the observable result is correct, the example is not a reason to replace it.
3. **Choose a recipe, not a new support policy.** If the implementation differs by release, read both ranges and check the linked upstream source. A minimum version for one API is not a minimum version for the principle. A framework major is not a substitute for checking its optional adapter or separately versioned dependencies.
4. **Run the shared check.** Exercise the failure case as well as the happy path. For an application, reproduce on the supported deployment configuration. For a library claiming both sides, use its existing minimum/current CI jobs or equivalent evidence. Passing on a newer developer runtime is not evidence for the older floor.

In the preflight contract, record the selected leaf, the source of the version constraint, the chosen approach, and what would demonstrate equivalent behavior. An unavailable runtime is an evidence gap, not a passing check. If a topic is portable across the supported range, record why the same approach works rather than manufacturing a legacy branch.

## Scope of the template audit

The audit covered 77 language topics (11 each for JavaScript, TypeScript, Python, Go, Java, Kotlin, and Rust) and 111 framework topics (12 for NestJS; 11 each for React, Next.js, Express, Django, FastAPI, Spring Boot, Gin, Ktor, and Axum). Compatibility notes live in the topic they qualify, not in a separate version-specific copy of the book.

Repository tests verify that selected guides install and remain reachable. They do **not** execute every framework or dependency version. For example, the Python checks ran on 3.9, 3.12, and 3.13, and the NestJS outbound HTTP examples used a loopback fixture on Node 24. Neither result establishes that a consumer application's full integration matrix passed. Keep the consuming project's runtime evidence separate from upstream documentation and from template installation checks.
