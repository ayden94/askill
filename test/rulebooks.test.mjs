import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { seedConventions, validateProfile } from '../skills/askill-init/scripts/conventions.mjs';
import { openStore } from '../skills/askill-init/scripts/store.mjs';

const templates = fileURLToPath(new URL('../skills/askill-init/templates/convention/', import.meta.url));

for (const category of ['languages', 'frameworks']) {
  for (const book of readdirSync(join(templates, category), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    test(`init: ${book.name} -> every shipped topic is reachable through the installed index`, (t) => {
      const root = mkdtempSync(join(tmpdir(), 'askill-rulebook-'));
      t.after(() => rmSync(root, { recursive: true, force: true }));
      const profile = { frameworks: [], languages: [], [category]: [book.name] };
      validateProfile(profile);
      seedConventions(openStore(root), profile);

      const conventions = join(root, '.askill/convention');
      const selected = join(conventions, category, book.name);
      const reached = new Set();
      const visit = (file) => {
        if (reached.has(file)) { return; }
        reached.add(file);
        const content = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/gu, '');
        for (const [, target] of content.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/gu)) {
          if (/^(?:[a-z]+:|#)/iu.test(target)) { continue; }
          const next = resolve(dirname(file), target.split('#')[0]);
          assert.ok(next.startsWith(conventions + sep), `Link escapes the installed conventions: ${target}`);
          visit(next);
        }
      };
      visit(join(conventions, 'README.md'));

      assert.deepEqual(readdirSync(dirname(selected)), [book.name]);
      const topics = readdirSync(join(templates, category, book.name), { recursive: true })
        .filter((p) => p.endsWith('.md') && p !== 'README.md');
      assert.ok(topics.length > 1, 'A selectable rulebook needs multiple topics');
      for (const topic of topics) {
        assert.ok(reached.has(join(selected, topic)), `Unreachable installed topic: ${topic}`);
      }
    });
  }
}
