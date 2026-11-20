# Spring MVC problem details and diagnostics

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

## Verification

Through MockMvc with advice installed, raise `RevisionConflict` and assert `409`, `application/problem+json`, the exact type, and safe detail even with a sentinel in the exception text. Through the full local server, throw an unexpected failure and verify `500`, no sentinel or stack trace in the response, and one correlated report in the configured protected sink.
