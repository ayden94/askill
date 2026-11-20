# Django admin access policy

**Read when:** A `ModelAdmin` is shared by staff from different workspaces or gains an action or editable relation.

## Decision

Admin model permissions are not row-level authorization. Restrict the admin queryset, keep object permission checks consistent with it, and scope editable relations separately. Enforce write policy for add forms, inlines, and custom actions when enabling those paths; filtering the list alone is not enough.

## Bad

```python
@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_filter = ("workspace",)
    fields = ("title", "workspace", "category")
```

The workspace selector is a convenience, not a boundary. Staff with model permission can select another workspace or submit a foreign related ID.

## Good

```python
from django.contrib import admin


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    fields = ("title", "category")
    actions = None

    def get_queryset(self, request):
        return super().get_queryset(request).filter(workspace_id=request.user.workspace_id)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "category":
            kwargs["queryset"] = Category.objects.filter(
                workspace_id=request.user.workspace_id,
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
```

## Assumptions and exceptions

Every admin user has a trusted, non-null workspace; this admin intentionally applies that scope even to superusers and allows updates only. The default model permissions still decide who can view or change. If using autocomplete, scope its related admin queryset as well; form validation protects submission, not search-result disclosure.

## Verification

Use two workspaces with one article and category each. As staff with change permission in the first workspace, check the changelist, request the second workspace's change URL directly, and POST its category ID to an owned article. Assert foreign data is not shown, the forged relation is rejected without a write, and a valid own-workspace edit succeeds. Confirm add/delete and bulk actions are unavailable under this policy.
