# Server and client boundaries

**Assumptions:** This App Router page renders authenticated preferences. `readOwnPreferences` gets the session server-side, limits the lookup to its owner, and can return fields that must not cross into browser-visible data.

Use a Server Component for the lookup and keep the smallest interactive subtree under `'use client'`. A client entry's imports are part of the client module graph; marking a server model as a TypeScript type does not redact object properties. Pass a minimal, serializable view model. Put `import 'server-only'` in server data modules as a build-time guard against client imports, not as a substitute for projection or authorization.

## Bad

```tsx
const prefs = await readOwnPreferences();
return <PreferencesEditor initial={prefs} />;
```

## Good

```tsx
// app/preferences/page.tsx (Server Component)
export default async function PreferencesPage() {
  const prefs = await readOwnPreferences();
  return <PreferencesEditor initial={{ theme: prefs.theme, locale: prefs.locale }} />;
}

// app/preferences/preferences-editor.tsx (separate file)
'use client';
export function PreferencesEditor({ initial }: { initial: PreferencesView }) {
  const [theme, setTheme] = useState(initial.theme);
  return <ThemeControl theme={theme} onChange={setTheme} locale={initial.locale} />;
}
```

Here `PreferencesView` is the browser-safe contract. Putting the read on the server protects its dependencies, but only explicit projection protects the serialized data. Handle missing sessions as the route contract requires; let unexpected lookup failures reach the route's error boundary rather than rendering another user's defaults.

**Exception:** A client wrapper can host a server-rendered child supplied as a prop, rather than importing that child's server module. Broaden the client subtree only when a shared interaction genuinely requires it; never move privileged reads with it.

## Verification

1. Build with the project's production configuration and review the client import graph, including shared barrel files.
2. Seed a synthetic private-field marker; confirm it never appears in HTML, browser network/payload responses, or props sent to the editor.
3. Exercise a missing session and a failed lookup, then verify the intended redirect or error UI without private data.
