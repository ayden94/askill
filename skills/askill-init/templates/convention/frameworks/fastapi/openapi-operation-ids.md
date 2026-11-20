# FastAPI OpenAPI operation IDs

**Invariant:** Every published operation has a unique stable ID independent of Python handler names or router organization.

**Scope:** Portable explicit `operation_id` for FastAPI OpenAPI generation. Do not rely on the version-specific implementation of default ID generation.

**Read when:** Moving an endpoint between routers, renaming its handler, or publishing an OpenAPI schema consumed by code generators.

## Decision

Treat public `operationId` values as client names. Preserve existing IDs for unchanged contracts, require global uniqueness across included routers, and assign explicit IDs where a refactor would otherwise change them. Configure IDs before building the cached schema.

## Bad

```python
app = FastAPI(generate_unique_id_function=lambda route: route.name)
app.include_router(device_router, prefix="/devices")
app.include_router(team_router, prefix="/teams")
```

If both handlers are named `list_items`, both operations now have the same ID. A generator may silently rename one of the methods or overwrite it.

## Good

```python
@device_router.get("/", operation_id="listDevices")
def list_items():
    return devices.list_visible()


@team_router.get("/", operation_id="listTeams")
def list_items():
    return teams.list_visible()


app = FastAPI()
app.include_router(device_router, prefix="/devices")
app.include_router(team_router, prefix="/teams")
```

## Assumptions and exceptions

Use the actually published values in existing APIs; `listDevices` and `listTeams` are examples, not a naming migration. Router snippets omit the existing response models and access dependencies. A private API without generated consumers may accept default IDs. For routes serving multiple methods, inspect each operation; if independent IDs are required, register each method separately.

## Verification

Build the complete app and inspect `/openapi.json`. Collect each HTTP operation's ID, assert uniqueness, and compare the changed paths and methods against a checked-in schema or targeted expected IDs. Rename a handler locally and verify the contract test still passes; duplicate an ID temporarily and verify the test detects it.
