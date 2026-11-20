# Spring MVC method validation

**Read when:** Putting Bean Validation constraints directly on path/query arguments or standardizing validation failures for those routes.

## Decision

On Spring Framework 6.2 with Bean Validation present, use native MVC method validation for constraints on controller arguments. Remove controller-level `@Validated` if migrating from proxy-based validation. Supply the project's public input envelope for both `HandlerMethodValidationException` and `MethodArgumentNotValidException`; don't convert a return-value violation into a client error.

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

## Verification

Using MockMvc with real validation, send `limit=0`, `limit=101`, and then `limit=1`. Exercise a second route with an invalid `@Valid` request body and no direct parameter constraint. Verify both validation branches produce the documented `400` without a service call. Exercise a controller with a violated return constraint and verify a `500`, not the public input problem.
