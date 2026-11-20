# Form submission ownership

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

**Exception:** If the project uses a router form or supports React 19 form Actions, use its established pending and error API. Preserve server validation and define replay semantics for non-idempotent writes regardless of the UI mechanism.

## Verification

1. Click or press Enter with blank, fractional, or overflowing input; assert feedback and zero saves.
2. Hold a valid save pending and attempt a repeat; assert one request and disabled controls.
3. Reject it; assert the draft remains and retry works. Resolve the retry; assert success feedback and restored controls.
