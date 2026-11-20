# Test type contracts and runtime contracts separately

## When to read

Read when a public signature, runtime parser, or typed fixture changes. Use the project's runtime runner and type-test setup; the command that emits or strips types is not necessarily a typecheck.

## Rules

- Add positive and negative type cases for the public contract. Run the checked files with the same meaningful flags and resolution settings CI uses. If the project's harness uses `@ts-expect-error`, place it on a narrow negative test line; never use it to make production code compile.
- Keep normal fixtures honest. Construct values against their actual public input type (`satisfies` can validate a fixture without replacing its inferred type). Feed invalid JSON-shaped data into the boundary as `unknown`, not through a cast that manufactures a valid domain value.
- Execute boundary values in the runtime runner. Check observed errors or outcomes, not whether the parser uses a particular helper; keep one expectation per test and name the function, scenario, and result.

## Error-prone

```ts
type Job = { attempts: number };
const malformed = { attempts: "several" } as unknown as Job;

function describe(job: Job): string {
  return `${job.attempts} attempts`;
}

if (!describe(malformed)) throw new Error("no description");
```

This test passes on an impossible internal fixture, never calls a parser, and accepts `"several attempts"` as success.

## Recommended

The snippets are separate files in the same example directory. The example has no runner dependency: compile the runtime file in isolation from the negative type test, then execute the compiled runtime file. In a real project, put the runtime case in the existing runner.

```ts
// job.ts
export type Job = { attempts: number };

export function parseJob(input: unknown): Job {
  if (typeof input === "object" && input !== null && "attempts" in input &&
      typeof input.attempts === "number" &&
      Number.isSafeInteger(input.attempts) && input.attempts >= 0) {
    return { attempts: input.attempts };
  }
  throw new TypeError("invalid attempts");
}

export function describe(job: Job): string {
  return `${job.attempts} attempts`;
}
```

```ts
// job.type-test.ts (typecheck only; do not execute)
import { describe, type Job } from "./job";

const fixture = { attempts: 0 } satisfies Job;
const label: string = describe(fixture);
void label;
// @ts-expect-error attempts must be numeric in the public Job contract
describe({ attempts: "several" });
```

```ts
// job.runtime-test.ts
import { parseJob } from "./job";

function parseJobRejectsStringAttempts(): void {
  const input: unknown = { attempts: "several" };

  try {
    parseJob(input);
  } catch (error) {
    if (error instanceof TypeError && error.message === "invalid attempts") return;
    throw error;
  }

  throw new Error("parseJob accepted string attempts");
}

parseJobRejectsStringAttempts();
```

## Why and trade-offs

The negative call guards the accepted domain type; the runtime case guards the conversion from unknown data. `@ts-expect-error` fails when its line compiles, but any unrelated diagnostic on that line can satisfy it. A small call with a verified import reduces that risk; use richer type assertions when the installed harness supports them.

## Edge cases and exceptions

Test valid boundary endpoints too (here zero succeeds). Add separate behavior cases for each result variant callers act on. For packages with emitted declarations or special export conditions, test the consumer import path, not only the source module; declaration output can expose different types from an internal import.

## Verification

Typecheck all three files with `tsc --strict --target es2022 --module commonjs --noEmit job.ts job.type-test.ts job.runtime-test.ts`. Separately compile only `job.runtime-test.ts` with the same target and module in a scratch CommonJS directory, without `--noEmit`, then run it. Widen the description parameter and, in a separate scratch variant, make the parser accept strings. **Pass:** both baseline checks pass; widening causes an unused directive diagnostic, and bypassing validation fails the runtime check.
