# Accessibility and focus

## When to read

Change a React interaction that removes the focused control or replaces a screen region after a user action.

**Assumptions:** Removing a saved filter is synchronous and local. The section and its visible heading stay mounted, and that heading is the intended next point in the workflow.

Use a named native button so Enter and Space don't need custom handlers. Restore focus only when the focused control is being removed; do not steal focus when background data changes. Apply the move after React commits the new DOM instead of using a timeout or guessing the next element from an array index.

## Bad

```tsx
return filters.map(filter => (
  <div key={filter.id} onClick={() => remove(filter.id)}>Remove {filter.name}</div>
));
```

## Good

```tsx
// Inside the saved-filters component.
const heading = useRef<HTMLHeadingElement>(null);
const removedFocus = useRef(false);

useLayoutEffect(() => {
  if (removedFocus.current) {
    removedFocus.current = false;
    heading.current?.focus();
  }
}, [filters]);

return <section>
  <h2 ref={heading} tabIndex={-1}>Saved filters</h2>
  {filters.map(filter => (
    <button key={filter.id} type="button" onClick={event => {
      removedFocus.current = event.currentTarget === document.activeElement;
      setFilters(current => current.filter(item => item.id !== filter.id));
    }}>
      Remove {filter.name}
    </button>
  ))}
</section>;
```

The heading is programmatically focusable without adding a Tab stop. For frequent row-by-row work, the next surviving control may be better; define an empty-list fallback. For asynchronous removal, move focus after success only if the user hasn't already moved elsewhere.

## Verification

1. Tab to a remove button and press Space or Enter. Assert one removal and focus on the visible heading, including when removing the last row.
2. Focus an unrelated control and apply a background filter refresh. Confirm focus does not move and that the keyboard focus indicator is visible in the actual layout.
