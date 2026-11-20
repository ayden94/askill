import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';

import { observeIssue, observePR, publishPR, registerIssue, runOCR } from '../src/forge.mjs';

const head = 'a'.repeat(40);
const older = 'b'.repeat(40);
const github = { provider: 'github', repository: 'owner/repo' };
const gitlab = { provider: 'gitlab', repository: 'group/sub/project', host: 'forge.example.org' };
const binding = { branch: 'feature/one', base: 'main', head };
const githubIssue = {
  number: 4, title: 'First', body: 'notes', state: 'closed', html_url: 'https://github.com/owner/repo/issues/4',
};
const githubPR = {
  number: 7, state: 'open', html_url: 'https://github.com/owner/repo/pull/7',
  head: { sha: head, ref: binding.branch, repo: { full_name: github.repository } },
  base: { ref: binding.base, repo: { full_name: github.repository } },
};
const gitlabMR = {
  iid: 8, state: 'opened', web_url: 'https://forge.example.org/group/sub/project/-/merge_requests/8',
  sha: head, source_branch: binding.branch, target_branch: binding.base, source_project_id: 3, target_project_id: 3,
};

async function fixture(t, { replies = {}, remote = 'git@github.com:owner/repo.git', ocr, createPR = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'askill-forge-'));
  const log = join(dir, 'calls');
  const prev = { ...process.env };
  process.env.PATH = [dir].join(delimiter);
  process.env.ASKILL_FORGE_TEST_LOG = log;
  await writeFile(log, '');
  t.after(async () => {
    process.env.PATH = prev.PATH;
    if (prev.ASKILL_FORGE_TEST_LOG === undefined) {
      delete process.env.ASKILL_FORGE_TEST_LOG;
    } else {
      process.env.ASKILL_FORGE_TEST_LOG = prev.ASKILL_FORGE_TEST_LOG;
    }
    await rm(dir, { force: true, recursive: true });
  });
  const contents = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const [program, ...args] = process.argv.slice(1);
const command = path.basename(program);
const log = process.env.ASKILL_FORGE_TEST_LOG;
const input = args.includes('--input') ? JSON.parse(fs.readFileSync(0, 'utf8')) : undefined;
fs.appendFileSync(log, JSON.stringify({ command, args, input })+'\\n');
if (command === 'ocr') {
  process.stdout.write(${JSON.stringify(ocr ?? '')});
} else if (command === 'git') {
  if (args.includes('--git-common-dir') || args.includes('--show-toplevel')) {
    process.stdout.write(process.cwd()+'\\n');
  } else if (args[0] === 'rev-parse') {
    process.stdout.write((args.at(-1) === 'HEAD^{commit}' ? ${JSON.stringify(head)} : args.at(-1).split('^')[0])+'\\n');
  } else if (args[0] === 'symbolic-ref') {
    process.stdout.write(${JSON.stringify(`refs/heads/${binding.branch}\n`)});
  } else if (args[0] === 'remote') {
    process.stdout.write(${JSON.stringify(`${remote}\n`)});
  } else if (!args.includes('push') && args[0] !== 'check-ref-format') {
    process.exit(2);
  }
} else {
  const [,, host,, method, endpoint] = args;
  const key = [host, method, endpoint.split('?')[0]].join(' ');
  const replies = ${JSON.stringify(replies)};
  if (${createPR} && key === 'github.com GET repos/owner/repo/pulls' && fs.existsSync(log+'.created')) {
    replies[key] = [${JSON.stringify(githubPR)}];
  }
  if (${createPR} && key === 'github.com POST repos/owner/repo/pulls') {
    fs.writeFileSync(log+'.created', '');
  }
  if (!Object.hasOwn(replies, key)) { process.exit(1); }
  process.stdout.write(JSON.stringify(replies[key]));
}
`;
  for (const binary of ocr === undefined ? ['git', 'gh', 'glab'] : ['git', 'gh', 'glab', 'ocr']) {
    await writeFile(join(dir, binary), contents, { mode: 0o700 });
  }
  return {
    dir, calls: async () => (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)),
  };
}

test('issue adapters: explicit targets and literal drafts -> normalized provider records', async t => {
  const gitlabIssue = {
    id: 99, iid: 6, title: 'Second', description: '@literal\n--literal', state: 'opened',
    web_url: 'https://forge.example.org/group/sub/project/-/issues/6',
  };
  const env = await fixture(t, { replies: {
    'github.com GET repos/owner/repo/issues/4': githubIssue,
    'forge.example.org GET projects/group%2Fsub%2Fproject': { id: 3, path_with_namespace: gitlab.repository },
    'forge.example.org POST projects/group%2Fsub%2Fproject/issues': gitlabIssue,
  } });

  const observed = await observeIssue(github, 4);
  const registered = await registerIssue(gitlab, { title: gitlabIssue.title, body: gitlabIssue.description });

  assert.deepEqual(observed, { id: '4', title: 'First', body: 'notes', url: githubIssue.html_url, state: 'closed' });
  assert.deepEqual(registered, {
    id: '6', title: 'Second', body: gitlabIssue.description, url: gitlabIssue.web_url, state: 'open',
  });
  assert.deepEqual((await env.calls()).at(-1).input, { title: 'Second', description: gitlabIssue.description });
});

test('observePR: stale open pull request -> returns the actual head without looking up CI', async t => {
  const stale = { ...githubPR, head: { ...githubPR.head, sha: older } };
  const env = await fixture(t, { replies: { 'github.com GET repos/owner/repo/pulls': [stale] } });

  const result = await observePR(github, binding);

  assert.deepEqual(result, { ...binding, head: older, state: 'open', ci: 'unknown', id: '7', url: githubPR.html_url });
  assert.equal((await env.calls()).filter(call => call.command === 'gh').length, 1);
});

test('observePR: externally merged pull request -> reports terminal state without running CI lookups', async t => {
  const merged = { ...githubPR, state: 'closed', merged_at: '2026-11-20T01:00:00Z' };
  const env = await fixture(t, { replies: { 'github.com GET repos/owner/repo/pulls': [merged] } });

  const result = await observePR(github, binding);

  assert.equal(result.state, 'merged');
  const providerCalls = (await env.calls()).filter(call => call.command === 'gh');
  assert.equal(providerCalls.length, 1);
  assert.match(providerCalls[0].args[5], /state=all/);
});

test('observePR: another-head GitLab pipeline -> does not count as passing', async t => {
  await fixture(t, { replies: {
    'forge.example.org GET projects/group%2Fsub%2Fproject': { id: 3, path_with_namespace: gitlab.repository },
    'forge.example.org GET projects/group%2Fsub%2Fproject/merge_requests': [gitlabMR],
    'forge.example.org GET projects/group%2Fsub%2Fproject/merge_requests/8': {
      ...gitlabMR, head_pipeline: { sha: older, status: 'success' },
    },
  } });

  const result = await observePR(gitlab, binding);

  assert.equal(result.ci, 'unknown');
});

test('publishPR: push URL targets another repository -> does not push or create', async t => {
  const env = await fixture(t, { remote: 'git@github.com:other/repo.git', replies: {
    'github.com GET repos/owner/repo': { id: 1, full_name: github.repository },
    'github.com GET repos/owner/repo/pulls': [],
  } });

  await assert.rejects(publishPR(github, { ...binding, root: env.dir, worktree: env.dir, title: 'Review',
    allowPush: true, allowCreate: true }), /matching push URL/);

  assert.ok((await env.calls()).every(call => !call.args.includes('push') && !call.args.includes('POST')));
});

test('publishPR: both writes granted -> pushes only the reviewed SHA and confirms the created PR', async t => {
  const env = await fixture(t, { createPR: true, replies: {
    'github.com GET repos/owner/repo': { id: 1, full_name: github.repository },
    'github.com GET repos/owner/repo/pulls': [],
    [`github.com GET repos/owner/repo/git/ref/heads/${binding.branch}`]: {
      ref: `refs/heads/${binding.branch}`, object: { sha: head, type: 'commit' },
    },
    'github.com POST repos/owner/repo/pulls': githubPR,
    'github.com GET repos/owner/repo/pulls/7': { ...githubPR, mergeable: true },
    [`github.com GET repos/owner/repo/commits/${head}/status`]: { sha: head, total_count: 0, state: 'pending' },
    [`github.com GET repos/owner/repo/commits/${head}/check-runs`]: {
      total_count: 1, check_runs: [{ head_sha: head, status: 'completed', conclusion: 'success' }],
    },
  } });

  const result = await publishPR(github, { ...binding, root: env.dir, worktree: env.dir, title: 'Review',
    body: 'body', allowPush: true, allowCreate: true });

  const calls = await env.calls();
  assert.deepEqual(calls.find(call => call.args.includes('push')).args.slice(-3),
    ['--', 'origin', `${head}:refs/heads/${binding.branch}`]);
  assert.deepEqual(calls.find(call => call.args.includes('POST')).input,
    { title: 'Review', body: 'body', head: binding.branch, base: binding.base });
  assert.deepEqual(result, { ...binding, state: 'open', ci: 'pass', mergeable: 'mergeable', id: '7', url: githubPR.html_url });
});

test('publishPR: no explicit grants -> does not push or create', async t => {
  const env = await fixture(t, { replies: { 'github.com GET repos/owner/repo/pulls': [] } });

  const result = await publishPR(github, { ...binding, allowPush: 'true', allowCreate: 'true' });

  assert.equal(result, null);
  assert.ok((await env.calls()).every(call => !call.args.includes('push') && !call.args.includes('POST')));
});

test('runOCR: denied review -> never spawns any executable', async t => {
  const env = await fixture(t, { ocr: '' });

  const result = await runOCR({ base: older, head, cwd: env.dir, authorized: false });

  assert.equal(result.status, 'skipped-not-authorized');
  assert.deepEqual(await env.calls(), []);
});

test('runOCR: missing executable and no authorization -> reports uninstalled without spawning anything', async t => {
  const env = await fixture(t);

  const result = await runOCR({ base: older, head, cwd: env.dir, authorized: false });

  assert.equal(result.status, 'skipped-uninstalled');
  assert.deepEqual(await env.calls(), []);
});

test('runOCR: authorized and completed review -> exact committed binding and bounded receipt', async t => {
  const output = '{"status":"complete","comments":[],"manifest":{"terminal_state":"complete"}}\n';
  const env = await fixture(t, { ocr: output });

  const result = await runOCR({ base: older, head, cwd: env.dir, authorized: true, background: 'Review context' });

  assert.deepEqual(result, { base: older, head, status: 'completed', output });
  assert.deepEqual(await env.calls(), [{ command: 'ocr', args: [
    'review', '--audience', 'agent', '--from', older, '--to', head, '--format', 'json', '--background', 'Review context',
  ] }]);
});

test('runOCR: zero exit with a partial manifest -> records a failed receipt', async t => {
  const output = '{"status":"partial","comments":[],"manifest":{"terminal_state":"partial"}}\n';
  const env = await fixture(t, { ocr: output });

  const result = await runOCR({ base: older, head, cwd: env.dir, authorized: true });

  assert.equal(result.status, 'failed');
  assert.equal(result.output, output);
});
