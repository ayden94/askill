# FastAPI query parameter models

**Invariant:** Query parsing preserves repeated values, rejects invalid or unknown filters before storage access, and exposes filters as query parameters in OpenAPI.

**Scope:** Version-sensitive for grouped FastAPI query binding; the main example uses Pydantic v2. The individual-parameter recipe works without a Pydantic model declaration.

**Read when:** A list gains several filters, multiple values for one key, or a paging limit.

## Decision

With FastAPI 0.115.0 or later and Pydantic v2, declare a query model with `Annotated[Model, Query()]`. Name supported filters, choose how to handle unknown parameters, and map sort tokens to known storage orderings instead of passing raw identifiers to a query builder.

## Bad

```python
@router.get("/devices")
def list_devices(request: Request):
    query = request.query_params
    return store.list(limit=int(query.get("limit", 50)),
                      tags=[query["tags"]] if "tags" in query else [],
                      order_by=query.get("sort", "created_at"))
```

An invalid integer escapes normal input validation, and dictionary-style access does not preserve repeated tag values.

## Good

```python
from typing import Annotated, Literal
from fastapi import Query
from pydantic import BaseModel, ConfigDict, Field


class DeviceFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")
    limit: int = Field(default=50, ge=1, le=100)
    tags: list[str] = Field(default_factory=list, max_length=10)
    sort: Literal["newest", "name"] = "newest"


@router.get("/devices")
def list_devices(filters: Annotated[DeviceFilters, Query()]):
    ordering = {"newest": ("-created_at", "-id"), "name": ("name", "id")}
    return store.list(limit=filters.limit, tags=filters.tags,
                      order_by=ordering[filters.sort])
```

## Version choice: query binding

- **FastAPI >=0.115.0 with Pydantic v2:** Use the model above. [FastAPI 0.115.0 introduced query parameter models](https://fastapi.tiangolo.com/release-notes/#01150-2024-09-17); the [query model guide](https://fastapi.tiangolo.com/tutorial/query-param-models/) documents rejecting extra keys.
- **FastAPI <0.115.0, or >=0.115.0 without the Pydantic v2 model API:** Use [individual query parameters](https://fastapi.tiangolo.com/tutorial/query-params-str-validations/#query-parameter-list-multiple-values) so lists aren't inferred as a GET body:

  ```python
  from typing import List, Literal
  from fastapi import HTTPException, Query, Request

  @router.get("/devices")
  def list_devices(
      request: Request,
      limit: int = Query(50, ge=1, le=100),
      tags: List[str] = Query(default=[]),
      sort: Literal["newest", "name"] = Query("newest"),
  ):
      errors = [
          {"loc": ["query", key], "msg": "Unknown filter", "type": "extra_forbidden"}
          for key in sorted(set(request.query_params) - {"limit", "tags", "sort"})
      ]
      if len(tags) > 10:
          errors.append({"loc": ["query", "tags"], "msg": "At most 10 tags", "type": "too_long"})
      if errors:
          raise HTTPException(422, detail=errors)
      ordering = {"newest": ("-created_at", "-id"), "name": ("name", "id")}
      return store.list(limit=limit, tags=tags, order_by=ordering[sort])
  ```

  This preserves status and field locations with the default handlers; normalize both error paths if exact envelope fields are a public contract.

## Assumptions and exceptions

This list is public; scope any nonpublic list to the actor before applying filters. `store.list` accepts structured order terms. Rejecting unknown keys may break clients that already send optional tracking keys; choose that compatibility policy deliberately.

## Verification

With either recipe, send `?tags=lab&tags=spare&sort=name&limit=1` and verify the repository receives both tags and the exact tie-broken order. Send `limit=0`, `limit=101`, eleven tags, an unsupported sort token, and a mistyped key; each must return the documented validation response without invoking the repository. Check OpenAPI describes these as query parameters, not a GET request body.
