# Resolve resources relative to their owner

## When to read

Read when a Node ES module loads a resource distributed in the same package, or when a CLI stops working outside the package directory.

## Decision

Resolve package-owned files against `import.meta.url`, not `process.cwd()`. A relative filesystem path depends on where the caller launched the process and can silently load a different file with the same name.

## Bad

```js
import { readFile } from "node:fs/promises";

export function readBanner() {
  return readFile("./banner.txt", "utf8");
}
```

## Good

```js
import { readFile } from "node:fs/promises";

const banner = new URL("./banner.txt", import.meta.url);

export function readBanner() {
  return readFile(banner, "utf8");
}
```

## Assumptions and trade-offs

This is an ES module running from a filesystem on Node; the build or package must ship `banner.txt` beside the emitted module. The URL can be passed directly to `readFile`, without manually converting URL escapes or drive letters. A user-supplied CLI path should still resolve against the caller's directory if the CLI promises that behavior. Browser packaging is a separate contract.

## Verification

Run a consumer of the built module from a different working directory containing a different `banner.txt`. **Pass:** the consumer reads the shipped banner, and removing the shipped file causes a rejection rather than reading the caller's file.
