# Spring Boot rulebook

Use the build's managed Spring Boot and Spring Framework versions as the source of truth. Java examples assume Boot 3.5, Spring MVC, Jakarta Validation, and JUnit Jupiter where relevant. Don't add starters just to copy a snippet; check the corresponding imports and test modules when working on another release train.

| Task | Read |
| --- | --- |
| Change a controller, DTO, authorization, or error contract | [MVC request boundaries](mvc-request-boundaries.md) |
| Change a multi-write use case, JPA read, or rollback rule | [Transactions and persistence](transactions-and-persistence.md) |
| Add environment settings, an external client, or conditional beans | [Configuration and wiring](configuration-and-wiring.md) |
| Select a Spring slice, full context, or real HTTP/database harness | [Testing](testing.md) |

For a write endpoint, read MVC and testing together. Add the persistence leaf when success depends on an actual database commit.
