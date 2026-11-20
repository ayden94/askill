import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openStore } from '../src/store.mjs';

function project(t) {
  const root = mkdtempSync(join(tmpdir(), 'askill-store-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('create: existing plan -> preserves immutable original', (t) => {
  const store = openStore(project(t));
  store.create('lanes/example.json', { approved: false });

  assert.throws(() => store.create('lanes/example.json', { approved: true }), { code: 'EEXIST' });

  assert.deepEqual(store.read('lanes/example.json'), { approved: false });
});

test('write: linked state directory -> refuses writes outside the project state', (t) => {
  const root = project(t);
  const store = openStore(root);
  mkdirSync(join(root, '.askill'));
  mkdirSync(join(root, 'outside'));
  writeFileSync(join(root, 'outside', 'active.json'), '{"approved":false}\n');
  symlinkSync(join(root, 'outside'), join(root, '.askill', 'lanes'));

  assert.throws(() => store.write('lanes/active.json', { approved: true }), /real directory/u);

  assert.equal(readFileSync(join(root, 'outside', 'active.json'), 'utf8'), '{"approved":false}\n');
});

test('transaction: concurrent writers -> second coordinator cannot write', async (t) => {
  const root = project(t);
  const first = openStore(root);
  const second = openStore(root);
  const { promise, resolve } = Promise.withResolvers();
  const held = first.transaction(() => promise);

  try {
    await assert.rejects(second.transaction(() => second.write('config.json', { overwrite: true })), /lock is held/u);
  } finally {
    resolve();
    await held;
  }

  assert.equal(second.read('config.json'), null);
});
