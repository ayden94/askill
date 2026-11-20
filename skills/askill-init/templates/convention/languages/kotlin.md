# Kotlin

- Model absence with nullable types or sealed outcomes rather than unchecked non-null assertions.
- Keep coroutine lifetimes structured and do not swallow cancellation in broad exception handlers.

## Make null carry one meaning

Use a nullable result for absence, not for a combination of absence, timeout, and permission denial. Prefer an explicit outcome when the caller must respond differently. Avoid `!!` as a substitute for validation.

## Use structured concurrency

Give child work an owner. Do not launch in a global scope just to return early. Think through whether one child failure should cancel its siblings before choosing a supervisor.

## Prefer readable transformations

Avoid chains of nested `let`, `also`, and `apply` when the receiver or side effect becomes ambiguous. Name an intermediate value or extract the domain decision rather than saving a line.
