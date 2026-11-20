# Interaction testing

**Assumptions:** The repo already uses Testing Library, its matching DOM assertions, and `user-event` with `setup()`. `RenameForm` disables Save while the provided `save` promise is pending and keeps the draft when it fails.

Exercise visible controls with their accessible names and await both the interaction and async UI transitions. Stub the boundary (a controlled network response or passed-in operation), not React state or Effects. Avoid sleeps and whole-tree snapshots as assertions of behavior.

## Bad

```tsx
render(<RenameForm save={save} />);
expect(screen.getByText('Save')).toBeInTheDocument();
```

## Good

```tsx
let rejectSave!: (reason: Error) => void;
const save = () => new Promise<void>((_, reject) => { rejectSave = reject; });
const user = userEvent.setup();
render(<RenameForm save={save} />);
const name = screen.getByRole('textbox', { name: 'Name' });
const submit = screen.getByRole('button', { name: 'Save' });
await user.type(name, 'New name');
await user.click(submit);
expect(submit).toBeDisabled();
await act(async () => { rejectSave(new Error('offline')); });
expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
expect(name).toHaveValue('New name');
expect(submit).toBeEnabled();
```

The controlled rejection proves the pending-to-error transition; finding button text alone says nothing about submit wiring or recoverability.

**Exception:** Use a pure-function unit test for complicated deterministic rules. Use a real browser for focus behavior involving native dialogs, layout, or platform interactions a DOM shim does not implement.

## Verification

1. Run the focused interaction spec in the project's runner. Confirm it fails if the pending disable or error feedback is removed.
2. Add a successful retry after rejection; assert the new state and one request per admitted action.
3. Cover keyboard-only submission and focus after row removal in the appropriate environment; check the actual active element, not just DOM presence.
