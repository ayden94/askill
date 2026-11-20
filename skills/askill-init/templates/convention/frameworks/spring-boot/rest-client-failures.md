# Spring RestClient failure mapping

**Invariant:** Only the upstream's documented missing-record status becomes absence; protocol errors, rejected credentials, and outages remain failures.

**Scope:** Version-sensitive synchronous HTTP client API; the example baseline is Boot 3.5 / Spring Framework 6.2.

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

## Version choice: synchronous client

- **Spring Framework >=6.1:** Use the `RestClient.retrieve()` recipe above; [RestClient arrived in 6.1](https://docs.spring.io/spring-framework/docs/6.1.x/javadoc-api/org/springframework/web/client/RestClient.html).
- **Spring Framework 5.3–6.0:** Use the configured [`RestTemplate`](https://docs.spring.io/spring-framework/docs/6.0.0/javadoc-api/org/springframework/web/client/RestTemplate.html) with its default error handler, a base URI handler and equivalent timeouts. Replace the adapter method with:

  ```java
  Optional<StockItem> lookup(UUID id) {
      try {
          StockItem item = template.getForObject("/items/{id}", StockItem.class, id);
          if (item == null) {
              throw new StockProtocolFailure("Expected stock item response body");
          }
          return Optional.of(item);
      } catch (HttpClientErrorException.NotFound ignored) {
          return Optional.empty();
      } catch (RestClientException failure) {
          throw new StockGatewayFailure("Stock lookup failed", failure);
      }
  }
  ```

  Import the client exceptions from `org.springframework.web.client`. If a custom error handler is already installed, verify it preserves the distinction or handle status explicitly instead.

## Verification

With `MockRestServiceServer` bound to the `RestClient.Builder` before building or to the injected `RestTemplate`, simulate `200` with valid, empty, and malformed bodies, `404`, `401`, and `503`. Assert only `404` yields empty and calling code doesn't cache outage results as absent. Against a local stub that delays its body, verify the configured read timeout; a mock status test can't prove timeout behavior.
