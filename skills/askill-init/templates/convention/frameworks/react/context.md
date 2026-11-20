# Context and provider scope

**Invariant:** Each consumer reads or updates its nearest feature provider, and independent provider instances do not share feature state.

## When to read

Expose one feature instance's state or behavior to distant descendants without coupling separate feature instances.

**Assumptions:** Two inbox widgets can coexist, each with an independent unread count. Most toolbar actions only write the count; a badge reads it.

`createContext`, `useContext`, and the explicit `.Provider` recipe are portable across React 18.x and 19.x. In 18.x use `<Unread.Provider value={unread}>…</Unread.Provider>`; in 19.x either keep that form or use `<Unread value={unread}>…</Unread>`, and likewise for the dispatch context. The [React 19 release notes](https://react.dev/blog/2024/12/05/react-19#context-as-a-provider) document the shorthand. Both forms must pass the same two-inbox isolation test below.

Place the provider at the smallest shared boundary. Use a missing-provider sentinel when a default would hide wiring mistakes. Split frequently changing data from stable commands if they have different consumers; the split only avoids updates due to the changed context, not all renders from parents or props.

## Bad

```tsx
const InboxContext = createContext({ unread: 0, clear: () => {} });

return <InboxContext.Provider value={{ unread, clear: () => setUnread(0) }}>
  {children}
</InboxContext.Provider>;
```

## Good

```tsx
type UnreadDispatch = Dispatch<SetStateAction<number>>;
const Unread = createContext<number | null>(null);
const UnreadDispatchContext = createContext<UnreadDispatch | null>(null);

function InboxProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  return <UnreadDispatchContext.Provider value={setUnread}>
    <Unread.Provider value={unread}>{children}</Unread.Provider>
  </UnreadDispatchContext.Provider>;
}

function ClearUnreadButton() {
  const setUnread = useContext(UnreadDispatchContext);
  if (!setUnread) throw new Error('Missing InboxProvider');
  return <button type="button" onClick={() => setUnread(0)}>Mark all read</button>;
}
```

Wrap each inbox separately, and have its badge distinguish `null` from a valid zero. In production feature code, expose a narrow command hook if only specific updates are allowed. Prefer props or composition for nearby consumers; extra providers are unnecessary when subscriptions and lifetimes are identical.

## Verification

1. Mount two inboxes, populate both counts, and clear one from its nested toolbar. Assert only that widget's badge changes.
2. Mount a command consumer without its provider and confirm the wiring failure is detected. If splitting for performance, profile a count-only update with unchanged props and confirm command-only consumers aren't invalidated by the count context.
