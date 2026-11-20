# Django app startup and system checks

**Invariant:** Registry initialization succeeds without application tables or remote services; explicit checks flag invalid configuration before rollout.

**Scope:** Portable for an active `AppConfig` using Django's system check registry; not deployment provisioning or an instance readiness probe.

**Read when:** Adding an app-wide configuration check, signal registration, or initialization hook.

## Decision

Use `AppConfig.ready()` to register behavior, not to run database queries, backfills, remote probes, or timers. The app registry also initializes for management commands and tests, and `ready()` isn't a deployment-wide singleton. Register pure configuration checks and run the relevant checks explicitly before rollout.

## Bad

```python
class CatalogConfig(AppConfig):
    name = "catalog"

    def ready(self):
        from .models import Catalog
        if not Catalog.objects.filter(is_default=True).exists():
            raise RuntimeError("No default catalog")
```

A fresh install can fail before `migrate` creates the table. Repeating startup doesn't make the check safer.

## Good

```python
from django.apps import AppConfig
from django.conf import settings
from django.core.checks import Error, Tags, register


class CatalogConfig(AppConfig):
    name = "catalog"

    def ready(self):
        register(check_catalog_page_size, Tags.models)


def check_catalog_page_size(app_configs, **kwargs):
    if app_configs is not None and not any(c.name == "catalog" for c in app_configs):
        return []
    size = getattr(settings, "CATALOG_PAGE_SIZE", 50)
    if type(size) is not int or not 1 <= size <= 200:
        return [Error("CATALOG_PAGE_SIZE must be an integer from 1 to 200.",
                      id="catalog.E001")]
    return []
```

## Assumptions and exceptions

This is a settings invariant; the stable check function needs no database. Put required row creation in a migration or explicit provisioning task, and check row availability only in a context where the schema is guaranteed. If registering signals in `ready()`, make connections idempotent, for example with a stable `dispatch_uid`.

## Verification

1. Run `python manage.py check --tag models` with sizes `50`, `0`, and `"50"`; expect only the latter two to return `catalog.E001` and fail.
2. Initialize the app and run migrations against an empty disposable database. Verify no catalog table is queried by startup before it exists. If signals changed too, repeat registration in a test and assert one receiver effect per signal.
