# Testing Kotlin

- Test null and sealed-result branches at the public boundary.
- For suspend code use the configured coroutine test dispatcher and advance virtual time instead of sleeping.
