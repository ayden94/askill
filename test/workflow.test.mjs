import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { git } from '../src/store.mjs';

const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'askill-workflow-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.name', 'Askills test']);
  git(root, ['config', 'user.email', 'askill-test@example.invalid']);
  writeFileSync(join(root, 'calculator.mjs'), 'export const total = () => 0;\n');
  git(root, ['add', '--', 'calculator.mjs']);
  git(root, ['commit', '-m', 'Fixture base']);
  const invoke = (command, input, cwd = root) => (
    spawnSync(process.execPath, [cli, command, '--input', '-'], {
      cwd, input: JSON.stringify(input), encoding: 'utf8', timeout: 10_000,
    })
  );
  const call = (command, input, cwd = root) => {
    const result = invoke(command, input, cwd);
    assert.equal(result.status, 0, `${command}: ${result.stderr || result.error}`);
    return JSON.parse(result.stdout);
  };
  call('init', {
    version: 1,
    base_branch: 'main',
    destinations: { issues: { provider: 'local' }, pull_requests: null, tickets: null },
  });
  return { root, call, invoke };
}

function registerCalculation(call) {
  call('scope', {
    intake_id: 'calculate',
    problem: 'The calculator ignores the input',
    drafts: [{ draft_id: 'calculate', title: 'Return the input sum', body: 'Preserve zero for empty input.' }],
  });
  return call('issues', { artifact_id: 'calculate', intake_id: 'calculate' });
}

test('local intake: retry after issue registration -> resumes with the same canonical issue set', (t) => {
  const { root, call } = fixture(t);
  const first = registerCalculation(call);
  const input = { artifact_id: 'calculate', intake_id: 'calculate' };

  const resumed = call('issues', input);

  assert.equal(first.issues.length, 1);
  assert.match(first.issues[0].id, /^LOCAL-/u);
  assert.deepEqual(resumed, first);
  assert.equal(git(root, ['check-ignore', '.askill/issues/calculate.json']), '.askill/issues/calculate.json');
});

function binding(plan) {
  const { lane_id, issue, base_sha, head_sha, contract_sha256 } = plan;
  return { lane_id, issue, base_sha, head_sha, contract_sha256 };
}

test('local lane: fix-back and restart -> only three current-head verdicts complete the lane', (t) => {
  const { root, call, invoke } = fixture(t);
  const { issues: [{ id: issue }] } = registerCalculation(call);
  const lane_id = 'calculate';
  const target = { lane_id, issue };
  const axes = ['contract', 'code', 'verification'];
  call('create-lane', { lane_id, artifact_id: 'calculate', authority_scope: { local_commit: true } });
  call('import-lane', { lane_id });
  const before = call('plan', target);
  assert.equal(before.action, 'preflight');
  const contract = {
    version: 1, ...target, base_sha: before.base_sha, issue_sha256: before.issue_sha256,
    goal: 'Return the sum of the inputs',
    scope: ['Calculator implementation'], unchanged: ['Empty input returns zero'],
    non_goals: ['Input coercion'], predicted_files: ['calculator.mjs'],
    criteria: [{ id: 'sum-input', method: 'Run calculator with numeric input', expected: '[2, 3] sums to 5' }],
    required_review_axes: axes,
  };
  const implementation = call('record', { ...target, kind: 'preflight', contract });
  assert.equal(implementation.action, 'implement');
  const { worktree, dispatch: { setup } } = implementation;
  const [executable, ...argv] = setup.argv;
  assert.equal(executable, 'git');
  git(setup.cwd, argv);

  const recordImplementation = (source, message) => {
    writeFileSync(join(worktree, 'calculator.mjs'), source);
    git(worktree, ['add', '--', 'calculator.mjs']);
    git(worktree, ['commit', '-m', message]);
    const current = call('plan', target, worktree);
    assert.equal(current.action, 'record-implementation');
    const expression = "import { total } from './calculator.mjs'; if (total([2,3]) !== 5) process.exit(1);";
    const check = spawnSync(process.execPath, ['--input-type=module', '-e', expression], { cwd: worktree });
    assert.equal(check.status, 0);
    return call('record', {
      ...binding(current), kind: 'implementation', implementer: 'builder',
      checks: [{ criterion: 'sum-input', command: 'node --input-type=module -e <sum-check>',
        exit_code: check.status, observation: '[2, 3] returned 5' }],
    });
  };

  const bad = recordImplementation('export const total = (inputs) => inputs.length === 0 ? 1 : 5;\n', 'Partial calculator fix');
  const reviewer = (at, axis, verdict = 'pass', evidence = 'Checked exact-head evidence') => (
    { ...binding(at), kind: 'review', axis, reviewer: `${axis}-reviewer`, verdict, evidence }
  );
  assert.equal(call('record', reviewer(bad, 'contract', 'block', 'Empty input returns 1')).action, 'fix-back');
  const good = recordImplementation('export const total = (inputs) => inputs.reduce((a, b) => a + b, 0);\n', 'Preserve empty input');
  call('import-lane', { lane_id });
  const ocr = call('run-ocr', binding(good));
  assert.ok(['skipped-uninstalled', 'skipped-not-authorized'].includes(ocr.status), ocr.status);
  assert.deepEqual(binding(ocr), binding(good));

  const stale = invoke('record', reviewer(bad, 'code'));
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /stale binding/u);
  const duplicate = invoke('record', { ...reviewer(good, 'code'), reviewer: 'builder' });
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /independent reviewer/u);
  for (const axis of axes.slice(0, -1)) {
    assert.equal(call('record', reviewer(good, axis)).action, 'review');
  }
  const completed = call('record', reviewer(good, 'verification'));

  assert.equal(completed.action, 'done');
  assert.equal(completed.reason, 'verified-local-head');
  assert.equal(completed.head_sha, git(worktree, ['rev-parse', 'HEAD']));
  assert.equal(call('plan', target).action, 'done');
  assert.equal(git(root, ['remote']), '');
});
