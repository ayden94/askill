# Form submission ownership

**Invariant:** A valid submission owns the form while it is pending; invalid input never writes, and a failed save leaves the draft available to retry.

The `onSubmit` recipe is portable across React DOM 18.x and 19.x. Stable React DOM function-valued form Actions and React's `useActionState` are 19.x APIs, not 18.x APIs ([React 19 release notes](https://react.dev/blog/2024/12/05/react-19#form-actions)).

**Assumptions:** A hydrated form saves a positive safe-integer quantity. `saveQuantity` reports transport failures by rejection; the server separately validates and authorizes the write. The state and ref below live at the top level of the form component.

Submit through `onSubmit`, which covers click and Enter. Keep draft, pending, and recoverable feedback distinct. Parse the DOM string at the boundary instead of claiming it is a number. Keep the draft on failure and announce useful feedback; disable repeated submit for this form while the first request is in flight.

## Bad

```tsx
<button onClick={() => void saveQuantity(Number(draft))}>Save</button>
```

## Good

```tsx
const busy = useRef(false);
const [pending, setPending] = useState(false);
const [message, setMessage] = useState('');

async function submit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (busy.current) return;
  const quantity = Number(draft);
  if (!/^[1-9]\d*$/.test(draft) || !Number.isSafeInteger(quantity)) {
    setMessage('Enter a positive whole quantity.');
    return;
  }
  busy.current = true;
  setPending(true);
  setMessage('');
  try {
    await saveQuantity(quantity);
    setMessage('Saved.');
  } catch {
    setMessage('Could not save. Try again.');
  } finally {
    busy.current = false;
    setPending(false);
  }
}

return <form onSubmit={submit}>
  <label>Quantity <input value={draft} disabled={pending}
    onChange={event => setDraft(event.target.value)} /></label>
  <button disabled={pending}>Save</button>
  <p role="status">{message}</p>
</form>;
```

The immediate ref guards calls before a disabled-button render commits. This is UI deduplication, not idempotency: a timeout or another tab can still repeat a write.

**React DOM 18.x:** Use the `onSubmit` recipe above or the installed router's form integration. Keep the explicit in-flight guard when using the recipe above.

**React DOM 19.x:** For a project using form Actions, replace the submit handler and its local pending/message flags with the Action's state. Keep the quantity controlled: returning validation or transport feedback normally can still reset uncontrolled fields ([React DOM `<form>`](https://react.dev/reference/react-dom/components/form)).

```tsx
const [message, saveAction, pending] = useActionState(async (_previous: string, fields: FormData) => {
  const raw = fields.get('quantity');
  const quantity = typeof raw === 'string' ? Number(raw) : NaN;
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(quantity)) {
    return 'Enter a positive whole quantity.';
  }
  try {
    await saveQuantity(quantity);
    return 'Saved.';
  } catch {
    return 'Could not save. Try again.';
  }
}, '');

return <form action={saveAction}>
  <label>Quantity <input name="quantity" value={draft} disabled={pending}
    onChange={event => setDraft(event.target.value)} /></label>
  <button type="submit" disabled={pending}>Save</button>
  <p role="status">{message}</p>
</form>;
```

Either version must disable submission once pending is visible, retain the draft after rejection, and allow the same valid retry. A disabled button is not a guard against pre-commit or programmatic replays; preserve server validation and define replay semantics for non-idempotent writes with either UI.

## Verification

1. Click or press Enter with blank, fractional, or overflowing input; assert feedback and zero saves.
2. Hold a valid save pending, wait for disabled controls, and attempt a repeat through the UI; assert one request. For the `onSubmit` recipe also exercise the immediate ref guard before the disabled render commits.
3. Reject it; assert the draft remains and retry works. Resolve the retry; assert success feedback and restored controls.
