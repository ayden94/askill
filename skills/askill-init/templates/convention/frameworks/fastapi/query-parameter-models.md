# FastAPI query parameter models

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

## Assumptions and exceptions

This list is public; scope any nonpublic list to the actor before applying filters. `store.list` accepts structured order terms. `extra="forbid"` may break clients that already send optional tracking keys; choose that compatibility policy deliberately. On older FastAPI, declare individual `Query` parameters and construct the model in a dependency.

## Verification

Send `?tags=lab&tags=spare&sort=name&limit=1` and verify the repository receives both tags and the exact tie-broken order. Send `limit=0`, `limit=101`, an unsupported sort token, and a mistyped key; each must return the documented validation response without invoking the repository. Check OpenAPI describes these as query parameters, not a GET request body.
