# Common

- Follow naming, module boundaries, and tooling already used in the affected area. Prefer extending an existing seam to creating a parallel abstraction.
- Keep the diff within the agreed scope. Do not fold unrelated cleanup, dependency changes, or contract changes into a refactor.
- Check input at the boundary, and make failure explicit without exposing secrets or sensitive data.
- Use existing formatter, lint, and build commands. Record checks that could not run.
