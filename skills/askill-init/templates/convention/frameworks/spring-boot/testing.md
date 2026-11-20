# Spring Boot testing

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

## Exceptions

An embedded database can cover portable query smoke tests; don't use it to prove vendor locking or SQL. MockMvc can cover the full application without a socket via `@SpringBootTest` plus `@AutoConfigureMockMvc` when a slice cannot establish bean wiring but network behavior is irrelevant.

## Verification

1. Run the regression class and the containing module with the repository's Maven or Gradle wrapper. Run commit-dependent cases against the production engine (for example, a Testcontainers-backed database).
2. In a local reproduction, remove the service-entry transaction and rerun the rollback case. Pass if it detects a partial write and succeeds again when the boundary is restored.
3. Run with neighboring test classes and check fixture cleanup. Pass if results don't depend on test order, embedded replacement didn't mask the real database, and the companion success case commits both writes.

Reference: [Spring Boot 3.5 test slices and web environments](https://docs.spring.io/spring-boot/3.5/reference/testing/spring-boot-applications.html) and [Testcontainers integration](https://docs.spring.io/spring-boot/3.5/reference/testing/testcontainers.html).
