# Django testing

**Invariant:** A passing test observes the real boundary it claims to protect, distinguishing callback execution from a durable commit.

**Scope:** Portable for Django 4.2 and newer with the built-in test harness; `captureOnCommitCallbacks()` was introduced in [Django 3.2](https://docs.djangoproject.com/en/3.2/releases/3.2/#tests), not 5.2.

## Context

Choose the cheapest harness that includes the boundary being claimed. Most view regressions need URL routing and middleware, not a live server. A database commit or lock claim needs more than `TestCase`'s enclosing transaction.

## Rules

- Use `SimpleTestCase` for database-free logic, `TestCase` plus the Django client for view/database contracts, and `TransactionTestCase` for real commit, rollback visibility, and lock behavior. Use a browser with `LiveServerTestCase` when browser cookie or UI behavior is the contract.
- A `RequestFactory` call does not run middleware. `force_login` arranges identity, not proof of the real login flow. Explicitly enable CSRF checks for CSRF regressions.
- Use `captureOnCommitCallbacks(execute=True)` only to test registration and callback effects, not real commit timing. Exercise lock-dependent behavior against the intended database with distinct connections, deadlines, and cleanup.
- Name the operation, scenario, and expected result. Arrange smallest viable fixtures; assert persisted effects and absence of unauthorized writes, not just response truthiness.

## Wrong: assuming a client call commits in `TestCase`

```python
class ArticleTests(TestCase):
    def test_publish(self):
        self.client.force_login(self.owner)
        self.client.post(self.publish_url)
        self.assertEqual(len(mail.outbox), 1)
```

The enclosing transaction rolls back, so an `on_commit` callback won't normally run. The method also never checks that posting succeeded.

## Right: exercise the callback contract explicitly

```python
from django.core import mail
from django.test import TestCase, override_settings

@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ArticleTests(TestCase):
    # setUp arranges an owned draft, its publish URL, and its subscriber.
    def test_publish_owned_draft_registers_one_notification(self):
        self.client.force_login(self.owner)

        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            response = self.client.post(self.publish_url)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(len(callbacks), 1)
        self.assertEqual([message.to for message in mail.outbox], [[self.subscriber.email]])
```

This checks the route registers and can execute the expected callback, while keeping `TestCase`'s fast isolation. Add a separate real-commit test if timing or cross-connection visibility matters.

## Exceptions

Use a direct view call for an isolated branch only if middleware/session/serialization behavior is covered elsewhere. If tests cannot use the production backend locally, run backend-dependent cases in CI and label local SQLite checks as smoke tests, not lock verification.

## Verification

1. Run the regression by dotted label with `python manage.py test <dotted-test-label>`, then with its app suite. Test authorized, anonymous, and unauthorized cases separately.
2. Temporarily omit the callback registration in a local reproduction of the bug. Pass the regression-quality check only if the test fails for the missing callback and passes once restored.
3. For a commit claim, use `TransactionTestCase` and an independent connection to inspect durable data after the use case. Pass if effects appear only after commit and stay absent after rollback, without relying on test order or sleeps.

Reference: [Django 5.2 testing tools](https://docs.djangoproject.com/en/5.2/topics/testing/tools/) and [testing callbacks](https://docs.djangoproject.com/en/5.2/topics/db/transactions/#use-in-tests).
