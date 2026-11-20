# Render purity and state identity

**Assumptions:** Product IDs are stable and unique among siblings; `PriceEditor` owns a local draft that belongs to one product. Filtering intentionally unmounts hidden editors in this screen.

Derive visible rows from props and filters during render; do not run an Effect to copy them into state. Keep render free of mutations and I/O because React may render again or discard a render. Keep Hooks above conditional exits. Lift writable state to the nearest common owner, store selection by ID, and give stateful list children stable keys. Do not mutate input arrays while sorting.

## Bad

```tsx
const [visible, setVisible] = useState(products);
useEffect(() => {
  setVisible(products.filter(p => p.name.includes(query)));
}, [products, query]);
return visible.map((p, index) => <PriceEditor key={index} product={p} />);
```

## Good

```tsx
const visible = products.filter(p => p.name.includes(query));
return visible.map(p => <PriceEditor key={p.id} product={p} />);
```

The extra state can show the old list for a render. A positional key lets the draft follow the slot instead of its product when rows reorder.

**Exception:** Store drafts separately by product ID if they must survive filtering or teardown. Use memoization only for a measured bottleneck or documented identity contract; it is not an ownership fix. If switching identity should discard all local state, key the subtree by that identity.

## Verification

1. Edit B, insert A above it, and reorder the list. Verify B retains its draft and A does not inherit it.
2. Filter B out and back; verify the documented reset or retention policy. Delete a selected row and check that selection and keyboard focus land at the intended fallback.
3. Run the project's Hooks lint and check empty-to-populated transitions; all render paths must preserve Hook order.
