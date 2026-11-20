# FastAPI testing

**Invariant:** HTTP tests exercise the ASGI contract with isolated overrides and correct resource lifetime, not a direct endpoint call.

**Scope:** Version-sensitive for the pairing of Starlette's HTTPX-based `TestClient` and HTTPX. Async transport tests still manage app lifespan explicitly.

## Context

Use this when testing route validation, exception mapping, authentication, overrides, or lifecycle. Direct calls skip ASGI routing, dependency resolution, middleware, validation, and response serialization.

## Rules

- Use `with TestClient(app)` in synchronous tests that need the app lifespan. Use `httpx.AsyncClient` with `ASGITransport` in async tests that share the event loop with async database resources; manage lifespan explicitly because this transport doesn't run it.
- Use a fresh app per test when possible. Override the exact callable used in `Depends`, not its name; restore overrides even after failed requests or assertions. Don't share a mutable override map across concurrent cases.
- Override the minimum boundary. Inject an identity for business-policy tests, but use the real auth dependency for credential parsing and middleware tests.
- Structure tests around an operation, scenario, and expected behavior. Assert status plus the meaningful public body/headers or durable effect; confirm rejected writes did not reach storage.

## Wrong: moving FastAPI out of the test

```python
def test_create_device():
    app.dependency_overrides[current_actor] = lambda: fake_actor
    assert create_device(valid_payload, fake_actor)
```

The direct call bypasses the override, payload parsing, and serialization; the override also leaks into later HTTP tests.

## Right: run the invalid input through the real route

```python
from fastapi.testclient import TestClient

def test_create_device_string_rate_returns_422_without_insert(
    app_factory, fake_actor, fake_device_store, monkeypatch,
):
    app = app_factory()
    monkeypatch.setitem(app.dependency_overrides, current_actor, lambda: fake_actor)
    monkeypatch.setitem(app.dependency_overrides, get_device_store, lambda: fake_device_store)

    with TestClient(app) as client:
        response = client.post("/devices", json={"label": "meter", "sample_rate": "10"})

    assert response.status_code == 422
    assert any(error["loc"] == ["body", "sample_rate"] for error in response.json()["detail"])
    assert fake_device_store.inserts == []
```

This assumes strict rate validation and a storage dependency on the route. `monkeypatch` restores previous values; other runners can use `try/finally`. The fake proves the store wasn't called, not transaction rollback.

## Version choice: synchronous TestClient

- **Starlette `>=0.21.0, <0.37.2`:** With the HTTPX-based client, resolve an HTTPX version `<0.28` compatible with the project's other dependency constraints, then use `with TestClient(app)` as above. Otherwise update FastAPI and its permitted Starlette together rather than forcing an unsupported Starlette version.
- **Starlette `>=0.37.2`:** Use the same `with TestClient(app)` with HTTPX `0.28` when permitted by the resolved dependencies; the removed constructor argument is no longer passed.

[Starlette 0.21.0 switched from Requests to HTTPX](https://www.starlette.dev/release-notes/#0210-september-26-2022), [0.37.2 stopped passing `app=`](https://www.starlette.dev/release-notes/#0372-march-5-2024), and [HTTPX 0.28.0 removed it](https://github.com/encode/httpx/releases/tag/0.28.0). For either supported pairing, the same invalid-rate and lifespan assertions below must pass.

## Exceptions

Use unit tests for domain policy and a production-engine fixture for real constraints and commits. Use a live ASGI server for socket/proxy, stream timing, or disconnect semantics. Leave exception propagation enabled for most tests; disable it only when the rendered server-error response is the contract.

## Verification

1. Run the invalid, authenticated success, and missing-credential cases individually and together with the route suite, using the project's pytest entry point.
2. Locally switch the affected field to permissive parsing or bypass the changed permission check and rerun the relevant regression. Pass if the targeted regression fails for the expected behavior and returns to green after restoring the rule.
3. Exercise lifespan teardown in a separate test and make a request afterward using a new app without overrides. Pass if cleanup occurred, no fake identity leaks, and the unoverridden app enforces real auth.

Reference: [FastAPI lifespan tests](https://fastapi.tiangolo.com/advanced/testing-events/), [async tests](https://fastapi.tiangolo.com/advanced/async-tests/), and [dependency overrides](https://fastapi.tiangolo.com/advanced/testing-dependencies/).
