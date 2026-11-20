# Django async ORM boundaries

**Read when:** An ASGI view becomes async, especially if its ORM work uses a transaction or returns lazy objects.

## Decision

Use async ORM methods for independent operations where supported. For Django 5.2, keep transactional ORM work in one synchronous function called through `sync_to_async(..., thread_sensitive=True)`. Evaluate queries and project the result inside that function; a lazy relation accessed later can perform blocking I/O on the async thread.

## Bad

```python
async def debit_view(request, pk):
    with transaction.atomic():
        account = await Account.objects.select_for_update().aget(pk=pk)
        await account.debit_one()
    return JsonResponse({"label": account.plan.label})
```

Awaiting ORM calls doesn't make the synchronous atomic context async-safe; `account.plan` can also issue another query.

## Good

```python
from asgiref.sync import sync_to_async
from django.db import transaction
from django.http import JsonResponse


@transaction.atomic
def debit_and_project(account_id, owner_id):
    account = Account.objects.select_for_update().get(pk=account_id, owner_id=owner_id)
    account.debit_one()
    return {"balance": account.balance, "label": account.plan.label}


async def debit_view(request, pk):
    actor = await request.auser()
    result = await sync_to_async(debit_and_project, thread_sensitive=True)(pk, actor.pk)
    return JsonResponse(result)
```

## Assumptions and exceptions

The route requires an authenticated caller, enforces the write method and CSRF policy, and the project's boundary maps not-found and insufficient balance errors. The backend supports row locks; `debit_one()` writes synchronously on the same alias and enforces the balance invariant. For an ORM-only endpoint, a synchronous view is often simpler. Verify installed-version support before changing this transaction strategy.

## Verification

Call the endpoint through the project's ASGI harness with a real database and no cached relations. Verify success, foreign-account rejection, and the absence of `SynchronousOnlyOperation`. In a real-commit test inject a failure after `debit_one()` writes and verify the original balance remains visible on an independent connection.
