# Spring RestClient failure mapping

**Read when:** A synchronous HTTP integration must distinguish a legitimate missing record from an upstream outage.

## Decision

Translate at the client adapter, based on the upstream contract. With Spring Framework 6.2 `RestClient.retrieve()`, leave default handling for unrecognized `4xx`/`5xx` statuses and map only intentional responses. Don't turn all client exceptions into absence; timeouts, bad credentials, and malformed payloads are different failures.

## Bad

```java
try {
    return Optional.ofNullable(client.get().uri("/items/{id}", id)
        .retrieve().body(StockItem.class));
} catch (RestClientException ignored) {
    return Optional.empty();
}
```

A failed upstream can now clear inventory or create a false negative in a local cache.

## Good

```java
Optional<StockItem> lookup(UUID id) {
    try {
        StockItem item = client.get().uri("/items/{id}", id)
            .retrieve()
            .onStatus(status -> status.value() == 404, (request, response) -> {
                throw new StockItemMissing();
            })
            .body(StockItem.class);
        if (item == null) {
            throw new StockProtocolFailure("Expected stock item response body");
        }
        return Optional.of(item);
    } catch (StockItemMissing ignored) {
        return Optional.empty();
    } catch (RestClientException failure) {
        throw new StockGatewayFailure("Stock lookup failed", failure);
    }
}
```

## Assumptions and exceptions

The injected client has a configured base URL and bounded connect/read timeouts; the domain exceptions shown are runtime exceptions. Only `404` means absence. Unexpected upstream bodies and URLs stay out of public diagnostics; preserve causes internally under the service's redaction policy. `exchange()` doesn't apply `retrieve()` status handlers, so classify statuses explicitly if switching to it.

## Verification

With `MockRestServiceServer` bound to the same builder, simulate `200` with valid, empty, and malformed bodies, `404`, `401`, and `503`. Assert only `404` yields empty and calling code doesn't cache outage results as absent. Against a local stub that delays its body, verify the configured read timeout; a mock status test can't prove timeout behavior.
