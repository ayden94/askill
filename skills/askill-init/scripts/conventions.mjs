import { readFileSync, readdirSync } from 'node:fs';

export const conventionIndex = '.askill/convention/README.md';

const templates = new URL('../templates/convention/', import.meta.url);
const catalogs = { project_types: 'projects', languages: 'languages', frameworks: 'frameworks' };

export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)
    || Object.keys(profile).some((key) => !Object.hasOwn(catalogs, key))) {
    throw new TypeError('Invalid convention_profile');
  }
  for (const [key, folder] of Object.entries(catalogs)) {
    if (key === 'project_types' && !Object.hasOwn(profile, key)) { continue; }
    const choices = readdirSync(new URL(`${folder}/`, templates)).filter((p) => p.endsWith('.md')).map((p) => p.slice(0, -3));
    const picked = profile[key];
    if (!Array.isArray(picked) || !picked.every((p) => choices.includes(p)) || new Set(picked).size !== picked.length) {
      throw new TypeError(`Select unique ${key} from: ${choices.join(', ')} (or [])`);
    }
  }
}

export function seedConventions(store, profile) {
  const paths = ['common.md', 'testing.md'];
  if (profile) {
    for (const [key, folder] of Object.entries(catalogs)) {
      for (const id of profile[key] ?? []) {
        paths.push(`${folder}/${id}.md`);
        if (key === 'languages') { paths.push(`testing/${id}.md`); }
      }
    }
  }
  for (const path of paths) {
    store.createTextIfMissing(`convention/${path}`, readFileSync(new URL(path, templates), 'utf8'));
  }
  const links = paths.map((p) => `- [${p.slice(0, -3)}](${p})`).join('\n');
  store.createTextIfMissing('convention/README.md', `# Project conventions\n\nRead common guidance first, then the guides relevant to this change. Edit these rules and links to fit the project.\n\n${links}\n`);
}
