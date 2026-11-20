# React rulebook

Start with the leaf for the change. Use the installed `react` and renderer versions, the app's router and data layer, and the existing test configuration as the source of truth. These examples use function components and ordinary Hooks available in React 18 and 19; opt into newer APIs only when the installed version and integration support them.

| Task | Read |
| --- | --- |
| Add filters, selections, or editable list rows | [Render purity and state identity](render-and-state.md) |
| Subscribe, run a timer, or fetch on a changing input | [Effects and async lifetimes](effects-and-async.md) |
| Save a form, handle rejected input, or prevent repeat submits | [Form submissions](form-submissions.md) |
| Prove behavior after a reorder, keyboard interaction, or failed request | [Interaction testing](testing.md) |
