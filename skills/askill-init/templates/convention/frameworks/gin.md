# Gin

- Keep request context at the handler boundary and avoid sharing mutable request state.
- Use an HTTP recorder with the configured router to verify responses and middleware behavior.

## Terminate the rejected path

After aborting an unauthorized request, return from the middleware function as well. Aborting the handler chain does not undo work performed later in that same function. Pass domain inputs to services instead of passing the Gin context through every layer.

## Exercise middleware and output

Send malformed input through the mounted route and verify one response with the documented status and no service write. For a streaming or cancelled request, verify resource cleanup rather than asserting only that the handler was called.
