# Hydration and first render

## When to read

Render UI on the server when browser-only state, time zones, or changing data can produce a different first client render.

**Assumptions:** A shipping estimate can show UTC before hydration and switch to viewer-local formatting afterwards. The same ISO instant reaches the server HTML and the hydrating component.

Make the initial render deterministic across environments, including formatting, identifiers and element nesting. Pass serializable server data once and defer browser-only personalization until after hydration. Do not suppress tree-wide mismatch diagnostics.

## Bad

```tsx
function Arrival({ iso }: { iso: string }) {
  return <time dateTime={iso}>{new Date(iso).toLocaleString()}</time>;
}
```

## Good

```tsx
function Arrival({ iso }: { iso: string }) {
  const [local, setLocal] = useState(false);
  useEffect(() => { setLocal(true); }, []);
  const date = new Date(iso);
  return <time dateTime={iso}>
    {local ? date.toLocaleString() : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`}
  </time>;
}
```

Validate the instant before rendering. The second render trades immediate personalization for identical, still useful HTML. If the request reliably supplies a locale and time zone, serialize the formatted label or a consistent formatting input; never have server and browser independently guess defaults.

## Verification

1. Serve HTML from a UTC environment and hydrate using a browser context in another time zone. Assert the original UTC label, correct localized label after hydration and no mismatch diagnostic.
2. Disable JavaScript and confirm the estimate still identifies its time zone. Repeat with a narrow viewport to detect a distracting layout shift on enhancement.
