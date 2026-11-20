# Require a policy for ambiguous local times

**Invariant:** A naive wall time in a named zone becomes a UTC instant only if exactly one instant round-trips to it.

**Compatibility:** Standard-library API floor, not a split: Python 3.9+ with IANA time-zone data. `zoneinfo` entered the standard library in [Python 3.9](https://docs.python.org/3.9/whatsnew/3.9.html#zoneinfo); earlier runtimes are outside this recipe.

## When to read

Read when converting a user-entered local wall time in a named time zone into a unique timestamp.

## Decision

Check both `fold` interpretations by round-tripping through UTC, rejecting gaps and asking the caller to disambiguate overlaps. Attaching a `ZoneInfo` with `replace` alone accepts even a wall time that never occurred.

## Bad

```python
from datetime import timezone
from zoneinfo import ZoneInfo

def appointment_utc(wall, zone):
    return wall.replace(tzinfo=ZoneInfo(zone)).astimezone(timezone.utc)
```

## Good

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

def appointment_utc(wall: datetime, zone: str) -> datetime:
    if wall.tzinfo is not None:
        raise ValueError("expected a naive wall time")
    local = ZoneInfo(zone)
    candidates = set()
    for fold in (0, 1):
        instant = wall.replace(tzinfo=local, fold=fold).astimezone(timezone.utc)
        if instant.astimezone(local).replace(tzinfo=None) == wall:
            candidates.add(instant)
    if not candidates:
        raise ValueError("local time does not exist")
    if len(candidates) > 1:
        raise ValueError("local time is ambiguous; supply an explicit offset")
    return candidates.pop()
```

## Assumptions and trade-offs

The runtime supplies IANA time-zone data for `zoneinfo`. The API accepts naive wall time only; explicit-offset input uses a separate path. This policy rejects overlap instead of guessing which occurrence to schedule. Compare UTC instants to distinguish the two folds and persist the original local time and zone as well if future rule changes must affect scheduled occurrences.

## Verification

Use `America/New_York` with `2024-03-10 02:30`, `2024-11-03 01:30`, and `2024-11-03 03:30`. **Pass:** the first is rejected as nonexistent, the second as ambiguous, and the third maps to `2024-11-03 08:30 UTC`.
