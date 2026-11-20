// Decision ordering and plan/import boundary adapted from FluoJS 6ec42ab,
// .agents/skills/{create-lane,execute-lane}. See NOTICE-Fluo.md.
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { conventionIndex } from './conventions.mjs';
import { retro } from './retro.mjs';

const AXES = ['contract', 'code', 'verification'];
const GRANTS = ['local_commit', 'push', 'pr_create', 'pr_merge', 'cleanup_command_worktrees'];
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = (x) => typeof x === 'string' && x.trim().length > 0;
const texts = (x) => Array.isArray(x) && x.every(text);
const unique = (x) => new Set(x).size === x.length;
const sha = (x) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const oid = (x) => typeof x === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(x);
const id = (x) => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(x)
  && !x.includes('..') && !/(?:\.|\.lock)$/i.test(x) && !(x in Object.prototype);
const requireThat = (ok, message) => { if (!ok) { throw new Error(message); } };
const statePath = (lane) => `lanes/${lane}/state.json`;
const factPath = (lane, issue, hash) => `work/${lane}/${issue}/${hash}.json`;
const bindingKeys = ['lane_id', 'issue', 'base_sha', 'head_sha', 'contract_sha256'];
const bound = (record, binding) => bindingKeys.every((key) => record?.[key] === binding[key]);
const bindingOf = (row) => Object.fromEntries(bindingKeys.map((key) => [key, row[key]]));

function validatePlan(plan, artifact, config, digest, lane) {
  requireThat(plan?.version === 2 && plan.lane_id === lane && artifact?.version === 1
    && artifact.artifact_id === plan.source.artifact_id && plan.source.sha256 === digest(artifact),
  'plan or issue artifact provenance mismatch');
  requireThat(config?.version === 1 && plan.config_sha256 === digest(config)
    && artifact.config_sha256 === plan.config_sha256 && plan.base_branch === config.base_branch,
  'configuration provenance mismatch');
  const issues = plan.confirmed_issues;
  requireThat(Array.isArray(issues) && issues.length > 0 && issues.every(id)
    && unique(issues.map((v) => v.toLowerCase())) && Array.isArray(artifact.issues)
    && digest(artifact.issues.map((v) => v.id)) === digest(issues), 'invalid confirmed issue set');
  requireThat(Number.isSafeInteger(plan.retry_policy?.attempt_ceiling) && plan.retry_policy.attempt_ceiling > 0,
    'invalid retry ceiling');
  requireThat(isObject(plan.authority_scope) && Object.keys(plan.authority_scope).length === GRANTS.length
    && GRANTS.every((key) => typeof plan.authority_scope[key] === 'boolean'), 'invalid authority scope');
  const graph = plan.dependency_graph;
  requireThat(isObject(graph) && Object.keys(graph).length === issues.length
    && issues.every((i) => Array.isArray(graph[i]) && unique(graph[i]) && graph[i].every((d) => issues.includes(d))),
  'invalid dependency graph');
  const reasons = plan.dependency_reasons;
  const edges = new Set(issues.flatMap((i) => graph[i].map((d) => `${i}:${d}`)));
  requireThat(Array.isArray(reasons) && reasons.every((r) => text(r?.reason)
    && edges.delete(`${r.issue}:${r.depends_on}`)) && edges.size === 0, 'missing or duplicate dependency reasons');
  const visiting = new Set();
  const visited = new Set();
  function visit(i) {
    if (visited.has(i)) { return; }
    requireThat(!visiting.has(i), 'cyclic dependency graph');
    visiting.add(i);
    graph[i].forEach(visit);
    visiting.delete(i);
    visited.add(i);
  }
  issues.forEach(visit);
}

async function load(context, lane, importing) {
  const { store, root } = context;
  requireThat(id(lane), 'invalid lane_id');
  const planPath = `lanes/${lane}/plan.json`;
  const savedPlan = await store.read(planPath);
  const plan = savedPlan ?? (importing ? await store.read(`lanes/${lane}.json`) : null);
  requireThat(id(plan?.source?.artifact_id), 'missing plan or invalid artifact_id');
  const artifact = await store.read(`issues/${plan.source.artifact_id}.json`);
  const config = await store.read('config.json');
  validatePlan(plan, artifact, config, store.digest, lane);
  requireThat(text(plan.base_branch) && !plan.base_branch.startsWith('-')
    && plan.base_branch !== 'HEAD', 'unsafe base branch');
  await store.git(root, ['check-ref-format', `refs/heads/${plan.base_branch}`]);
  const plan_sha256 = store.digest(plan);
  const savedState = await store.read(statePath(lane));
  const state = savedState ?? (importing
    ? (await store.read(`lanes-v4/${lane}.json`)) ?? {
      version: 4, lane_id: lane, plan_sha256, source: plan.source, issues: Object.fromEntries(
        plan.confirmed_issues.map((i) => [i, { attempts: {}, reviews: {} }])),
    }
    : null);
  requireThat(state?.version === 4 && state.lane_id === lane && state.plan_sha256 === plan_sha256
    && store.digest(state.source) === store.digest(plan.source), 'lane not imported or incompatible re-import');
  if (importing && savedPlan === null) { await store.create(planPath, plan); }
  if (importing && savedState === null) { await store.create(statePath(lane), state); }
  return { ...context, root: await realpath(root), plan, artifact, config, state };
}

async function saveFact(c, issue, fact) {
  const hash = c.store.digest(fact);
  const file = factPath(c.plan.lane_id, issue, hash);
  const previous = await c.store.read(file);
  if (previous === null) { await c.store.create(file, fact); }
  else { requireThat(c.store.digest(previous) === hash, 'existing evidence digest mismatch'); }
  return hash;
}

async function readFact(c, issue, hash) {
  if (hash === undefined) { return null; }
  requireThat(sha(hash), 'invalid evidence reference');
  const fact = await c.store.read(factPath(c.plan.lane_id, issue, hash));
  requireThat(isObject(fact) && c.store.digest(fact) === hash && fact.lane_id === c.plan.lane_id
    && fact.issue === issue, 'missing or corrupt lane evidence');
  return fact;
}

function contractValid(v, row) {
  return v?.version === 1 && v.lane_id === row.lane_id && v.issue === row.issue
    && v.base_sha === row.base_sha && v.issue_sha256 === row.issue_sha256
    && text(v.goal) && ['scope', 'unchanged', 'non_goals'].every((k) => texts(v[k]))
    && v.scope.length > 0 && Array.isArray(v.criteria) && v.criteria.length > 0
    && v.criteria.every((q) => id(q?.id) && text(q.method) && text(q.expected))
    && unique(v.criteria.map((q) => q.id)) && Array.isArray(v.required_review_axes)
    && v.required_review_axes.length === AXES.length && AXES.every((a) => v.required_review_axes.includes(a))
    && (v.predicted_files === undefined || (texts(v.predicted_files) && v.predicted_files.length > 0
      && v.predicted_files.every((p) => !p.includes('\\') && !/[\x00-\x1f*?]/u.test(p)
        && p.replace(/\/$/, '').split('/').every((s) => s && s !== '.' && s !== '..'))));
}

async function containsCommit(c, tip, ancestor) {
  requireThat(oid(tip) && oid(ancestor), 'invalid ancestry probe');
  return await c.store.git(c.root, ['rev-list', '--count', '--max-count=1', ancestor, '--not', tip]) === '0';
}

async function gitFacts(c, issue, pinned, requiredCommits) {
  const git = (at, ...args) => c.store.git(at, args);
  requireThat(await realpath(await git(c.root, 'rev-parse', '--show-toplevel')) === c.root, 'target is not repository root');
  const branch = `askill/${c.plan.lane_id}/${issue}`;
  const worktree = path.join(c.root, '.askill', 'worktrees', c.plan.lane_id, issue);
  const base_tip = await git(c.root, 'rev-parse', '--verify', `refs/heads/${c.plan.base_branch}^{commit}`);
  const wanted = `refs/heads/${branch}`;
  requireThat(c.plan.base_branch !== branch && oid(base_tip), 'invalid base identity');
  const branches = await git(c.root, 'for-each-ref', '--format=%(refname) %(objectname)', wanted);
  const head_sha = branches.split('\n').find((line) => line.startsWith(`${wanted} `))?.slice(wanted.length + 1) ?? null;
  let base_sha = pinned && await containsCommit(c, base_tip, pinned)
    && (!head_sha || await containsCommit(c, head_sha, pinned)) ? pinned : base_tip;
  if (pinned && base_sha !== base_tip) {
    for (const required of requiredCommits) {
      if (!await containsCommit(c, pinned, required) && await containsCommit(c, base_tip, required)) {
        base_sha = base_tip;
        break;
      }
    }
  }
  const list = await git(c.root, 'worktree', 'list', '--porcelain', '-z');
  const registrations = list.split('\0\0').map((block) => Object.fromEntries(block.split('\0')
    .filter(Boolean).map((line) => { const n = line.indexOf(' '); return n < 0 ? [line, true] : [line.slice(0, n), line.slice(n + 1)]; })));
  const registration = registrations.find((r) => r.worktree === worktree || r.branch === wanted);
  let dir = c.root;
  let exists = true;
  for (const part of path.relative(c.root, worktree).split(path.sep)) {
    dir = path.join(dir, part);
    const info = await lstat(dir).catch((error) => { if (error.code === 'ENOENT') { return null; } throw error; });
    if (!info) { exists = false; break; }
    requireThat(info.isDirectory() && !info.isSymbolicLink(), 'worktree path is not a real directory');
  }
  const row = { lane_id: c.plan.lane_id, issue, branch, worktree, base_sha, base_tip, head_sha, contract_sha256: null };
  if (!exists && !registration) { return { ...row, present: false }; }
  requireThat(exists && registration?.worktree === worktree && registration.branch === wanted
    && oid(head_sha) && registration.HEAD === head_sha
    && await realpath(await git(worktree, 'rev-parse', '--show-toplevel')) === worktree
    && await git(worktree, 'rev-parse', 'HEAD') === head_sha
    && await git(worktree, 'symbolic-ref', 'HEAD') === wanted
    && await realpath(await git(worktree, 'rev-parse', '--path-format=absolute', '--git-common-dir'))
      === await realpath(await git(c.root, 'rev-parse', '--path-format=absolute', '--git-common-dir')),
  'worktree identity mismatch: do not use a detached, moved, foreign or replacement checkout');
  const mergeBase = await git(worktree, 'merge-base', base_sha, head_sha);
  const changed = await git(worktree, 'diff', '--name-only', '--no-renames', '-z', base_sha, head_sha, '--');
  const status = await git(worktree, 'status', '--porcelain=v1', '-z', '--untracked-files=all');
  return { ...row, present: true, incorporates_base: mergeBase === base_sha,
    changed_files: changed.split('\0').filter(Boolean), dirty: Boolean(status) };
}

function matchingChecks(checks, contract) {
  return Array.isArray(checks) && checks.length === contract.criteria.length
    && contract.criteria.every((q) => checks.some((r) => r?.criterion === q.id && text(r.command)
      && Number.isSafeInteger(r.exit_code) && r.exit_code >= 0 && r.exit_code <= 255 && text(r.observation)
      && (r.failure_kind === undefined || (r.exit_code !== 0 && ['defect', 'preparation'].includes(r.failure_kind)))));
}

const hasDefect = (checks) => checks.some((r) => r.exit_code !== 0 && r.failure_kind === 'defect');

function decision(ob, action, extras = {}) {
  const { row, grants } = ob;
  let dispatch;
  if (['implement', 'fix-back'].includes(action)) {
    dispatch = { skill: 'askill-issue-implement', ...bindingOf(row), branch: row.branch, worktree: row.worktree,
      allow_commit: grants.local_commit, allow_push: false, require_new_head: action === 'fix-back',
      contract_ref: `.askill/${factPath(row.lane_id, row.issue, row.contract_sha256)}`,
      convention: row.convention };
    if (action === 'implement' && !row.present) {
      // argv is data for the operator's trusted host, not a generated shell command.
      dispatch.setup = { cwd: ob.root, argv: row.head_sha
        ? ['git', 'worktree', 'add', '--', row.worktree, row.branch]
        : ['git', 'worktree', 'add', '-b', row.branch, '--', row.worktree, row.base_sha] };
    }
  }
  return { ...row, action, ...extras, ...(dispatch ? { dispatch } : {}) };
}

// Pure ordering: observed failures > standing blockers > terminal truth >
// dependencies > preflight > implementation > reviews > authorized publication.
function decide(ob) {
  const { row, entry, contract, implementation, reviews, issueState, unmet, pr, config, grants } = ob;
  const next = (action, extras) => decision(ob, action, extras);
  if (ob.error) { return next('observation-failed', { reason: ob.error }); }
  if (entry.blocker) { return next('blocked', { reason: entry.blocker.type, blocker: entry.blocker }); }
  if (pr?.state === 'MERGED') {
    if (row.head_sha && pr.headSha !== row.head_sha) { return next('blocked', { reason: 'merged-pr-head-mismatch' }); }
    if (grants.cleanup_command_worktrees && (row.present || row.head_sha)) {
      return next('blocked', { reason: 'merged-pr-cleanup-host-handoff', pr });
    }
    return next('done', { reason: 'merged-pr', pr });
  }
  if (issueState === 'CLOSED' && !pr) { return next('done', { reason: 'issue-closed-externally' }); }
  if (unmet.length) { return next('wait-dependencies', { unmet, details: ob.dependencyDetails }); }
  if (!contractValid(contract, row)) { return next('preflight', { reason: 'missing-or-stale-contract' }); }
  if (!row.present || row.head_sha === row.base_sha) {
    return next(grants.local_commit ? 'implement' : 'await-local-commit', { reason: 'committed-worktree-required' });
  }
  if (!row.incorporates_base) { return next('preflight', { reason: 'base-not-incorporated' }); }
  if (row.dirty) { return next('prepare-worktree', { reason: 'worktree-not-clean' }); }
  if (!row.changed_files?.length) {
    return next(grants.local_commit ? 'implement' : 'await-local-commit', { reason: 'empty-diff' });
  }
  if (contract.predicted_files && row.changed_files.some((file) => !contract.predicted_files.some(
    (p) => p === file || (p.endsWith('/') && file.startsWith(p))))) {
    return next('preflight', { reason: 'changed-files-outside-contract', files: row.changed_files });
  }
  if (!bound(implementation, row) || !matchingChecks(implementation.checks, contract)) {
    return next('record-implementation', { reason: 'missing-exact-head-verification' });
  }
  if (hasDefect(implementation.checks)) { return next('fix-back', { reason: 'checks-failed' }); }
  if (implementation.checks.some((r) => r.exit_code !== 0)) {
    return next('record-implementation', { reason: 'missing-verification-evidence' });
  }
  const fresh = reviews.filter((r) => bound(r, row));
  const block = fresh.find((r) => r.verdict === 'block');
  if (block) { return next('fix-back', { reason: 'review-block', axis: block.axis, evidence: block.evidence }); }
  const missing = AXES.filter((axis) => !fresh.some((r) => r.axis === axis && r.verdict === 'pass'));
  if (missing.length) {
    return next('review', { reason: fresh.some((r) => r.verdict === 'needs-evidence') ? 'needs-evidence' : 'missing-axes',
      assignments: missing.map((axis) => ({ ...bindingOf(row), axis, worktree: row.worktree, read_only: true,
        convention: row.convention,
        contract_ref: `.askill/${factPath(row.lane_id, row.issue, row.contract_sha256)}`,
        implementation_ref: `.askill/${factPath(row.lane_id, row.issue, entry.implementation)}`,
        exclude_reviewers: [implementation.implementer, ...fresh.filter((r) => r.axis !== axis).map((r) => r.reviewer)] })) });
  }
  if (!config.destinations.pull_requests) { return next('done', { reason: 'verified-local-head' }); }
  if (!pr) {
    if (entry.publication) { return next('blocked', { reason: 'previously-observed-pr-missing' }); }
    return grants.pr_create ? next('create-pr', { allow_push: grants.push,
      requires_existing_remote_head: !grants.push }) : next('blocked', { reason: 'publication-not-authorized' });
  }
  if (pr.state === 'CLOSED') { return next('blocked', { reason: 'pr-closed-externally', pr }); }
  if (pr.headSha !== row.head_sha) {
    return grants.push ? next('push', { pr }) : next('blocked', { reason: 'push-not-authorized', pr });
  }
  if (pr.mergeable === 'CONFLICTING') { return next('resolve-conflict', { pr }); }
  if (pr.ciStatus === 'failing') { return next('fix-back', { reason: 'ci-failing', pr }); }
  if (pr.ciStatus !== 'passing') { return next('wait-ci', { pr }); }
  if (pr.mergeable !== 'MERGEABLE') { return next('wait-mergeability', { pr }); }
  return grants.pr_merge ? next('blocked', { reason: 'merge-host-handoff', pr }) : next('request-merge-approval', { pr });
}

function normalizePR(pr, row, base) {
  if (pr === null) { return null; }
  requireThat(isObject(pr) && pr.base === base && pr.branch === row.branch && oid(pr.head)
    && text(String(pr.id ?? '')) && text(pr.url), 'invalid PR observation');
  const state = String(pr.state).toUpperCase();
  requireThat(['OPEN', 'OPENED', 'CLOSED', 'MERGED'].includes(state), 'unknown PR lifecycle state');
  return { ...pr, state: state === 'OPENED' ? 'OPEN' : state, headSha: pr.head,
    mergeable: String(pr.mergeable ?? 'unknown').toUpperCase(),
    ciStatus: ({ failed: 'failing', pass: 'passing' })[pr.ci] ?? 'unknown' };
}

async function observe(c, issue, deps) {
  const entry = c.state.issues[issue];
  const contract = await readFact(c, issue, entry.contract);
  const required = (observed) => observed.pr?.state === 'MERGED'
    ? observed.pr.merge_commit_sha ?? observed.pr.head : observed.row.head_sha;
  const row = await gitFacts(c, issue, contract?.base_sha, deps.map(([, ob]) => required(ob)).filter(Boolean));
  const indexEntry = await c.store.git(c.root, ['ls-tree', row.base_sha, '--', conventionIndex]);
  row.convention = /^100(?:644|755) blob /u.test(indexEntry)
    ? { path: conventionIndex, base_sha: row.base_sha }
    : null;
  const config = c.config;
  const local = config.destinations.issues.provider === 'local';
  const issueRef = local ? await c.store.read(`issues/local/${issue}.json`)
    : await c.forge.observeIssue(config.destinations.issues, issue);
  requireThat(issueRef?.id === issue && text(issueRef.title) && typeof (issueRef.body ?? '') === 'string',
    'missing issue or issue identity mismatch');
  const issueState = String(issueRef.state ?? (local ? 'open' : 'unknown')).toUpperCase();
  requireThat(['OPEN', 'OPENED', 'CLOSED'].includes(issueState), 'issue state unavailable');
  row.issue_sha256 = c.store.digest({ id: issue, title: issueRef.title, body: issueRef.body ?? '' });
  row.contract_sha256 = entry.contract ?? null;
  const implementation = await readFact(c, issue, entry.implementation);
  const ocr = await readFact(c, issue, entry.ocr);
  if (ocr && bound(ocr, row)) {
    row.ocr = { status: ocr.status, receipt_ref: `.askill/${factPath(row.lane_id, issue, entry.ocr)}` };
  }
  const reviews = [];
  for (const axis of AXES) {
    if (!entry.reviews[axis]) { continue; }
    const review = await readFact(c, issue, entry.reviews[axis]);
    requireThat(review.axis === axis && review.implementation_sha256 === entry.implementation
      && id(review.reviewer) && text(review.evidence) && ['block', 'pass', 'needs-evidence'].includes(review.verdict)
      && review.reviewer.toLowerCase() !== implementation.implementer.toLowerCase()
      && reviews.every((r) => r.reviewer.toLowerCase() !== review.reviewer.toLowerCase()), 'invalid independent reviewer evidence');
    reviews.push(review);
  }
  const pr = config.destinations.pull_requests ? normalizePR(await c.forge.observePR(config.destinations.pull_requests,
    { base: c.plan.base_branch, branch: row.branch, head: row.head_sha ?? row.base_sha }), row, c.plan.base_branch) : null;
  const dependencyDetails = [];
  for (const [upstream, observed] of deps) {
    if (observed.plan.action === 'observation-failed') { throw new Error(`dependency observation failed: ${upstream}`); }
    const isMerged = observed.pr?.state === 'MERGED' && ['merged-pr', 'merged-pr-cleanup-host-handoff'].includes(observed.plan.reason);
    const isVerified = !config.destinations.pull_requests && observed.plan.reason === 'verified-local-head';
    const closed = observed.issueState === 'CLOSED' && !observed.pr;
    if ((!local && observed.issueState !== 'CLOSED') || !(isMerged || isVerified || closed)) {
      dependencyDetails.push({ issue: upstream, reason: 'prerequisite-not-terminal' });
      continue;
    }
    const integrated = required(observed);
    if (integrated && !await containsCommit(c, row.base_sha, integrated)) {
      dependencyDetails.push({ issue: upstream, reason: 'prerequisite-not-in-base', required_commit: integrated });
    } else if (!integrated && local) {
      dependencyDetails.push({ issue: upstream, reason: 'prerequisite-integration-unobserved' });
    }
  }
  return { root: c.root, row, entry, issueRef, issueState, config, grants: c.plan.authority_scope,
    contract, implementation, reviews, pr, dependencyDetails, unmet: dependencyDetails.map((d) => d.issue) };
}

function planner(c) {
  const cache = new Map();
  async function one(issue) {
    requireThat(id(issue) && c.plan.confirmed_issues.includes(issue), 'issue is not a lane member');
    if (cache.has(issue)) { return cache.get(issue); }
    const deps = [];
    for (const d of c.plan.dependency_graph[issue]) { deps.push([d, await one(d)]); }
    let ob;
    try { ob = await observe(c, issue, deps); }
    catch (err) { ob = { row: { lane_id: c.plan.lane_id, issue }, error: err.message }; }
    ob.plan = decide(ob);
    cache.set(issue, ob);
    return ob;
  }
  return one;
}

function expectAction(ob, actions) {
  requireThat(actions.includes(ob.plan.action),
    `action not admitted: current action is ${ob.plan.action} (${ob.plan.reason ?? 'no reason'})`);
}

function failAttempt(c, entry, phase, reason) {
  const attempts = (entry.attempts[phase] ?? 0) + 1;
  entry.attempts[phase] = attempts;
  if (attempts >= c.plan.retry_policy.attempt_ceiling) {
    entry.blocker = { type: 'attempts-exhausted', phase, attempts, reason };
  }
}

async function record(c, ob, a) {
  const { row, entry } = ob;
  const binding = bindingOf(row);
  const fact = (value) => saveFact(c, row.issue, value);
  requireThat(!ob.error, `observation failed: ${ob.error}`);
  switch (a.kind) {
    case 'preflight': {
      expectAction(ob, ['preflight']);
      requireThat(contractValid(a.contract, row), 'invalid preflight contract or stale issue/base binding');
      const hash = await fact(a.contract);
      requireThat(hash !== entry.contract, 'preflight must resolve the stale scope or base');
      entry.contract = hash;
      delete entry.implementation;
      entry.reviews = {};
      delete entry.ocr;
      entry.attempts.preflight = 0;
      break;
    }
    case 'implementation': {
      expectAction(ob, ['record-implementation']);
      requireThat(bound(a, row) && id(a.implementer) && matchingChecks(a.checks, ob.contract),
        'invalid implementation identity, stale binding, or missing criterion checks');
      entry.implementation = await fact({ ...binding, implementer: a.implementer, checks: a.checks });
      entry.reviews = {};
      delete entry.ocr;
      entry.attempts.implement = 0;
      if (hasDefect(a.checks)) { failAttempt(c, entry, 'fix-back', 'checks-failed'); }
      else if (a.checks.some((r) => r.exit_code !== 0)) {
        failAttempt(c, entry, 'record-implementation', 'missing-verification-evidence');
      } else { entry.attempts['record-implementation'] = 0; }
      break;
    }
    case 'review': {
      expectAction(ob, ['review']);
      requireThat(bound(a, row) && AXES.includes(a.axis) && id(a.reviewer) && text(a.evidence)
        && ['pass', 'needs-evidence', 'block'].includes(a.verdict), 'invalid review evidence or stale binding');
      requireThat(ob.plan.assignments.some((assignment) => assignment.axis === a.axis), 'axis already has an accepted PASS');
      const otherIdentities = [ob.implementation.implementer, ...ob.reviews.filter(
        (r) => bound(r, row) && r.axis !== a.axis).map((r) => r.reviewer)];
      requireThat(!otherIdentities.some((v) => v.toLowerCase() === a.reviewer.toLowerCase()),
        'each axis requires an independent reviewer distinct from the implementer');
      entry.reviews[a.axis] = await fact({ ...binding, axis: a.axis, reviewer: a.reviewer,
        verdict: a.verdict, evidence: a.evidence, implementation_sha256: entry.implementation });
      if (a.verdict === 'block') { failAttempt(c, entry, 'fix-back', 'review-block'); }
      if (a.verdict === 'needs-evidence') { failAttempt(c, entry, 'review', 'needs-evidence'); }
      if (a.verdict === 'pass' && ob.plan.assignments.length === 1) {
        entry.attempts.review = 0;
        entry.attempts['fix-back'] = 0;
      }
      break;
    }
    case 'failure': {
      expectAction(ob, ['implement', 'preflight', 'record-implementation', 'review', 'fix-back',
        'create-pr', 'push', 'resolve-conflict', 'prepare-worktree']);
      requireThat(a.phase === ob.plan.action && text(a.reason) && bound(a, row), 'stale or malformed failure report');
      failAttempt(c, entry, a.phase, a.reason);
      entry.last_failure = await fact({ ...binding, phase: a.phase, reason: a.reason });
      break;
    }
    case 'resume': {
      requireThat(entry.blocker?.type === 'attempts-exhausted' && a.phase === entry.blocker.phase && text(a.reason)
        && bound(a, row), 'resume requires current binding, exhausted phase and operator reason');
      entry.last_resume = await fact({ ...binding, phase: a.phase, reason: a.reason, previous_blocker: entry.blocker });
      entry.attempts[a.phase] = 0;
      delete entry.blocker;
      break;
    }
    case 'scope-drift': {
      expectAction(ob, ['implement', 'record-implementation', 'review', 'fix-back']);
      requireThat(bound(a, row) && text(a.reason), 'scope drift requires current binding and reason');
      entry.scope_drift = await fact({ ...binding, reason: a.reason });
      delete entry.contract;
      delete entry.implementation;
      entry.reviews = {};
      delete entry.ocr;
      break;
    }
    default: throw new Error(`unsupported record kind: ${a.kind}`);
  }
  await c.store.write(statePath(row.lane_id), c.state);
  return (await planner(c)(row.issue)).plan;
}

async function recordOCR(c, ob, a) {
  const row = ob.row;
  for (const key of ['authorized', 'background']) {
    requireThat(!Object.hasOwn(a, key) || typeof a[key] === 'boolean', `OCR ${key} must be boolean`);
  }
  expectAction(ob, ['review', 'done', 'create-pr', 'push', 'wait-ci', 'wait-mergeability', 'request-merge-approval', 'merge', 'blocked']);
  requireThat(!ob.entry.blocker && row.present && !row.dirty && contractValid(ob.contract, row)
    && bound(ob.implementation, row) && matchingChecks(ob.implementation.checks, ob.contract)
    && ob.implementation.checks.every((q) => q.exit_code === 0) && bound(a, row), 'OCR requires current review binding');
  const receipt = await c.forge.runOCR({ cwd: row.worktree, base: row.base_sha, head: row.head_sha,
    authorized: c.config.policy?.ocr_external === true && a.authorized === true, background: a.background === true });
  requireThat(receipt?.head === row.head_sha && receipt?.base === row.base_sha
    && ['completed', 'skipped-uninstalled', 'skipped-not-authorized', 'failed'].includes(receipt.status), 'invalid OCR receipt');
  const after = await planner(c)(row.issue);
  requireThat(!after.error && bound(after.row, row) && !after.row.dirty && contractValid(ob.contract, after.row), 'binding changed during OCR');
  const result = { ...bindingOf(row), ...receipt };
  ob.entry.ocr = await saveFact(c, row.issue, result);
  await c.store.write(statePath(row.lane_id), c.state);
  return result;
}

async function publish(c, ob, a) {
  expectAction(ob, ['create-pr', 'push']);
  const row = ob.row;
  requireThat(bound(a, row), 'publish-pr requires the current reviewed binding');
  const pr = normalizePR(await c.forge.publishPR(c.config.destinations.pull_requests, {
    root: c.root, worktree: row.worktree, branch: row.branch, base: c.plan.base_branch, head: row.head_sha,
    title: ob.issueRef.title, body: `Issue: ${ob.issueRef.url ?? row.issue}\nLane: ${row.lane_id}`,
    allowPush: c.plan.authority_scope.push, allowCreate: ob.plan.action === 'create-pr' && c.plan.authority_scope.pr_create,
  }), row, c.plan.base_branch);
  requireThat(pr?.state === 'OPEN' && pr.head === row.head_sha, 'publication not confirmed at the reviewed head');
  const after = await planner(c)(row.issue);
  requireThat(after.pr?.id === pr.id && after.pr.head === row.head_sha && bound(after.row, row), 'PR changed during publication');
  ob.entry.publication = await saveFact(c, row.issue, { ...bindingOf(row), pr });
  ob.entry.attempts[ob.plan.action] = 0;
  await c.store.write(statePath(row.lane_id), c.state);
  return after.plan;
}

/** All evidence writers are called under the coordinator's repository lock. */
export async function engine(command, context, args) {
  requireThat(isObject(args), 'command input must be a JSON object');
  const c = await load(context, args.lane_id, command === 'import-lane');
  if (command === 'import-lane') { return c.state; }
  const one = planner(c);
  if (['retro-note', 'retro-plan', 'record-retro'].includes(command)) {
    return retro(command, c, args, async () => {
      const observations = [];
      for (const issue of c.plan.confirmed_issues) { observations.push(await one(issue)); }
      return observations;
    });
  }
  if (command === 'plan-all') {
    const rows = [];
    for (const issue of c.plan.confirmed_issues) { rows.push((await one(issue)).plan); }
    return rows;
  }
  const ob = await one(args.issue);
  switch (command) {
    case 'plan': return ob.plan;
    case 'record': return record(c, ob, args);
    case 'run-ocr': return recordOCR(c, ob, args);
    case 'publish-pr': return publish(c, ob, args);
    default: throw new Error(`unknown engine command: ${command}`);
  }
}
