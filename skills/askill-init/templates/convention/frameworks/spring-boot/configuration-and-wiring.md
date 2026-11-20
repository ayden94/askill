# Spring Boot configuration and wiring

**Invariant:** Invalid required configuration fails startup; valid typed configuration wires one reusable client that closes with its owner.

**Scope:** Boot configuration binding and Bean Validation. The policy is portable; validation imports are version-sensitive. The example baseline is Boot 3.5 on Java 17+.

## Context

Use this when adding an environment flag, integrating a service, or changing profile/conditional bean wiring. Deployment configuration is an input contract and should fail during startup, not on the first live request.

## Rules

- Bind related keys with `@ConfigurationProperties` and enable scanning or register explicitly. Use types such as `URI` and `Duration` plus validation on required/range-sensitive inputs; use `@Valid` for nested validation as needed.
- Use constructor injection for required dependencies. Centralize the external client configuration in a bean factory, including I/O timeouts and close ownership. Don't build a client on every request.
- Deliberately choose defaults, including what can safely default in production. Normalize URLs or validate scheme and host when an absolute HTTP endpoint is required. Don't silently fall back to localhost for a required upstream.
- Check effective profiles and property source precedence where values override one another. Keep secrets out of example defaults and logs; do not expose configuration endpoints to untrusted callers.

## Wrong: independent string lookups and a fallback endpoint

```java
@Component
class Billing {
    @Value("${billing.endpoint:http://localhost:8080}")
    String endpoint;

    @Value("${billing.timeout:0}")
    String timeout;

    Receipt bill(Invoice invoice) {
        return new BillingClient(URI.create(endpoint), Duration.parse(timeout)).charge(invoice);
    }
}
```

A broken timeout is found only on a live request; the implicit endpoint can route production traffic to an unintended target. The per-call client also loses connection reuse.

## Right: bind and validate before wiring a shared client

```java
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

import java.net.URI;
import java.time.Duration;

@Validated
@ConfigurationProperties("billing")
record BillingProperties(@NotNull URI endpoint, @NotNull Duration timeout) {
    @AssertTrue(message = "billing endpoint must be an absolute HTTPS URL")
    public boolean isHttpsEndpoint() {
        return endpoint != null && "https".equalsIgnoreCase(endpoint.getScheme())
                && endpoint.getHost() != null;
    }

    @AssertTrue(message = "billing timeout must be between 0 and 10 seconds, excluding 0")
    public boolean isBoundedTimeout() {
        return timeout != null && !timeout.isNegative() && !timeout.isZero()
                && timeout.compareTo(Duration.ofSeconds(10)) <= 0;
    }
}

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(BillingProperties.class)
class BillingConfiguration {
    @Bean(destroyMethod = "close")
    BillingClient billingClient(BillingProperties config) {
        return new BillingClient(config.endpoint(), config.timeout());
    }
}
```

The application supplies a thread-safe, closeable `BillingClient` and a Bean Validation provider. Explicit registration makes this configuration usable in an isolated context runner; scanning is convenient when the project consistently uses it.

## Version choice: validation namespace

- **Boot 2.7 (if maintained):** Use `javax.validation.constraints.AssertTrue` and `javax.validation.constraints.NotNull` with the matching Boot-managed validation starter/provider. Keep the single-constructor record on Java 17 and explicitly enable the properties as above ([Boot 2.7 constructor binding](https://docs.spring.io/spring-boot/docs/2.7.18/reference/html/features.html#features.external-config.typesafe-configuration-properties.constructor-binding)).
- **Boot >=3.0:** Use the `jakarta.validation.constraints` imports shown and the Jakarta provider managed by Boot. The namespace cutover was [Boot 3.0](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.0-Migration-Guide#jakarta-ee), not the 3.5 example baseline. Do not mix namespace generations.

Use the same startup and single-close verification below for either namespace.

## Exceptions

A single optional display string can fit `@Value`; don't turn every property into its own type. For an intentionally optional integration, select the disabled bean path first and require credentials only when enabled. Use a test stub rather than weakening production URL constraints.

## Verification

1. In `ApplicationContextRunner` with the billing configuration, supply valid, missing, zero-timeout, malformed-duration, and non-HTTPS values.
2. Pass if invalid cases fail startup and valid values create one client with the expected typed settings; closing the context releases it once.
3. Boot the real artifact with a safe deployment-like profile and a controlled external override. Pass if the intended source wins and neither startup diagnostics nor HTTP error responses expose secret values.

Reference: [Spring Boot 3.5 externalized configuration](https://docs.spring.io/spring-boot/3.5/reference/features/external-config.html).
