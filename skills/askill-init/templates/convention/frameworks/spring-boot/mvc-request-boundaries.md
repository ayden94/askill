# Spring Boot MVC request boundaries

## Context

Use this for servlet controllers, JSON request/response changes, or failures exposed to clients. MVC/Jackson binding, Bean Validation, Spring Security, and domain rules protect different parts of the request.

## Rules

- Bind explicit transport DTOs and trigger validation with `@Valid` on request bodies; use `@Valid` on nested objects when cascading is required. Choose constraints for both presence and range (`@Positive` alone accepts `null`).
- Resolve identity via Spring Security. Scope object lookups and mutations in the use case; never use a client-supplied owner as authority. Keep CSRF protection for session-based mutations.
- Return a public DTO rather than a JPA entity. It stabilizes the contract and avoids leaking private fields, lazy fetches, or recursive object graphs during Jackson serialization.
- Use narrow MVC exception mappings for domain conflicts and explicit validation failures. Preserve the project's error envelope; verify both binding and method-validation branches when present. Do not map unexpected persistence or programming errors to `400`.

## Wrong: binding and returning a JPA entity

```java
@PostMapping("/profiles")
Profile create(@RequestBody Profile profile) {
    return profiles.save(profile);
}
```

Persistence fields such as `ownerId` or `approved` become potential client inputs, and serialization can traverse fields or relations that aren't part of the public contract.

## Right: validate the DTO, derive identity, project a response

```java
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

record CreateProfile(@NotBlank @Size(max = 80) String displayName) {}
record ProfileView(String id, String displayName) {}

@RestController
class ProfileController {
    private final CreateProfiles createProfiles;

    ProfileController(CreateProfiles createProfiles) {
        this.createProfiles = createProfiles;
    }

    @PostMapping("/profiles")
    @ResponseStatus(HttpStatus.CREATED)
    ProfileView create(@Valid @RequestBody CreateProfile body, Principal caller) {
        var result = createProfiles.create(caller.getName(), body.displayName());
        return new ProfileView(result.id(), result.displayName());
    }
}
```

The security chain must require an authenticated caller at this route. The DTO projection costs a little mapping code but stops persistence details from silently changing the API. Choose and test whether Jackson rejects or ignores unknown keys; either way they must not change stored ownership.

## Exceptions

A read-only report may start with a query projection, but keep its public shape explicit. WebFlux uses a different test and filter stack; don't use MockMvc there. For views or forms, errors may belong in binding results rather than a JSON advice handler.

## Verification

1. Run `MockMvc` with actual MVC validation and the relevant security filter chain; submit invalid JSON, a blank name, an overlong name, and a valid authorized request.
2. Exercise anonymous and denied callers separately from malformed input. If session based, include a missing-CSRF case and a token-bearing control. Submit an extra `ownerId` as a caller who must not assign ownership.
3. Pass if denied or invalid requests never call the use case, the owner comes from authentication or extra fields are rejected, and a `201` body includes only the public fields.

Reference: [Spring Framework 6.2 MVC validation](https://docs.spring.io/spring-framework/reference/6.2/web/webmvc/mvc-controller/ann-validation.html).
