# Spring Boot

- Keep transaction boundaries explicit and use constructor injection.
- Use narrowly scoped framework tests for controllers or repositories and integration tests for cross-layer behavior.

## Place transactions around a use case

Keep controllers responsible for transport and place transaction ownership on the service operation that must succeed or fail as a whole. Do not rely on proxy-based advice being applied on a self-invocation. Keep persistence entities separate from externally serialized payloads.

## Match the Spring test to the claim

A controller slice can prove validation or error mapping, not a transaction rollback. For a rollback guarantee, trigger a second-write failure through the actual proxied service and inspect durable data outside the failed transaction.
