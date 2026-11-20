# React

- Keep render pure and effects scoped to external synchronization.
- Test user interactions through rendered controls; cover pending and failure states.

## Choose one owner for state

Derive filtered rows from inputs during rendering instead of storing a second list and synchronizing it with an effect. Lift state only to the nearest common owner. Keep stable item identities when inserting or sorting rows; array positions are not stable keys for editable items.

## Review the interaction, not the hook

For a search field, make a slower first request resolve after a faster second one. The visible results must still belong to the current query. Check cleanup on unmount and check keyboard focus after deleting the selected row.
