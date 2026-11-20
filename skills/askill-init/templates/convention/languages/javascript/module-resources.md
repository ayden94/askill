# Resolve resources relative to their owner

**Invariant:** A package module reads its own shipped file regardless of the caller's working directory.

**Compatibility — portable within filesystem-backed Node ESM on Node 16+:** [Node's `import.meta.url`](https://nodejs.org/api/esm.html#importmetaurl) and [`readFile` accepting a file URL](https://nodejs.org/api/fs.html#fspromisesreadfilepath-options) suffice throughout this scope; `import.meta.dirname` (Node 20.11/21.2+) buys nothing here. For a Node CommonJS build, use `readFile(join(__dirname, "banner.txt"), "utf8")` with `node:fs/promises` and `node:path`, resolving against the [CommonJS module's directory](https://nodejs.org/api/modules.html#__dirname). The switch is module format, not compiler age; run the same check on every emitted entry.

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
