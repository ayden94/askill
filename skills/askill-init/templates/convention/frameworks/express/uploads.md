# File uploads

**Invariant:** An upload is visible only after authorization, bounded staging, and successful validation and promotion; rejected or interrupted staging does not leave a published file.

The multipart adapter contract and staging sequence are portable across Express 4.x and 5.x. Use `app.post('/avatars', forwardAsync(requireActor), forwardAsync(postAvatar))` on 4.x with the [explicit forwarding adapter](errors-and-responses.md#good); the direct async registration below is for 5.x ([Express promise forwarding](https://expressjs.com/en/guide/migrating-5.html#rejected-promises-handled-from-middleware-and-handlers)).

## When to read

Accept multipart files or change upload limits, validation, publication or temporary storage.

**Assumptions:** An existing streaming multipart adapter, and private staging on the same filesystem as private committed storage. `stageSingleUpload` fully consumes and validates multipart framing, enforces file and field counts and actual bytes, and removes partial files on rejection or disconnect. Error middleware maps typed size and format failures.

Authorize before parsing. Stage under a server-generated name, cap the actual streamed data, and verify type or content against the product's allowlist; the filename and declared MIME type are only hints. Publish only after parsing and validation complete.

## Bad

```js
app.post('/avatars', bufferAllUploads, async (req, res) => {
  await avatarStore.write(req.file.originalname, req.file.buffer);
  return res.sendStatus(201);
});
```

## Good

```js
async function postAvatar(req, res) {
  const staged = await stageSingleUpload(req, {
    field: 'avatar', maxFileBytes: 2_000_000, maxFields: 0,
  });
  try {
    // Validate by decoding with an input and decoded-pixel budget.
    const image = await inspectAllowedAvatar(staged.path);
    if (!image.ok) return res.status(415).json({ code: 'INVALID_IMAGE' });
    const avatar = await avatarStore.promote(staged.path, {
      ownerId: res.locals.actor.id, id: randomUUID(), format: image.format,
    });
    return res.status(201).json({ id: avatar.id });
  } finally {
    await discardStagedFile(staged.path);
  }
}
app.post('/avatars', requireActor, postAvatar);
```

`promote` atomically transfers ownership of the staged file; `discardStagedFile` is idempotent and reports cleanup failure without overriding a completed response. The adapter and ingress should both bound aggregate request size and duration; design a reaper for artifacts left by crashes. For very large uploads, direct-to-storage staging may be preferable, but verification and publication still need an explicit completion step.

## Verification

1. Upload valid content and verify one committed object under a generated ID. Reject invalid decoded content, a second file part and an over-limit stream without committing an object.
2. Disconnect midway and separately fail promotion; check that staging returns to baseline and readers cannot see a partial object.
3. With either registration, reject staging before it returns a file and assert one mapped failure response and no committed object.
