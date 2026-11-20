# Discover the project stack

Do this read-only investigation on first setup, before invoking the JSON CLI. On resume, use the saved profile. Never install dependencies, execute build scripts, or change an existing profile just to discover the stack.

1. Find the root manifest and active modules declared by workspace, build, or package configuration. Inspect those modules, not `node_modules`, vendored dependencies, generated output, or unrelated examples. Combine supported presets for independently maintained apps in the same project.
2. Prefer direct dependencies and plugins corroborated by an entry point, build configuration, or source import. Lockfile-only transitive dependencies, test fixtures, and a language used only for tooling are not sufficient.

| Ecosystem | Evidence to inspect |
| --- | --- |
| JavaScript / TypeScript | Check direct dependencies such as `next`, `react`, `express`, and `@nestjs/core`. For NestJS, corroborate with `NestFactory.create(...)`, a root module, or controllers in authored application code. Do not infer an Express application just because Nest uses the Express adapter. Check `tsconfig.json` and authored `.ts`/`.tsx` files for TypeScript; a JS config file alone does not select JavaScript. |
| Python | Read `pyproject.toml` or the project's requirements files for `fastapi` or `django`; check application imports, Django settings, or the ASGI entry point. |
| Java / Kotlin | Read Maven `pom.xml` or Gradle build files for Spring Boot or Ktor plugins and dependencies. Distinguish Java and Kotlin using authored source roots; a Kotlin Gradle build script does not make a Java service Kotlin. |
| Go / Rust | Check `go.mod` and Go imports for Gin, or `Cargo.toml` and Rust entry points for Axum. Include standard-library-only modules without inventing a framework. |

3. Pass `frameworks` and `languages` as arrays of supported preset IDs from the [CLI reference](cli.md). Include multiple entries where the project uses them; omit `project_types` unless explicitly requested. For an unsupported framework, keep any supported language and testing guides, name the missing preset, and do not substitute an unrelated one.
4. If evidence is clear, proceed and summarize it (for example, “`apps/web/package.json` declares Next.js and the app contains `.tsx` routes; using `nextjs` and `typescript`”). Ask a targeted question only when it affects which guides to generate, such as whether a legacy app is still maintained or which stack a new empty repository will use. If no specific guides are wanted, empty arrays select shared rules only.
