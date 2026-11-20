# Django exception reporting

**Read when:** A form or view starts handling credentials, or a change alters what production exception reports contain.

## Decision

Leave unexpected exceptions visible to the configured server-error boundary and keep `DEBUG=False` outside private development. Mark known secrets where they're read for Django's exception reporter. Do not log a raw body as a substitute for identifying the failing operation.

## Bad

```python
def rotate_key(request):
    try:
        return perform_rotation(request.user, request.POST["recovery_code"])
    except Exception:
        logger.exception("rotation failed: %s", request.POST)
        return HttpResponseBadRequest("Rotation failed")
```

This leaks posted fields to ordinary logs and labels defects as client mistakes.

## Good

```python
from django.views.decorators.debug import sensitive_post_parameters, sensitive_variables
from django.views.decorators.http import require_POST


@sensitive_post_parameters("recovery_code")
@require_POST
def rotate_key(request):
    return rotate_from_form(request.user, request.POST)


@sensitive_variables("recovery_code", "data", "form")
def rotate_from_form(user, data):
    form = RecoveryForm(data)
    if not form.is_valid():
        return HttpResponseBadRequest("Invalid recovery request")
    recovery_code = form.cleaned_data["recovery_code"]
    return perform_rotation(user, recovery_code)
```

## Assumptions and exceptions

Identity and CSRF enforcement are configured on the route. These decorators affect Django's reporter under its production filter; they don't scrub exception messages, downstream frames, arbitrary JSON, reverse-proxy logs, or a third-party collector. Mark sensitive variables where downstream code stores them too, and configure each sink independently.

## Verification

With `DEBUG=False` and `Client(raise_request_exception=False)`, inject a downstream failure using a sentinel recovery code. Capture the configured report and log sinks, and assert the sentinel is absent from all of them and from the generic `500` response. Submit invalid form data separately and expect the intentional `400` without a server-error report.
