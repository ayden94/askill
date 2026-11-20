import { readFileSync, readdirSync } from 'node:fs';

export const conventionIndex = '.askill/convention/README.md';

const templates = new URL('../templates/convention/', import.meta.url);
const catalogs = { project_types: 'projects', languages: 'languages', frameworks: 'frameworks' };

function markdownFiles(folder) {
  return readdirSync(new URL(`${folder}/`, templates), { withFileTypes: true })
    .flatMap((entry) => {
      const path = `${folder}/${entry.name}`;
      if (entry.isDirectory()) { return markdownFiles(path); }
      return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
    }).sort();
}

export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)
    || Object.keys(profile).some((key) => !Object.hasOwn(catalogs, key))) {
    throw new TypeError('Invalid convention_profile');
  }
  for (const [key, folder] of Object.entries(catalogs)) {
    if (key === 'project_types' && !Object.hasOwn(profile, key)) { continue; }
    const choices = readdirSync(new URL(`${folder}/`, templates), { withFileTypes: true })
      .flatMap((entry) => key === 'project_types'
        ? (entry.isFile() && entry.name.endsWith('.md') ? [entry.name.slice(0, -3)] : [])
        : (entry.isDirectory() ? [entry.name] : []));
    const picked = profile[key];
    if (!Array.isArray(picked) || !picked.every((p) => choices.includes(p)) || new Set(picked).size !== picked.length) {
      throw new TypeError(`Select unique ${key} from: ${choices.join(', ')} (or [])`);
    }
  }
}

export function seedConventions(store, profile) {
  const paths = ['common.md', 'testing.md'];
  const indexes = [...paths];
  if (profile) {
    for (const [key, folder] of Object.entries(catalogs)) {
      for (const id of profile[key] ?? []) {
        if (key === 'project_types') {
          paths.push(`${folder}/${id}.md`);
          indexes.push(`${folder}/${id}.md`);
        } else {
          const directory = `${folder}/${id}`;
          const files = markdownFiles(directory);
          const index = `${directory}/README.md`;
          if (!files.includes(index)) { throw new TypeError(`Missing rulebook index: ${index}`); }
          paths.push(...files);
          indexes.push(index);
        }
      }
    }
  }
  for (const path of paths) {
    store.createTextIfMissing(`convention/${path}`, readFileSync(new URL(path, templates), 'utf8'));
  }
  const links = indexes.map((p) => {
    const label = p.endsWith('/README.md') ? p.slice(0, -'/README.md'.length) : p.slice(0, -3);
    return `- [${label}](${p})`;
  }).join('\n');
  store.createTextIfMissing('convention/rulebooks.md', `# Rulebook directory\n\nOpen the selected stack's index, then read only the topics that apply to the change.\n\n${links}\n`);
  store.createTextIfMissing('convention/README.md', '# Project conventions\n\nStart with the [rulebook directory](rulebooks.md). Add project-specific decisions here.\n');
}
