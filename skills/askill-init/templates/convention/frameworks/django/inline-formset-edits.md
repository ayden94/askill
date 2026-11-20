# Django inline formset edits

**Read when:** Editing a parent and its related rows together, or adding a rule across editable rows.

## Decision

Bind the same authorized parent on GET and POST, render the formset's management form, and validate all inputs before any save. Put aggregate validation in the inline formset and group writes in a transaction. Limit how many forms a hostile or malformed request can cause the server to instantiate.

## Bad

```python
for title in request.POST.getlist("title"):
    Chapter.objects.create(book=book, title=title)
BookForm(request.POST, instance=book).save()
```

Child rows survive a later parent validation failure, and omission cannot be distinguished from an explicit deletion.

## Good

```python
from django.db import transaction
from django.forms import inlineformset_factory

ChapterSet = inlineformset_factory(
    Book, Chapter, fields=("title",), extra=1, can_delete=True,
    max_num=20, validate_max=True, absolute_max=30,
)


def update_book(request, book):
    form = BookForm(request.POST, instance=book)
    chapters = ChapterSet(request.POST, instance=book, prefix="chapters")
    parent_valid, chapters_valid = form.is_valid(), chapters.is_valid()
    if not (parent_valid and chapters_valid):
        return render(request, "catalog/edit_book.html", {"form": form, "chapters": chapters})
    with transaction.atomic():
        form.save()
        chapters.save()
    return redirect("book-detail", pk=book.pk)
```

## Assumptions and exceptions

`book` was already authorized by the POST view, and GET uses the same prefix. The template renders `chapters.management_form` and each form's hidden fields. For cross-row rules, subclass `BaseInlineFormSet`, call `super().clean()`, and exclude deleted or invalid forms; constraints applying to concurrent writers still belong in the database where possible.

## Verification

In a client test, submit the rendered management data with one update, one creation, and one explicit deletion. Check the precise database diff. Repeat with an invalid later form, missing `TOTAL_FORMS`, an inflated count, and a child ID from another book. Verify malformed forms don't persist changes and the foreign child never changes; inject a child save failure to confirm the parent update rolls back.
