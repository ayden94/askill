# Django schema and migrations

**Invariant:** Fresh and upgraded databases converge on the intended schema without losing valid existing data, and constraints protect invariants from every writer.

**Scope:** Portable migration ordering and historical model use; version-sensitive constructor keywords for database check constraints. Examples target Django ORM and the deployed database engine.

## Context

Use this for uniqueness, data backfills, and changes to a populated table. Application validation gives friendly feedback; the database must protect rules that apply to imports, admin actions, and concurrent writes.

## Rules

- Define durable invariants with named constraints, accounting for nulls, case normalization, and backend support. A pre-insert query can't guarantee uniqueness; translate only the expected integrity error at the service boundary.
- In `RunPython`, use `apps.get_model` and query the alias from `schema_editor.connection.alias`; migrations run against a historical app registry, not today's model implementation. Declare cross-app migration dependencies when accessing historical models from other apps.
- For rolling deploys, expand first, keep mixed versions compatible, backfill separately, and enforce new constraints only after checking existing rows. Plan how writes arriving during the backfill become valid.
- Review generated DDL and lock/duration risk on the production engine. Decide reversibility explicitly; don't invent a reverse that silently destroys data.

## Wrong: importing the live model

```python
from catalog.models import Article

def backfill(apps, schema_editor):
    Article.objects.filter(status__isnull=True).update(status="draft")
```

Later fields and managers can make a fresh install fail when this old migration replays. The query may also hit the wrong database.

## Right: use the migration state and connection

```python
from django.db import migrations

def backfill(apps, schema_editor):
    Article = apps.get_model("catalog", "Article")
    alias = schema_editor.connection.alias
    Article.objects.using(alias).filter(status__isnull=True).update(status="draft")

class Migration(migrations.Migration):
    dependencies = [("catalog", "0004_expand_status")]
    operations = [migrations.RunPython(backfill)]
```

The prior migration supplies a nullable column; a later migration can make it required. This update is repeatable and leaves existing non-null statuses alone. It's intentionally irreversible because a previous `NULL` can't be distinguished from an original `"draft"`. One set-based update is simple but can hold locks too long on a large table.

## Version choice: named check constraint

For example, to enforce nonnegative stock, import `CheckConstraint` and `Q` from `django.db.models`. Use the appropriate construction in `Stock.Meta.constraints` (and inspect the generated migration):

- **Django 4.2–5.0:** `CheckConstraint(check=Q(available__gte=0), name="stock_available_nonnegative")`.
- **Django >=5.1:** `CheckConstraint(condition=Q(available__gte=0), name="stock_available_nonnegative")`. The old keyword was [deprecated in 5.1](https://docs.djangoproject.com/en/5.1/releases/5.1/#miscellaneous) and [removed in 6.0](https://docs.djangoproject.com/en/6.0/releases/6.0/#features-removed-in-6-0). Check historical migration replay as well as current models when upgrading.

On either branch, migrate a database with valid stock, then assert that a direct negative write is rejected and zero is accepted on the actual production engine.

## Exceptions

Small offline tables may be safe to change in one deployment. For large tables, use bounded, restartable batches and choose transaction boundaries for the backend; looping inside one atomic migration does not turn batches into independent commits. If semantic rollback is mandatory, preserve the original values or design a reversible mapping before rollout.

## Verification

1. Run `python manage.py makemigrations --check --dry-run` and inspect `python manage.py migrate --plan`.
2. On an ephemeral database of the production engine, migrate from empty and from `0004_expand_status` with both null and explicit statuses. Start from the previous release's fixtures rather than creating them with the current model.
3. After the enforcing migration, attempt a null insert at the database boundary. Pass if both forward paths succeed, row counts and existing non-null values are preserved, the constraint rejects the invalid insert, and timing/locks are within the rollout budget.

Reference: [Django 5.2 historical models](https://docs.djangoproject.com/en/5.2/topics/migrations/#historical-models) and [migration operations](https://docs.djangoproject.com/en/5.2/ref/migration-operations/).
