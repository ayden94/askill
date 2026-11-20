# List identity across persistence

**Invariant:** A create acknowledgement, retry, or refetch never replaces the mounted editor merely because a server ID arrived.

Sibling key and state identity in this recipe are portable across React 18.x and 19.x. A stable key preserves component identity, not a browser guarantee of focus or selection when a focused DOM node is physically moved.

## When to read

Add an optimistic list row that an acknowledgement, refresh, or retry will reconcile with a saved record.

**Assumptions:** The acknowledgement can be correlated with the optimistic row. `addTask` accepts an idempotency token and returns the same saved ID when a timed-out create is replayed with that token.

Separate the mounted row's UI identity from its eventual server ID. Allocate the UI ID once in the create event, not in render or a state updater. Reconcile into that row and keep its key through success, failure and retry; use the server ID for later persisted mutations.

## Bad

```tsx
return tasks.map(task => <TaskEditor
  key={task.serverId ?? task.uiId} task={task}
/>);
```

## Good

```tsx
function addDraft(title: string) {
  const uiId = crypto.randomUUID();
  setTasks(rows => [...rows, { uiId, title, status: 'saving' }]);
  void persist(uiId, title);
}

async function persist(uiId: string, title: string) {
  try {
    const saved = await addTask({ title, idempotencyKey: uiId });
    setTasks(rows => rows.map(row => row.uiId === uiId
      ? { ...row, serverId: saved.id, status: 'saved' }
      : row));
  } catch {
    setTasks(rows => rows.map(row => row.uiId === uiId
      ? { ...row, status: 'failed' }
      : row));
  }
}

return tasks.map(task => <TaskEditor key={task.uiId} task={task} />);
```

Here retry serializes attempts and uses the original create payload; editor edits remain a separate draft. Match refetched records to the retained key by server ID or the echoed create token before merging, not by title. If the API accepts a durable client-generated ID, one ID can serve both roles. UI identity alone does not make a remote write idempotent.

## Verification

1. Type into the optimistic editor, put its caret mid-word, and resolve the create without a reorder. Assert draft, focus and caret survive. Also reorder on acknowledgement and assert the draft follows its editor; if focus and selection must survive a DOM move, verify that separately in a real browser and restore them after commit if needed.
2. Simulate a committed create with a lost response, retry, and refresh the list before and after acknowledgement. Assert one persisted row and one editor with its draft intact.
