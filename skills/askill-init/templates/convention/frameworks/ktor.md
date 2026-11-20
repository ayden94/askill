# Ktor

- Keep routing and installed plugins separate from domain decisions.
- Use the application test host to exercise routing, serialization, and failure status codes.

## Compose routes around application operations

Let routes decode input, obtain the principal, invoke the use case, and encode a response. Keep business rules independent of ApplicationCall. Install error mapping and serialization in one shared configuration used by both production and the test application.

## Check the plugin boundary

Verify unsupported content types, invalid JSON, and valid requests as separate cases when the contract distinguishes them. Check both status and body; a route returning a success body with an error status is not a passing success case.
