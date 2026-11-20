# Backend

- Validate external inputs and enforce authorization at the relevant boundary. Keep public response and error contracts stable unless the change was agreed.
- Preserve data invariants across failures and retries. Check transaction and idempotency behavior when the change affects them.
- Keep secrets, sensitive payloads, and internal error details out of responses and logs.
- Verify changed behavior at an applicable API, job, or storage boundary, not only with mocked internals.
