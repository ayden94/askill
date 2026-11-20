---
name: askill-sync-pr
description: Publish the reviewed head to an authorized PR or MR destination without granting merge authority.
---

# Publish one reviewed head

Recheck the configured destination, remote write grants, and required verdicts for the current head. Look for an existing PR/MR linked to the issue before creating one. Push and create a PR/MR only within their respective grants, then read back the actual remote head and ID.

If no PR destination is configured, report the local verdict. Authorization to publish, passing CI, merging, and cleanup are separate decisions.
