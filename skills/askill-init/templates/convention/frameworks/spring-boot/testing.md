# Spring Boot testing

**Invariant:** The test harness exercises the claimed boundary; a rollback check observes durable state outside the application transaction.

**Scope:** Portable harness choice, version-sensitive slice imports and bean overrides. Examples use Boot 3.5, Spring MVC/JPA and JUnit Jupiter.

## Context

Use this when choosing a harness for controller contracts, repositories, transactional services, or deployed HTTP behavior. A test should exercise the boundary it claims without adding unrelated application setup.

## Rules

- Use plain JUnit for pure policy. Use `@WebMvcTest` with MockMvc for MVC binding, serialization, advice, and the relevant security filters; import explicit web/security configuration if the slice does not discover it. Mock use-case beans with the mechanism supported by the installed version.
- Use `@DataJpaTest` for mappings and queries. Flush and clear before reloading if the claim is database behavior, not persistence-context behavior. For vendor SQL, constraints or migrations, use the production engine and check that replacement with an embedded test database is disabled.
- Use `@SpringBootTest` where real wiring or transactional advice is the claim. Invoke the injected bean and read committed state outside the failed transaction; test-managed rollback can hide missing application advice.
- For `RANDOM_PORT`, isolate or explicitly clean up server writes. The client test transaction does not roll back the server-thread transaction. Use a live port only when networking or actual server wiring is required.

## Wrong: verifying rollback on a manually constructed service

```java
@Test
void checkoutRollsBack() {
    var checkout = new Checkout(mock(Orders.class), failingReservations);
    assertThrows(StockUnavailable.class, () -> checkout.place(cart));
}
```

The test sees an exception but has neither a proxy nor durable data. It can pass with the `@Transactional` annotation removed.

## Right: prove a transaction across two real writes

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class CheckoutRollbackTest {
    @Autowired Checkout checkout;
    @Autowired JdbcTemplate jdbc;

    @Test
    void placeCart_outOfStock_leavesNoCommittedOrder() {
        // Seed through committed fixture writes on the integration database.
        var cart = committedOutOfStockCart();

        assertThrows(StockUnavailable.class, () -> checkout.place(cart));

        assertThat(jdbc.queryForObject(
            "select count(*) from orders where cart_id = ?", Long.class, cart.id()
        )).isZero();
    }
}
```

The test has no `@Transactional`; configure an isolated database and clean committed fixtures explicitly. Make the fixture exercise a write before failure, and add a companion success case to catch setups where neither call can persist. This harness is slower than a slice but tests the application-managed transaction.

## Version choice: slice wiring

For an MVC slice, annotate the class with `@WebMvcTest(ProfileController.class)`, inject `MockMvc`, and override the `CreateProfiles` collaborator with the field annotation below. Keep the real MVC validators, advice and relevant security filters.

| Boot | Slice imports and collaborator field |
| --- | --- |
| `2.7` or `>=3.0, <3.4` | `org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest` / `org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest`; `@MockBean CreateProfiles createProfiles` (`org.springframework.boot.test.mock.mockito.MockBean`). |
| `>=3.4, <4.0` | Same slice imports; `@MockitoBean CreateProfiles createProfiles` (`org.springframework.test.context.bean.override.mockito.MockitoBean`). |
| `>=4.0` | `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest` / `org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest`; the same `@MockitoBean` field and the corresponding `spring-boot-starter-webmvc-test` or `spring-boot-starter-data-jpa-test` dependency for the selected slice. |

[`@MockBean` was deprecated in Boot 3.4](https://docs.spring.io/spring-boot/3.4/api/java/org/springframework/boot/test/mock/mockito/MockBean.html) in favor of the [Spring Framework 6.2 override](https://docs.spring.io/spring-framework/reference/6.2/testing/annotations/integration-spring/annotation-mockitobean.html). Boot 4 [removed Boot's Mockito support and split test modules](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide#upgrading-testing-features). On every branch, send a blank-name request with valid auth and CSRF where required; expect `400` and no calls to the mock, then show valid input reaches it once.

## Exceptions

An embedded database can cover portable query smoke tests; don't use it to prove vendor locking or SQL. MockMvc can cover the full application without a socket via `@SpringBootTest` plus `@AutoConfigureMockMvc` when a slice cannot establish bean wiring but network behavior is irrelevant.

## Verification

1. Run the regression class and the containing module with the repository's Maven or Gradle wrapper. Run commit-dependent cases against the production engine (for example, a Testcontainers-backed database).
2. In a local reproduction, remove the service-entry transaction and rerun the rollback case. Pass if it detects a partial write and succeeds again when the boundary is restored.
3. Run with neighboring test classes and check fixture cleanup. Pass if results don't depend on test order, embedded replacement didn't mask the real database, and the companion success case commits both writes.

Reference: [Spring Boot 3.5 test slices and web environments](https://docs.spring.io/spring-boot/3.5/reference/testing/spring-boot-applications.html) and [Testcontainers integration](https://docs.spring.io/spring-boot/3.5/reference/testing/testcontainers.html).
