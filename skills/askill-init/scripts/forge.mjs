import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import { delimiter, resolve } from 'node:path';

const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const PATH_SEGMENT = /^[a-z0-9_][a-z0-9_.-]*$/i;
const LIMIT = 100;

function execute(command, args, {
  cwd, input, env = {}, timeout = 60_000, limit = 8 * 1024 * 1024, captureFailure = false,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const chunks = [];
    let bytes = 0;
    let problem;
    const timer = setTimeout(() => {
      problem = 'timed out';
      child.kill('SIGKILL');
    }, timeout);
    child.stdout.on('data', chunk => {
      if (problem) {
        return;
      }
      if (bytes + chunk.length > limit) {
        problem = 'exceeded the output limit';
        child.kill('SIGKILL');
        return;
      }
      bytes += chunk.length;
      chunks.push(chunk);
    });
    child.stderr.resume();
    child.on('error', error => {
      clearTimeout(timer);
      reject(Object.assign(new Error(`${captureFailure ? 'ocr' : command} could not start (${error.code ?? 'unknown error'})`), {
        code: error.code,
      }));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8');
      if (problem || code !== 0) {
        const error = new Error(`${command} ${problem ?? `exited with ${signal ?? code}`}`);
        if (captureFailure) {
          error.output = output;
        }
        reject(error);
      } else {
        resolve(output);
      }
    });
    if (child.stdin) {
      child.stdin.on('error', () => {
        problem ??= 'could not send its input';
        child.kill('SIGKILL');
      });
      child.stdin.end(input);
    }
  });
}

function getTarget(destination) {
  const { provider, repository, remote = 'origin' } = destination ?? {};
  const github = provider === 'github';
  if (!github && provider !== 'gitlab') {
    throw new Error('Forge provider must be github or gitlab');
  }
  const parts = typeof repository === 'string' ? repository.split('/') : [];
  if (parts.length < 2 || (github && parts.length !== 2) || parts.some(part => !PATH_SEGMENT.test(part))) {
    throw new Error('Invalid forge repository path');
  }
  const host = destination.host ?? (github ? 'github.com' : 'gitlab.com');
  if (typeof host !== 'string' || !HOST.test(host)) {
    throw new Error('Forge host must be a DNS hostname without port, credentials or path');
  }
  if (typeof remote !== 'string' || !PATH_SEGMENT.test(remote)) {
    throw new Error('Invalid Git remote name');
  }
  return {
    github, repository, remote, host: host.toLowerCase(), owner: parts[0],
    command: github ? 'gh' : 'glab',
    project: github ? `repos/${repository}` : `projects/${encodeURIComponent(repository)}`,
  };
}

async function api(target, suffix, payload) {
  const args = ['api', '--hostname', target.host, '--method', payload === undefined ? 'GET' : 'POST',
    `${target.project}${suffix}`];
  if (payload !== undefined) {
    args.push('--input', '-');
  }
  const output = await execute(target.command, args, {
    input: payload === undefined ? undefined : JSON.stringify(payload),
    env: { GH_PROMPT_DISABLED: '1', GLAB_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${target.command} returned invalid JSON`);
  }
}

function getId(id) {
  const text = Number.isSafeInteger(id) || typeof id === 'string' ? String(id) : '';
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new Error('Expected a positive forge issue or pull request number');
  }
  return text;
}

function sameRepo(target, repository) {
  return typeof repository === 'string' && (target.github
    ? repository.toLowerCase() === target.repository.toLowerCase()
    : repository === target.repository);
}

function parseUrl(url) {
  try {
    return typeof url === 'string' ? new URL(url) : null;
  } catch {
    return null;
  }
}

function confirmUrl(target, url, path) {
  const parsed = parseUrl(url);
  if (!parsed || parsed.protocol !== 'https:' || parsed.host !== target.host ||
    parsed.username || parsed.password || parsed.search || parsed.hash ||
    !parsed.pathname.endsWith(path) || !sameRepo(target, parsed.pathname.slice(1, -path.length))) {
    throw new Error('Forge response URL did not match the configured destination');
  }
  return url;
}

function bodyFields(title, body = '') {
  if (typeof title !== 'string' || !title.trim() || typeof body !== 'string') {
    throw new Error('Expected a nonempty title and a string body');
  }
  return { title, body };
}

function normalizeIssue(target, issue) {
  const id = getId(target.github ? issue?.number : issue?.iid);
  if (issue.pull_request) {
    throw new Error('The issue number identifies a pull request');
  }
  const { title, body } = bodyFields(issue.title, (target.github ? issue.body : issue.description) ?? '');
  const url = confirmUrl(target, target.github ? issue.html_url : issue.web_url,
    `${target.github ? '/issues/' : '/-/issues/'}${id}`);
  const state = issue.state === 'opened' ? 'open' : issue.state;
  if (!['open', 'closed'].includes(state)) {
    throw new Error('Forge returned an unsupported issue lifecycle state');
  }
  return { id, title, body, url, state };
}

export async function observeIssue(destination, id) {
  const target = getTarget(destination);
  const number = getId(id);
  const issue = normalizeIssue(target, await api(target, `/issues/${number}`));
  if (issue.id !== number) {
    throw new Error('Observed issue did not match the requested issue number');
  }
  return issue;
}

export async function registerIssue(destination, draft) {
  const target = getTarget(destination);
  const { title, body } = bodyFields(draft?.title, draft?.body);
  await getProjectId(target);
  return normalizeIssue(target, await api(target, '/issues', target.github ? { title, body } : {
    title, description: body,
  }));
}

function git(cwd, args, env = {}) {
  return execute('git', args, {
    cwd,
    env: { GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1', ...env },
  }).then(output => output.trim());
}

async function getBinding({ branch, base, head }) {
  for (const ref of [branch, base]) {
    if (typeof ref !== 'string' || !ref || ref.startsWith('-')) {
      throw new Error('Expected an explicit source and target branch');
    }
    await git(undefined, ['check-ref-format', `refs/heads/${ref}`]);
  }
  if (branch === base || typeof head !== 'string' || !SHA.test(head)) {
    throw new Error('Expected different source and target branches and a full reviewed head SHA');
  }
  return { branch, base, head: head.toLowerCase() };
}

async function getProjectId(target) {
  const project = await api(target, '');
  if (!sameRepo(target, target.github ? project?.full_name : project?.path_with_namespace)) {
    throw new Error('Forge response did not match the configured project');
  }
  return getId(project.id);
}

function normalizePR(target, item) {
  const head = target.github ? item.head?.sha : item.sha;
  const branch = target.github ? item.head?.ref : item.source_branch;
  const base = target.github ? item.base?.ref : item.target_branch;
  const id = getId(target.github ? item.number : item.iid);
  const url = confirmUrl(target, target.github ? item.html_url : item.web_url,
    `${target.github ? '/pull/' : '/-/merge_requests/'}${id}`);
  if (typeof head !== 'string' || !SHA.test(head) || !branch || !base) {
    throw new Error('Forge returned an incomplete pull request binding');
  }
  const state = target.github
    ? (item.state === 'closed' && (item.merged === true || typeof item.merged_at === 'string') ? 'merged' : item.state)
    : (item.state === 'opened' ? 'open' : item.state);
  if (!['open', 'closed', 'merged'].includes(state)) {
    throw new Error('Forge returned an unsupported pull request lifecycle state');
  }
  return { id, url, head: head.toLowerCase(), base, branch, state, ci: 'unknown' };
}

async function findPR(target, binding) {
  const { branch } = binding;
  const projectId = target.github ? null : await getProjectId(target);
  const filter = new URLSearchParams(target.github
    ? { state: 'all', head: `${target.owner}:${branch}` }
    : { scope: 'all', source_branch: branch });
  filter.set('per_page', String(LIMIT));
  const items = await api(target, `${target.github ? '/pulls' : '/merge_requests'}?${filter}`);
  if (!Array.isArray(items) || items.length >= LIMIT) {
    throw new Error('Forge pull request search returned an invalid or incomplete page');
  }
  const matches = [];
  for (const item of items) {
    if (target.github) {
      if (item?.head?.ref !== branch || !sameRepo(target, item.base?.repo?.full_name)) {
        throw new Error('GitHub returned an unexpected pull request binding');
      }
      if (!sameRepo(target, item.head.repo?.full_name)) {
        continue;
      }
    } else {
      if (item?.source_branch !== branch || getId(item.target_project_id) !== projectId) {
        throw new Error('GitLab returned an unexpected merge request binding');
      }
      if (getId(item.source_project_id) !== projectId) {
        continue;
      }
    }
    matches.push(normalizePR(target, item));
  }
  const open = matches.filter(pr => pr.state === 'open');
  const candidates = open.length ? open : matches;
  if (candidates.length > 1 || (candidates.length && candidates[0].base !== binding.base)) {
    throw new Error('Existing pull request for the source branch is ambiguous or targets another base');
  }
  return candidates[0] ?? null;
}

async function githubCI(target, head) {
  const [checks, statuses] = await Promise.all([
    api(target, `/commits/${head}/check-runs?filter=latest&per_page=${LIMIT}`),
    api(target, `/commits/${head}/status`),
  ]);
  if (!Array.isArray(checks?.check_runs) || checks.total_count !== checks.check_runs.length ||
    statuses?.sha !== head || !Number.isSafeInteger(statuses.total_count) || statuses.total_count < 0 ||
    checks.check_runs.some(check => check.head_sha !== head)) {
    return 'unknown';
  }
  const conclusions = checks.check_runs.map(check => check.status === 'completed' ? check.conclusion : 'pending');
  if (statuses.total_count > 0) {
    conclusions.push(statuses.state);
  }
  if (conclusions.some(state => ['failure', 'error', 'cancelled', 'timed_out', 'action_required', 'startup_failure'].includes(state))) {
    return 'failed';
  }
  if (conclusions.includes('pending')) {
    return 'pending';
  }
  return conclusions.length && conclusions.every(state => state === 'success') ? 'pass' : 'unknown';
}

function gitlabCI(pipeline, head) {
  if (pipeline?.sha !== head) {
    return 'unknown';
  }
  if (pipeline.status === 'success') {
    return 'pass';
  }
  if (['failed', 'canceled'].includes(pipeline.status)) {
    return 'failed';
  }
  if (['created', 'waiting_for_resource', 'preparing', 'pending', 'running', 'scheduled', 'manual'].includes(pipeline.status)) {
    return 'pending';
  }
  return 'unknown';
}

async function withCI(target, binding, pr) {
  if (pr?.state === 'open' && pr.head === binding.head) {
    let detail;
    try {
      const item = await api(target, `${target.github ? '/pulls' : '/merge_requests'}/${pr.id}`);
      detail = normalizePR(target, item);
      if (detail.id !== pr.id || detail.head !== pr.head || detail.branch !== pr.branch || detail.base !== pr.base ||
        detail.state !== 'open' || (target.github &&
          (!sameRepo(target, item.head.repo?.full_name) || !sameRepo(target, item.base.repo?.full_name)))) {
        return findPR(target, binding);
      }
      const isDraft = item.draft === true;
      pr.mergeable = target.github
        ? (item.mergeable === false ? 'conflicting' : item.mergeable === true && !isDraft ? 'mergeable' : 'unknown')
        : (item.detailed_merge_status === 'conflict' ? 'conflicting'
          : item.detailed_merge_status === 'mergeable' && !isDraft ? 'mergeable' : 'unknown');
      pr.ci = target.github ? await githubCI(target, pr.head) : gitlabCI(item.head_pipeline, pr.head);
    } catch {
      // CI permission, incompatible responses and transient errors are not successful checks.
      pr.ci = 'unknown';
    }
    if (pr.ci !== 'unknown' || (pr.mergeable && pr.mergeable !== 'unknown')) {
      const current = await findPR(target, binding);
      if (!current || current.id !== pr.id || current.head !== pr.head || current.state !== 'open') {
        return current;
      }
    }
  }
  return pr;
}

export async function observePR(destination, options) {
  const target = getTarget(destination);
  const binding = await getBinding(options);
  return withCI(target, binding, await findPR(target, binding));
}

function isRemoteTarget(target, remoteUrl) {
  const scp = /^(?:[a-z0-9_.-]+@)?([a-z0-9.-]+):([a-z0-9_./-]+)$/i.exec(remoteUrl);
  if (scp) {
    return scp[1].toLowerCase() === target.host && sameRepo(target, scp[2].replace(/\.git$/, ''));
  }
  const url = parseUrl(remoteUrl);
  return url && ['https:', 'ssh:'].includes(url.protocol) && url.host === target.host &&
    !url.search && !url.hash && sameRepo(target, url.pathname.slice(1).replace(/\.git$/, ''));
}

async function assertWorktreeHead(root, worktree, { branch, head }) {
  if (typeof root !== 'string' || !root || typeof worktree !== 'string' || !worktree) {
    throw new Error('Publication requires a repository root and worktree');
  }
  const [rootGit, worktreeGit, worktreeTop, actualHead, actualBranch] = await Promise.all([
    git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
    git(worktree, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
    git(worktree, ['rev-parse', '--show-toplevel']),
    git(worktree, ['rev-parse', '--verify', 'HEAD^{commit}']),
    git(worktree, ['symbolic-ref', '-q', 'HEAD']),
  ]);
  if (await realpath(rootGit) !== await realpath(worktreeGit) ||
    await realpath(worktree) !== await realpath(worktreeTop) ||
    actualHead !== head || actualBranch !== `refs/heads/${branch}`) {
    throw new Error('Worktree no longer matches the reviewed repository, branch and head');
  }
}

async function pushHead(target, worktree, { branch, head }) {
  const urls = (await git(worktree, ['remote', 'get-url', '--push', '--all', target.remote])).split('\n');
  if (urls.length !== 1 || !isRemoteTarget(target, urls[0])) {
    throw new Error('The configured Git remote does not have exactly one matching push URL');
  }
  await git(worktree, ['-c', `remote.${target.remote}.mirror=false`, '-c', 'http.followRedirects=false',
    'push', '--no-follow-tags', '--no-recurse-submodules',
    '--', target.remote, `${head}:refs/heads/${branch}`], { GIT_ALLOW_PROTOCOL: 'https:ssh' });
}

async function assertRemoteHead(target, { branch, head }) {
  const ref = target.github
    ? `/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`
    : `/repository/branches/${encodeURIComponent(branch)}`;
  const observed = await api(target, ref);
  const matches = target.github
    ? observed?.ref === `refs/heads/${branch}` && observed.object?.type === 'commit' && observed.object.sha === head
    : observed?.name === branch && observed.commit?.id === head;
  if (!matches) {
    throw new Error('The provider branch does not point to the reviewed head');
  }
}

export async function publishPR(destination, options) {
  const target = getTarget(destination);
  const binding = await getBinding(options);
  const { root, worktree, allowPush, allowCreate } = options;
  let pr = await findPR(target, binding);
  if (pr && pr.state !== 'open') {
    throw new Error('Cannot publish to a pull request that is not open');
  }
  if (pr?.head === binding.head) {
    return confirmPublication(target, binding, pr);
  }
  if (!pr && allowCreate !== true) {
    return null;
  }
  const draft = pr ? null : bodyFields(options.title, options.body);
  await assertWorktreeHead(root, worktree, binding);
  if (target.github) {
    await getProjectId(target);
  }
  if (allowPush === true) {
    await pushHead(target, worktree, binding);
  }
  if (!pr) {
    await assertRemoteHead(target, binding);
    pr = await findPR(target, binding);
    if (!pr) {
      const created = normalizePR(target, await api(target, target.github ? '/pulls' : '/merge_requests', target.github
        ? { ...draft, head: binding.branch, base: binding.base }
        : { title: draft.title, description: draft.body, source_branch: binding.branch, target_branch: binding.base }));
      pr = await findPR(target, binding);
      if (created.id !== pr?.id || created.base !== binding.base || created.branch !== binding.branch ||
        created.head !== binding.head) {
        throw new Error('Pull request creation could not be confirmed at the reviewed binding');
      }
    }
  } else {
    const current = await findPR(target, binding);
    if (current?.id !== pr.id) {
      throw new Error('Existing pull request changed during publication');
    }
    pr = current;
  }
  return confirmPublication(target, binding, pr);
}

async function confirmPublication(target, binding, pr) {
  if (pr?.head !== binding.head || pr.state !== 'open') {
    throw new Error('Pull request does not point to the reviewed head');
  }
  const observed = await withCI(target, binding, pr);
  const latest = await findPR(target, binding);
  if (latest?.head !== binding.head || latest.id !== pr.id || latest.state !== 'open' ||
    observed?.id !== pr.id || observed.head !== binding.head || observed.state !== 'open') {
    throw new Error('Pull request changed during publication');
  }
  return observed;
}

async function findOCR() {
  const names = process.platform === 'win32' ? ['ocr.exe'] : ['ocr'];
  for (const dir of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const path = resolve(dir, name);
      try {
        if ((await stat(path)).isFile()) {
          await access(path, constants.X_OK);
          return path;
        }
      } catch (error) {
        if (!['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR', 'ELOOP'].includes(error.code)) {
          throw error;
        }
      }
    }
  }
  return null;
}

export async function runOCR({ cwd, base, head, authorized, background }) {
  const receipt = { base, head };
  let output;
  try {
    const executable = await findOCR();
    if (!executable) {
      return { ...receipt, status: 'skipped-uninstalled' };
    }
    if (authorized !== true) {
      return { ...receipt, status: 'skipped-not-authorized' };
    }
    if (typeof cwd !== 'string' || !cwd || typeof base !== 'string' || !SHA.test(base) ||
      typeof head !== 'string' || !SHA.test(head)) {
      return { ...receipt, status: 'failed', reason: 'OCR requires an explicit worktree and full base/head SHAs' };
    }
    const args = ['review', '--audience', 'agent', '--from', base, '--to', head, '--format', 'json'];
    if (typeof background === 'string' && background.trim()) {
      args.push('--background', background);
    }
    output = await execute(executable, args, {
      cwd,
      timeout: (background === true ? 45 : 35) * 60_000,
      limit: 512 * 1024,
      captureFailure: true,
    });
    const report = JSON.parse(output);
    if (!['success', 'complete', 'skipped'].includes(report?.status) ||
      !(Array.isArray(report.comments) || report.comments === null) || report.summary?.budget_exceeded === true ||
      (report.manifest && report.manifest.terminal_state !== report.status)) {
      return { ...receipt, status: 'failed', reason: 'OCR did not report a complete review', output };
    }
    return { ...receipt, status: 'completed', output };
  } catch (error) {
    return {
      ...receipt, status: 'failed', reason: 'OCR command or completion output failed validation',
      ...((output ?? error.output) ? { output: output ?? error.output } : {}),
    };
  }
}
