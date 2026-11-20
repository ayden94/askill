# Spring MVC method validation

**Invariant:** Invalid client input cannot reach the use case, and invalid server output must not be reported as a client mistake.

**Scope:** Version-sensitive for direct argument/return validation in Servlet MVC. The Boot 3.5 example targets Spring Framework 6.2 and a Bean Validation provider.

**Read when:** Putting Bean Validation constraints directly on path/query arguments or standardizing validation failures for those routes.

## Decision

On Spring Framework 6.1 and newer with Bean Validation present, use native MVC method validation for constraints on controller arguments. Remove controller-level `@Validated` if migrating from proxy-based validation. Supply the project's public input envelope for both `HandlerMethodValidationException` and `MethodArgumentNotValidException`; don't convert a return-value violation into a client error.

## Bad

```java
@Validated
@RestController
class CatalogController {
    @GetMapping("/articles")
    List<ArticleSummary> list(@RequestParam @Max(100) int limit) {
        return catalog.list(limit);
    }
}
// Existing advice catches only MethodArgumentNotValidException.
```

Class-level `@Validated` selects the proxy-based path if configured, and the body-only handler doesn't normalize the direct parameter failure.

## Good

```java
@RestController
class CatalogController {
    @GetMapping("/articles")
    List<ArticleSummary> list(@RequestParam("limit") @Min(1) @Max(100) int limit) {
        return catalog.list(limit);
    }
}

@RestControllerAdvice
class InputProblemAdvice {
    @ExceptionHandler(HandlerMethodValidationException.class)
    ProblemDetail methodFailure(HandlerMethodValidationException failure) {
        if (failure.isForReturnValue()) {
            throw failure;
        }
        return invalidInput();
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail bindingFailure(MethodArgumentNotValidException failure) {
        return invalidInput();
    }

    private ProblemDetail invalidInput() {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Invalid input.");
    }
}
```

## Assumptions and exceptions

The example intentionally uses a generic message; only include allowlisted codes and paths if the client contract needs field feedback. `limit=abc` fails argument conversion before Bean Validation and needs separate treatment if it shares the envelope. Re-throwing a return-value failure leaves the remaining MVC resolvers to handle the server error. Keep class-level `@Validated` on service beans that intentionally use proxy validation.

## Version choice: direct controller constraints

- **Spring Framework >=6.1:** Use the native MVC recipe above. [Spring MVC added it in 6.1](https://docs.spring.io/spring-framework/reference/6.2/web/webmvc/mvc-controller/ann-validation.html); retain the distinct return-value failure path.
- **Spring Framework 5.3–6.0:** For this scalar input, use an explicit controller guard rather than depending on pre-6.1 MVC to enforce a direct constraint. The body still uses `@Valid` with the [matching namespace](mvc-request-boundaries.md#version-choice-validation-imports). Replace the method and the advice handlers above with these equivalent boundaries:

  ```java
  @GetMapping("/articles")
  List<ArticleSummary> list(@RequestParam("limit") int limit) {
      if (limit < 1 || limit > 100) {
          throw new InvalidCatalogInput();
      }
      return catalog.list(limit);
  }

  // In @RestControllerAdvice; define InvalidCatalogInput as a RuntimeException.
  @ExceptionHandler({InvalidCatalogInput.class, MethodArgumentNotValidException.class})
  ResponseEntity<Map<String, Object>> invalidInput() {
      return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_PROBLEM_JSON)
          .body(Map.of("type", "about:blank", "title", "Bad Request", "status", 400,
                       "detail", "Invalid input."));
  }
  ```

  If the route also enforces an output constraint, check it before returning and throw an internal exception outside that advice on failure. If the app already uses [proxy-based validation](https://docs.spring.io/spring-framework/docs/5.3.39/reference/html/core.html#validation-beanvalidation-spring-method), keep the provider and proxy configured; never map every `ConstraintViolationException` to `400`.

## Verification

With either recipe, use MockMvc with real validation to send `limit=0`, `limit=101`, and then `limit=1`. Exercise a second route with an invalid `@Valid` request body and no direct parameter constraint. Verify both invalid inputs produce the documented `400` without a service call. Through the configured server-error boundary, exercise a controller with a violated return constraint and verify a `500`, not the public input problem.
