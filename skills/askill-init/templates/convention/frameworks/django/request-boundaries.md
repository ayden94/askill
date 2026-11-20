# Django request boundaries

## Context

Use this when a Django view accepts input, reads a tenant-owned object, or changes state. URL converters validate path syntax, not permission; session login identifies the caller, not which rows they own.

## Rules

- Restrict HTTP methods; keep GET and HEAD free of mutations. For session-cookie writes, keep CSRF middleware active and supply a token instead of exempting the view.
- Resolve the target and any submitted related IDs against the caller's allowed queryset. Apply action-specific permission as well if tenant membership alone does not grant edits.
- Validate transport payloads with a form or the project's API serializer. Consume cleaned fields, not `request.POST`, and explicitly allow mutable fields in a `ModelForm`. Recheck durable invariants at the write boundary.
- Return the project's documented validation/error shape; don't render raw exceptions or include private model fields in a JSON response.

## Wrong: authentication treated as ownership

```python
@login_required
def rename(request, pk):
    article = get_object_or_404(Article, pk=pk)
    article.title = request.POST["title"]
    article.save()
    return redirect("article-detail", pk=pk)
```

Any logged-in user can change another owner's article; missing input also bypasses ordinary form feedback.

## Right: choose the allowed row before applying validated input

```python
from django import forms
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

class RenameForm(forms.Form):
    title = forms.CharField(max_length=120)

@require_POST
@login_required
def rename(request, pk):
    article = get_object_or_404(Article, pk=pk, owner=request.user)
    form = RenameForm(request.POST)
    if not form.is_valid():
        return render(request, "articles/rename.html", {"form": form}, status=400)
    article.title = form.cleaned_data["title"]
    article.save(update_fields=["title"])
    return redirect("article-detail", pk=pk)
```

Scoping the lookup deliberately hides the existence of other owners' records. The narrow update prevents overwriting unrelated columns; it is not a substitute for locking or optimistic concurrency if stale edits must be rejected.

## Exceptions

Use `403` instead of `404` if callers may know a record exists and the contract exposes permission denial. A token-only API or signed webhook needs the adapter's own authentication and replay protections; don't remove CSRF from shared session-based routes. An ordinary HTML form may re-render with `200` if that is the project's UX contract.

## Verification

1. Create two owners and one article per owner. Send an authenticated foreign-ID write, an invalid own-ID write, and a valid own-ID write through the Django client.
2. With `Client(enforce_csrf_checks=True)`, send a valid session-authenticated POST without a token, then send it with a token from the rendered form. Send GET to the POST URL.
3. Pass only if foreign/invalid/tokenless requests leave both records unchanged, GET rejects the method, and the valid owner POST changes only the title and follows the documented redirect.

Reference: [Django 5.2 forms](https://docs.djangoproject.com/en/5.2/topics/forms/) and [CSRF](https://docs.djangoproject.com/en/5.2/howto/csrf/).
