import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { engine } from '../src/engine.mjs';
import { git, openStore } from '../src/store.mjs';

const axes = ['contract', 'code', 'verification'];
const identity = { lane_id: 'jobs', issue: 'X' };
const bind = ({ lane_id, issue, base_sha, head_sha, contract_sha256 }) => ({ lane_id, issue, base_sha, head_sha, contract_sha256 });

async function fixture(t, options = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'askill-engine-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.name', 'fixture']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']);
  git(root, ['commit', '--allow-empty', '-m', 'base']);
  const store = openStore(root);
  const config = { version: 1, base_branch: 'main', destinations: {
    issues: { provider: 'local' }, pull_requests: options.pr ? { provider: 'github', repository: 'fixture/test' } : null,
    tickets: null } };
  store.create('config.json', config);
  const issues = ['X', 'Y'].map((id) => ({ id, title: `Issue ${id}`, url: null }));
  for (const issue of issues) { store.create(`issues/local/${issue.id}.json`, { ...issue, body: 'fix it' }); }
  const artifact = { version: 1, artifact_id: 'batch', config_sha256: store.digest(config), issues };
  store.create('issues/batch.json', artifact);
  store.create('lanes/jobs.json', { version: 2, lane_id: 'jobs', config_sha256: store.digest(config),
    source: { artifact_id: 'batch', sha256: store.digest(artifact) }, base_branch: 'main',
    confirmed_issues: ['X', 'Y'], dependency_graph: { X: [], Y: ['X'] },
    dependency_reasons: [{ issue: 'Y', depends_on: 'X', reason: 'requires X' }],
    retry_policy: { attempt_ceiling: 2 }, authority_scope: { local_commit: true,
      push: false, pr_create: false, pr_merge: false, cleanup_command_worktrees: false, ...options.grants } });
  const forge = { observePR: async () => null, ...options.forge };
  const call = (command, input = identity) => engine(command, { root, store: openStore(root), forge }, input);
  await call('import-lane');
  return { root, store, call, forge };
}

async function acceptContract(call) {
  const p = await call('plan');
  return call('record', { ...identity, kind: 'preflight', contract: {
    version: 1, ...identity, base_sha: p.base_sha, issue_sha256: p.issue_sha256, goal: 'fix issue',
    scope: ['answer'], unchanged: [], non_goals: [], criteria: [{ id: 'ok', method: 'read answer', expected: 'one' }],
    required_review_axes: axes } });
}

async function commit(worktree, content) {
  await writeFile(path.join(worktree, 'answer'), content);
  git(worktree, ['add', '--', 'answer']);
  git(worktree, ['commit', '-m', `fixture ${content}`]);
}

async function implementation(call, row) {
  return call('record', { ...bind(row), kind: 'implementation', implementer: 'worker',
    checks: [{ criterion: 'ok', command: 'read answer', exit_code: 0, observation: 'one' }] });
}

async function reviewHead(t, options) {
  const context = await fixture(t, options);
  const p = await acceptContract(context.call);
  git(p.dispatch.setup.cwd, p.dispatch.setup.argv.slice(1));
  await commit(p.worktree, 'one');
  const plan = await implementation(context.call, await context.call('plan'));
  return { ...context, plan };
}

const verdict = (row, axis, value = 'pass', reviewer = `${axis}-agent`) => ({
  ...bind(row), kind: 'review', reviewer, axis, verdict: value, evidence: 'fixture inspection: answer:1',
});

test('record: a confirmed defect then a new head -> invalidate old verdicts and resume independently', async (t) => {
  const { root, call, plan } = await reviewHead(t);
  assert.equal(plan.assignments.length, 3);
  assert.equal((await call('plan-all'))[1].action, 'wait-dependencies');
  await assert.rejects(call('record', verdict(plan, 'contract', 'pass', 'Worker')), /distinct/);
  await call('record', verdict(plan, 'contract'));
  await assert.rejects(call('record', verdict(plan, 'code', 'pass', 'contract-agent')), /independent/);
  const incomplete = await call('record', verdict(plan, 'code', 'needs-evidence'));
  assert.equal(incomplete.reason, 'needs-evidence');
  const fix = await call('record', verdict(plan, 'code', 'block'));
  assert.equal(fix.action, 'fix-back');
  await assert.rejects(call('record', verdict(plan, 'code')), /fix-back/);
  await commit(plan.worktree, 'two');
  const next = await implementation(call, await call('plan'));
  assert.equal(next.assignments.length, 3);
  await assert.rejects(call('record', verdict(plan, 'code')), /stale/);
  for (const axis of axes) { await call('record', verdict(next, axis)); }
  const waiting = await call('plan-all');
  assert.equal(waiting[1].details[0].reason, 'prerequisite-not-in-base');
  // The temporary fixture's base now incorporates the reviewed upstream outcome.
  git(root, ['merge', '--ff-only', next.head_sha]);

  await call('import-lane');
  const rows = await call('plan-all');

  assert.deepEqual(rows.map((v) => v.action), ['done', 'preflight']);
  assert.equal(rows[0].reason, 'verified-local-head');
  assert.equal(rows[1].base_sha, next.head_sha);
});

test('plan: unrelated base branch advance -> keep the accepted comparison base and verified head', async (t) => {
  const { root, call, plan } = await reviewHead(t);
  for (const axis of axes) { await call('record', verdict(plan, axis)); }
  git(root, ['commit', '--allow-empty', '-m', 'unrelated advance']);

  const result = await call('plan');

  assert.equal(result.base_sha, plan.base_sha);
  assert.notEqual(result.base_tip, plan.base_sha);
  assert.equal(result.action, 'done');
});

test('import: config or source changes -> refuse rather than resetting the execution ledger', async (t) => {
  const { store, call } = await fixture(t);
  const state = store.read('lanes-v4/jobs.json');
  const source = store.read('issues/batch.json');
  store.write('issues/batch.json', { ...source, issues: source.issues.toReversed() });

  await assert.rejects(call('import-lane'), /provenance/);

  assert.deepEqual(store.read('lanes-v4/jobs.json'), state);
});

test('record: repeated phase failures -> persist bounded blocker until explicitly resumed', async (t) => {
  const { call } = await fixture(t);
  const plan = await call('plan');
  const failure = { ...bind(plan), kind: 'failure', phase: 'preflight', reason: 'host unavailable' };
  await call('record', failure);
  assert.equal((await call('record', failure)).reason, 'attempts-exhausted');
  await call('import-lane');

  const resumed = await call('record', { ...bind(plan), kind: 'resume', phase: 'preflight', reason: 'host recovered' });

  assert.equal(resumed.action, 'preflight');
});

test('plan: appointed branch checked out elsewhere -> refuse evidence from substitute worktree', async (t) => {
  const { root, call } = await fixture(t);
  const plan = await acceptContract(call);
  git(root, ['worktree', 'add', '-b', plan.branch, path.join(root, 'wrong'), plan.base_sha]);

  const result = await call('plan');

  assert.equal(result.action, 'observation-failed');
  assert.match(result.reason, /identity/);
});

test('publish-pr: passing reviews without remote grants -> never call the write adapter', async (t) => {
  const { call, plan } = await reviewHead(t, { pr: true,
    forge: { publishPR: () => assert.fail('remote writes are forbidden') } });
  for (const axis of axes) { await call('record', verdict(plan, axis)); }

  const closed = await call('plan');

  assert.equal(closed.reason, 'publication-not-authorized');
  await assert.rejects(call('publish-pr', bind(plan)), /publication-not-authorized/);
});

test('publish-pr: create-only authority -> adapter must confirm an existing remote head without pushing', async (t) => {
  const { call, plan, forge } = await reviewHead(t, { pr: true, grants: { pr_create: true } });
  for (const axis of axes) { await call('record', verdict(plan, axis)); }
  let options;
  forge.publishPR = async (_destination, request) => {
    options = request;
    const pr = { id: '1', url: 'https://example.invalid/pr/1', branch: request.branch, base: request.base,
      state: 'open', ci: 'pending', head: request.head };
    forge.observePR = async () => pr;
    return pr;
  };

  const result = await call('publish-pr', bind(plan));

  assert.equal(options.allowPush, false);
  assert.equal(options.allowCreate, true);
  assert.equal(result.action, 'wait-ci');
});

test('run-ocr: no project opt-in -> records a bound skip without supplying external authority', async (t) => {
  const { call, plan, forge } = await reviewHead(t);
  forge.runOCR = async ({ base, head, authorized, background }) => {
    assert.equal(authorized, false);
    assert.equal(background, true);
    return { base, head, status: 'skipped-not-authorized' };
  };

  await call('run-ocr', { ...bind(plan), authorized: true, background: true });

  const after = await call('plan');
  assert.equal(after.ocr.status, 'skipped-not-authorized');
  assert.equal(after.assignments.length, 3);
  await assert.rejects(call('run-ocr', { ...bind(plan), background: 'true' }), /boolean/);
});

test('plan: fresh PR lifecycle and CI -> preserve failure, waiting, approval and terminal order', async (t) => {
  const { call, plan, forge } = await reviewHead(t, { pr: true, grants: { push: true, pr_create: true } });
  const pr = { id: '7', url: 'https://example.invalid/pr/7', branch: plan.branch, base: 'main',
    head: plan.head_sha, state: 'OPEN', mergeable: 'UNKNOWN', ci: 'unknown' };
  for (const axis of axes) { await call('record', verdict(plan, axis)); }
  assert.equal((await call('plan')).action, 'create-pr');
  forge.observePR = async () => ({ ...pr });
  pr.head = plan.base_sha;
  assert.equal((await call('plan')).action, 'push');
  pr.head = plan.head_sha;
  pr.mergeable = 'CONFLICTING';
  assert.equal((await call('plan')).action, 'resolve-conflict');
  pr.mergeable = 'UNKNOWN';
  pr.ci = 'failed';
  assert.equal((await call('plan')).action, 'fix-back');
  pr.ci = 'pending';
  assert.equal((await call('plan')).action, 'wait-ci');
  pr.ci = 'pass';
  assert.equal((await call('plan')).action, 'wait-mergeability');
  pr.mergeable = 'MERGEABLE';
  assert.equal((await call('plan')).action, 'request-merge-approval');
  pr.state = 'CLOSED';
  assert.equal((await call('plan')).reason, 'pr-closed-externally');
  pr.state = 'MERGED';

  const merged = await call('plan');

  assert.equal(merged.reason, 'merged-pr');
});
