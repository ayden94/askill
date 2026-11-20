# Django async ORM boundaries

**Invariant:** A transactional async request either commits its whole authorized update or none of it, and no lazy ORM access escapes onto the event-loop thread.

**Scope:** Version-sensitive for async identity lookup; the transaction bridge is shared. The example baseline is Django 5.2 on ASGI with session/auth middleware and a lock-capable database.

**Read when:** An ASGI view becomes async, especially if its ORM work uses a transaction or returns lazy objects.

## Decision

Use async ORM methods for independent operations where supported. Keep transactional ORM work in one synchronous function called through `sync_to_async(..., thread_sensitive=True)`; both the [Django 5.2](https://docs.djangoproject.com/en/5.2/topics/async/#queries-the-orm) and [6.0](https://docs.djangoproject.com/en/6.0/topics/async/#queries-the-orm) docs describe this restriction. Evaluate queries and project the result inside that function; a lazy relation accessed later can perform blocking I/O on the async thread.

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
    if not actor.is_authenticated:
        return JsonResponse({"error": "authentication_required"}, status=403)
    result = await sync_to_async(debit_and_project, thread_sensitive=True)(pk, actor.pk)
    return JsonResponse(result)
```

## Version choice: authenticated actor

- **Django >=5.0:** Use `await request.auser()` as above; `AuthenticationMiddleware` gained it in [Django 5.0](https://docs.djangoproject.com/en/5.0/releases/5.0/#django-contrib-auth).
- **Django 4.2 (when still maintained by the project):** Resolve the lazy user inside the synchronous bridge, not by passing `request.user.pk` from the event loop. Replace the view with the following, keeping `debit_and_project` unchanged:

  ```python
  def debit_for_request(request, pk):
      actor = request.user
      if not actor.is_authenticated:
          return JsonResponse({"error": "authentication_required"}, status=403)
      return JsonResponse(debit_and_project(pk, actor.pk))

  async def debit_view(request, pk):
      return await sync_to_async(debit_for_request, thread_sensitive=True)(request, pk)
  ```

  See [Django 4.2 async adapters](https://docs.djangoproject.com/en/4.2/topics/async/#async-adapter-functions). Both recipes check identity explicitly here. If you instead decorate the async view with Django's `login_required`, use it directly only on Django >=5.1, which [added its async support](https://docs.djangoproject.com/en/5.1/releases/5.1/#django-contrib-auth). On Django 4.2–5.0, keep the explicit check or make the view synchronous before applying that decorator.

## Assumptions and exceptions

The route uses session identity and a deliberate `403` for anonymous callers. It enforces the write method and CSRF policy at the route boundary, and the project maps not-found and insufficient balance errors. The backend supports row locks; `debit_one()` writes synchronously on the same alias and enforces the balance invariant. For an ORM-only endpoint, a synchronous view is often simpler. Verify installed-version support before changing this transaction strategy.

## Verification

Call either endpoint through the project's ASGI harness with a real database and no cached relations. Verify success, anonymous and foreign-account rejection without a write, and the absence of `SynchronousOnlyOperation`. In a real-commit test inject a failure after `debit_one()` writes and verify the original balance remains visible on an independent connection.
