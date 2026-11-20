# FastAPI scopes and resource access

**Read when:** Adding capability-specific OAuth2 access or allowing a caller to act on only some tenant resources.

## Decision

Declare route capabilities with `Security` and enforce the resulting `SecurityScopes` against verified claims. Apply resource policy separately in the repository or use case. Publishing a scope in OpenAPI doesn't itself authorize anything.

## Bad

```python
@router.get("/exports/{export_id}")
def read_export(export_id: str, actor: Annotated[Actor, Depends(verify_token)]):
    return exports.get_public_summary(export_id)
```

Any authenticated token can retrieve an export by guessing an ID if the lookup ignores its tenant.

## Good

```python
from typing import Annotated
from fastapi import Depends, HTTPException, Security
from fastapi.security import OAuth2PasswordBearer, SecurityScopes

bearer = OAuth2PasswordBearer(tokenUrl="token", scopes={"exports:read": "Read exports"})


def require_actor(scopes: SecurityScopes, token: Annotated[str, Depends(bearer)]):
    actor = verify_token(token)
    if not set(scopes.scopes).issubset(actor.scopes):
        raise HTTPException(403, headers={
            "WWW-Authenticate": f'Bearer error="insufficient_scope", scope="{scopes.scope_str}"',
        })
    return actor


@router.get("/exports/{export_id}")
def read_export(
    export_id: str,
    actor: Annotated[Actor, Security(require_actor, scopes=["exports:read"])],
):
    summary = exports.get_summary_in_tenant(export_id, actor.tenant_id)
    if summary is None:
        raise HTTPException(404, "Export not found")
    return summary
```

## Assumptions and exceptions

`verify_token` independently verifies issuer, audience, and expiry as well as signature, and maps invalid tokens to `401` with a bearer challenge. The illustrative OAuth2 scheme matches an existing token flow; use the actual flow in your app. Here any scoped tenant member can read tenant exports and foreign IDs intentionally look missing.

## Verification

Use the real dependency with local test credentials: missing/invalid token → `401`, valid token without scope → `403`, scoped token for another tenant → `404`, authorized tenant token → public projection only. Assert failed scope checks make no repository calls and OpenAPI declares `exports:read` on this operation.
