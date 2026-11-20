# Django scheduled management commands

**Invariant:** A command run does bounded work, and repeat or overlapping runs cannot overwrite a row that is no longer eligible.

**Scope:** Portable for Django management commands performing conditional database updates; the separate scheduler and database concurrency guarantees are deployment-specific.

**Read when:** Adding a periodic cleanup, repair, or other Django database maintenance job.

## Decision

Use a finite management command that the existing scheduler invokes, not a loop inside a web worker. Bound each run and make the write recheck eligibility; a row can change between candidate selection and mutation. Decide separately whether overlapping runs are safe or require a scheduler-level exclusion policy.

## Bad

```python
ids = list(Draft.objects.filter(expires_at__lt=timezone.now())
           .values_list("pk", flat=True))
Draft.objects.filter(pk__in=ids).update(status="expired")
```

This pulls every ID into memory and can overwrite drafts that someone publishes after selection.

## Good

```python
from django.core.management.base import BaseCommand
from django.utils import timezone

from catalog.models import Draft


class Command(BaseCommand):
    help = "Expire up to 500 eligible drafts."

    def handle(self, *args, **options):
        eligible = Draft.objects.filter(status="draft", expires_at__lte=timezone.now())
        ids = list(eligible.order_by("pk").values_list("pk", flat=True)[:500])
        changed = eligible.filter(pk__in=ids).update(status="expired")
        self.stdout.write(f"expired={changed}")
```

## Assumptions and exceptions

Expiry is an idempotent database-only state transition; the publishing writer must likewise enforce its state precondition. `update()` skips model `save()` and save signals. If each transition must emit a durable event, record that event atomically with the state transition and relay it separately. Size the schedule to drain the backlog; a zero count isn't necessarily proof that no eligible rows exist under competing writers.

## Verification

Use `call_command("expire_drafts", stdout=...)` with 501 eligible rows plus a future and a published row. Verify successive counts `500`, `1`, `0` and unchanged controls. On the intended database, pause between selection and update in a regression harness, publish one selected draft from another connection, then resume and verify its status and the reported update count.
