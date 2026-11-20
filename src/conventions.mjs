import { readFileSync } from 'node:fs';

export const conventionIndex = '.askill/convention/README.md';

export function seedConventions(store) {
  for (const name of ['README.md', 'common.md', 'frontend.md', 'backend.md', 'testing.md']) {
    const template = readFileSync(new URL(`../templates/convention/${name}`, import.meta.url), 'utf8');
    store.createTextIfMissing(`convention/${name}`, template);
  }
}
