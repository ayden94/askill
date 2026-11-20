# FastAPI error handlers and diagnostic ownership

**Invariant:** Deliberate HTTP failures preserve their status and protocol headers; unexpected failures expose no implementation detail and reach the diagnostic boundary.

**Scope:** Portable for Starlette-backed HTTP exception dispatch; WebSocket errors, request validation, and post-response failures are separate boundaries.

**Read when:** Introducing a shared error envelope or customizing the treatment of authentication, retry, and internal failures.

## Decision

Treat a framework `HTTPException` as a deliberate public status, preserving its headers when rewriting its body. Register against Starlette's base exception if the handler should also cover routing-generated errors. Map known statuses to safe messages; leave unexpected and response-validation failures to the server-error boundary with protected diagnostics.

## Bad

```python
@app.exception_handler(Exception)
async def error(request, exc):
    return JSONResponse({"message": str(exc)}, status_code=400)
```

This exposes internal exception text and labels defects as invalid requests. It does not replace Starlette's more specific handler for HTTP exceptions.

## Good

```python
from fastapi import Request
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

PUBLIC_CODES = {401: "authentication_required", 403: "forbidden",
                404: "not_found", 405: "method_not_allowed", 429: "rate_limited"}


@app.exception_handler(StarletteHTTPException)
async def public_error(request: Request, exc: StarletteHTTPException):
    if exc.status_code < 200 or exc.status_code in {204, 205, 304}:
        return Response(status_code=exc.status_code, headers=exc.headers)
    return JSONResponse(
        {"code": PUBLIC_CODES.get(exc.status_code, "request_failed")},
        status_code=exc.status_code, headers=exc.headers,
    )
```

## Assumptions and exceptions

The service has a documented envelope and treats `exc.detail` as untrusted. Request validation uses its own handler; if adopting the envelope there too, include approved field paths and error codes rather than raw input. Keep debug responses off in production and assign reporting of unexpected failures to one boundary, not every layer.

## Verification

Exercise an unauthenticated request, an unsupported method, and a rate-limited request; assert the corresponding `WWW-Authenticate`, `Allow`, and `Retry-After` headers survive. Induce a response-schema failure with a sentinel secret and use `TestClient(..., raise_server_exceptions=False)` to inspect the rendered `500`; assert the body contains no secret and the configured internal sink gets one diagnostic.
