import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { intake } from '../skills/askill-init/scripts/intake.mjs';
import { openStore } from '../skills/askill-init/scripts/store.mjs';

function localConfig(issues = { provider: 'local' }) {
  return { version: 1, base_branch: 'main', destinations: { issues, pull_requests: null, tickets: null } };
}

function harness(t, forge = {}) {
  const root = mkdtempSync(join(tmpdir(), 'askill-intake-'));
  t.after(() => rmSync(root, { recursive: true }));
  const store = openStore(root);
  const call = (command, args) => store.transaction(() => intake(command, { root, store, forge }, args));
  return { call, store };
}

const scopeArgs = {
  intake_id: 'save',
  problem: 'Prevent duplicate saves and document the result',
  drafts: [{ title: 'Prevent duplicate saves' }, { title: 'Document the save behavior' }],
};

test('init: saves each ticket choice independently and reuses it on resume', async (t) => {
  for (const tickets of [null, ...['jira', 'linear', 'notion'].map((provider) => ({ provider }))]) {
    const { call, store } = harness(t);
    const config = localConfig();
    config.destinations.tickets = tickets;
    await call('init', config);
    assert.deepEqual(store.read('config.json').destinations.tickets, tickets);
    assert.deepEqual((await call('init', {})).destinations.tickets, tickets);
    await call('scope', scopeArgs);
  }
});

test('init: rejects unknown ticket providers and credential fields before saving', async (t) => {
  const { call, store } = harness(t);
  for (const tickets of [{ provider: 'other' }, { provider: 'jira', token: 'example' }]) {
    const config = localConfig();
    config.destinations.tickets = tickets;
    await assert.rejects(call('init', config), /tickets/);
    assert.equal(store.read('config.json'), null);
  }
});

test('init: incompatible replacement and nonboolean OCR opt-in -> original configuration remains untouched', async (t) => {
  const { call, store } = harness(t);
  const config = localConfig();

  await call('init', { config });
  await assert.rejects(call('init', { ...config, policy: { ocr_external: 'true' } }), /must be boolean/);
  await assert.rejects(call('init', { ...config, policy: { ocr_external: true } }), /already exists and differs/);

  assert.deepEqual(store.read('config.json'), config);
});

test('intake: local drafts and a semantic edge -> stable issues and immutable source-bound plan', async (t) => {
  const { call, store } = harness(t);
  const config = await call('init', localConfig());
  await call('scope', scopeArgs);
  const issueArgs = { artifact_id: 'save', intake_id: 'save' };
  const artifact = await call('issues', issueArgs);
  const [fix, docs] = artifact.issues.map((issue) => issue.id);
  const laneArgs = {
    lane_id: 'save',
    artifact_id: 'save',
    dependency_graph: { [docs]: [fix] },
    dependency_reasons: [{ issue: docs, depends_on: fix, reason: 'The docs describe the behavior introduced by the fix.' }],
    authority_scope: { local_commit: true },
  };

  const plan = await call('create-lane', laneArgs);

  assert.deepEqual(await call('issues', { ...issueArgs, artifact_id: 'save-copy' }).then((record) => record.issues), artifact.issues);
  assert.deepEqual(plan.source, { artifact_id: 'save', sha256: store.digest(artifact) });
  assert.equal(plan.config_sha256, store.digest(config));
  assert.deepEqual(plan.confirmed_issues, [fix, docs]);
  assert.deepEqual(plan.dependency_graph, { [fix]: [], [docs]: [fix] });
  assert.equal(plan.authority_scope.push, false);
  assert.deepEqual(await call('create-lane', laneArgs), plan);
  await assert.rejects(call('create-lane', { ...laneArgs, authority_scope: {} }), /already exists and differs/);
  assert.deepEqual(store.read('lanes/save/plan.json'), plan);
});

test('create-lane: invalid dependencies -> rejects without publishing a plan', async (t) => {
  const { call, store } = harness(t);
  await call('init', localConfig());
  await call('scope', scopeArgs);
  const artifact = await call('issues', { artifact_id: 'save', intake_id: 'save' });
  const [fix, docs] = artifact.issues.map((issue) => issue.id);
  const baseArgs = { lane_id: 'save', artifact_id: 'save' };

  await assert.rejects(call('create-lane', { ...baseArgs, dependency_graph: { [fix]: [docs], [docs]: [fix] } }), /cycle/);
  await assert.rejects(call('create-lane', { ...baseArgs, dependency_graph: { [docs]: [fix] } }), /needs a reason/);
  await assert.rejects(call('create-lane', {
    ...baseArgs,
    dependency_reasons: [{ issue: docs, depends_on: fix, reason: 'Not a real edge' }],
  }), /cover one graph edge/);

  assert.equal(store.read('lanes/save/plan.json'), null);
});

test('create-lane: duplicate identifiers, unsafe IDs and destination drift -> fail closed', async (t) => {
  const { call, store } = harness(t);
  const config = await call('init', localConfig());
  await call('scope', scopeArgs);
  const artifact = await call('issues', { artifact_id: 'save', intake_id: 'save' });
  const [issue] = artifact.issues;
  store.write('config.json', { ...config, base_branch: 'changed' });

  await assert.rejects(call('create-lane', { lane_id: '../save', artifact_id: 'save' }), /safe string ID/);
  await assert.rejects(call('create-lane', { lane_id: 'save', issue_ids: [issue.id, issue.id] }), /duplicates/);
  await assert.rejects(call('create-lane', { lane_id: 'save', artifact_id: 'save' }), /configuration has drifted/);

  assert.equal(store.read('lanes/save/plan.json'), null);
});

test('issues: uncertain remote creation -> no replay across artifacts, existing issue can be linked', async (t) => {
  let writes = 0;
  const remoteIssue = { id: '42', title: 'Prevent duplicate saves', url: 'https://github.com/owner/repo/issues/42' };
  const { call, store } = harness(t, {
    registerIssue() {
      writes += 1;
      throw new Error('remote accepted the request before the response was lost');
    },
    observeIssue: (_destination, id) => id === remoteIssue.id ? remoteIssue : null,
  });
  await call('init', localConfig({ provider: 'github', repository: 'owner/repo' }));
  await call('scope', { ...scopeArgs, approval_scope: { issue_create: true } });
  const issueArgs = { artifact_id: 'save', intake_id: 'save' };

  await assert.rejects(call('issues', issueArgs), /explicit issue_create grant/);
  assert.equal(writes, 0);
  const approved = { ...issueArgs, authority_scope: { issue_create: true } };
  await assert.rejects(call('issues', approved), /outcome is uncertain/);
  await assert.rejects(call('issues', { ...approved, artifact_id: 'another' }), /outcome is uncertain/);
  assert.equal(store.read('issues/save.json'), null);
  const linked = await call('issues', { artifact_id: 'save', issue_ids: ['42'] });

  assert.equal(writes, 1);
  assert.deepEqual(linked.issues, [remoteIssue]);
});

test('create-lane: explicit remote IDs -> observes in input order and records canonical artifact without remote writes', async (t) => {
  const observations = [];
  const { call, store } = harness(t, {
    observeIssue: (destination, id) => {
      observations.push([destination.repository, id]);
      return { id, title: `Issue ${id}`, url: `https://github.com/owner/repo/issues/${id}` };
    },
  });
  await call('init', localConfig({ provider: 'github', repository: 'owner/repo' }));

  const plan = await call('create-lane', { lane_id: 'existing', issue_ids: ['18', '3'] });

  assert.deepEqual(observations, [['owner/repo', '18'], ['owner/repo', '3']]);
  assert.deepEqual(plan.confirmed_issues, ['18', '3']);
  assert.deepEqual(plan.source, { artifact_id: 'existing', sha256: store.digest(store.read('issues/existing.json')) });
});

test('issues: successful remote registration -> reuses the durable receipt under another artifact ID', async (t) => {
  let writes = 0;
  const issue = { id: '7', title: 'Prevent duplicate saves', url: 'https://gitlab.com/group/project/-/issues/7' };
  const { call } = harness(t, { registerIssue: () => { writes += 1; return issue; } });
  await call('init', localConfig({ provider: 'gitlab', repository: 'group/project' }));
  await call('scope', { ...scopeArgs, drafts: [{ title: issue.title }], approval_scope: { issue_create: true } });
  const args = { artifact_id: 'save', intake_id: 'save', authority_scope: { issue_create: true } };

  const original = await call('issues', args);
  const replay = await call('issues', { ...args, artifact_id: 'save-copy' });

  assert.equal(writes, 1);
  assert.deepEqual(original.issues, [issue]);
  assert.deepEqual(replay.issues, [issue]);
});
