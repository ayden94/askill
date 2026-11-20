# Django existence filters and pagination

**Read when:** A paginated parent list gains a filter on a reverse relation, or parents start repeating across pages.

## Decision

When the predicate is “at least one qualifying child,” filter by correlated `Exists`, not a join that emits a row per match. Order uniquely before slicing. Preserve parent visibility in the base queryset; a child match is not authorization.

## Bad

```python
page = Article.objects.filter(
    workspace_id=workspace_id, comments__is_public=True,
).order_by("-published_at")[offset:offset + limit]
```

Two matching comments can consume two slots. Equal timestamps don't specify which article comes first.

## Good

```python
from django.db.models import Exists, OuterRef

public_comments = Comment.objects.filter(
    article_id=OuterRef("pk"), is_public=True,
)
page = (
    Article.objects.filter(workspace_id=workspace_id)
    .filter(Exists(public_comments))
    .order_by("-published_at", "-pk")[offset:offset + limit]
)
```

## Assumptions and exceptions

`workspace_id` was authorized, `published_at` is non-null, and offsets and limits are bounded. `Exists` doesn't return child data; if the endpoint presents it, fetch the intended children separately for the bounded page. Unique ordering makes ties deterministic but doesn't prevent offset drift under inserts or deletes; use a cursor if that matters.

## Verification

Seed one parent with three public comments, one with just private comments, one with none, and two matching parents sharing a timestamp. Read consecutive pages with a limit of two and check the exact ordered ID sequence and absence of duplicates. Include a foreign-workspace match. On realistic data, run `explain()` on the deployed backend and verify the child lookup and ordering stay within the query budget.
