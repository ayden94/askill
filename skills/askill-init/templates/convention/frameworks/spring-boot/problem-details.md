# Spring MVC problem details and diagnostics

**Invariant:** Known failures have a stable, safe problem response; unexpected failures stay server errors and produce one protected diagnostic.

**Scope:** Version-sensitive problem response API in Servlet MVC. The Boot 3.5 example uses framework-owned `ProblemDetail`; the wire contract is independent of that type.

**Read when:** Publishing a new domain error, changing error content negotiation, or diagnosing duplicate incident reports.

## Decision

Use Spring MVC `ProblemDetail` in narrowly scoped advice for known failures. Give clients a stable problem type and safe detail. Don't handle the entire exception hierarchy to normalize expected conflicts: infrastructure and programming errors must still reach the server's `500` boundary.

## Bad

```java
@ExceptionHandler(Exception.class)
ResponseEntity<String> error(Exception failure) {
    log.error("Save failed", failure);
    return ResponseEntity.badRequest().body(failure.getMessage());
}
```

The client gets implementation text, and a database outage looks like a client mistake. A second logging boundary may also report the same failure.

## Good

```java
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
class CatalogProblemAdvice {
    @ExceptionHandler(RevisionConflict.class)
    ProblemDetail conflict(RevisionConflict failure) {
        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT, "Reload the article before submitting another edit.");
        problem.setType(URI.create("https://catalog.example/problems/revision-conflict"));
        return problem;
    }
}
```

## Assumptions and exceptions

Use the actual service-owned problem type URI. The expected revision race can be counted without logging a stack trace. Unexpected errors are logged once by the configured boundary with correlation context; never put raw exception detail in the response. Security filter errors occur outside MVC advice and need security entry-point or access-denied handlers if they must share the envelope.

## Version choice: problem representation

- **Spring Framework >=6.0:** Use `ProblemDetail` as above; the [API was introduced in 6.0](https://docs.spring.io/spring-framework/docs/6.0.0/javadoc-api/org/springframework/http/ProblemDetail.html).
- **Spring Framework 5.3, if maintained:** Return the same public fields explicitly using [`ResponseEntity`](https://docs.spring.io/spring-framework/docs/5.3.39/javadoc-api/org/springframework/http/ResponseEntity.html) from the same scoped advice:

  ```java
  @ExceptionHandler(RevisionConflict.class)
  ResponseEntity<Map<String, Object>> conflict(RevisionConflict failure) {
      return ResponseEntity.status(HttpStatus.CONFLICT)
          .contentType(MediaType.APPLICATION_PROBLEM_JSON)
          .body(Map.of("type", "https://catalog.example/problems/revision-conflict",
                       "title", "Conflict", "status", 409,
                       "detail", "Reload the article before submitting another edit."));
  }
  ```

  Import `Map` from `java.util` and `ResponseEntity`/`MediaType` from `org.springframework.http`. If clients rely on `instance` or additional fields, set the same values on both branches rather than relying on framework defaults.

## Verification

Through MockMvc with advice installed, raise `RevisionConflict` and assert `409`, `application/problem+json`, the exact type, and safe detail even with a sentinel in the exception text. Through the full local server, throw an unexpected failure and verify `500`, no sentinel or stack trace in the response, and one correlated report in the configured protected sink.
