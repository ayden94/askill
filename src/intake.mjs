const AUTHORITY_KEYS = ['local_commit', 'push', 'pr_create', 'pr_merge', 'cleanup_command_worktrees'];
const DESTINATION_KEYS = ['issues', 'pull_requests', 'tickets'];
const CONFIG_PATH = 'config.json';

function requireThat(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function record(input, keys, label) {
  requireThat(input !== null && typeof input === 'object' && !Array.isArray(input), `${label} must be an object`);
  requireThat(keys === null || Object.keys(input).every((key) => keys.includes(key)), `${label} has unsupported fields`);
  return input;
}

function safeId(id, label) {
  requireThat(typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id)
    && !id.includes('..') && !/(?:\.|\.lock)$/iu.test(id)
    && !Object.hasOwn(Object.prototype, id), `${label} must be a safe string ID`);
  return id;
}

function nonblank(text, label) {
  requireThat(typeof text === 'string' && text.trim().length > 0, `${label} must be nonblank text`);
  return text;
}

function grants(input, keys, label) {
  const supplied = record(input, keys, label);
  for (const grant of Object.values(supplied)) {
    requireThat(typeof grant === 'boolean', `${label} grants must be boolean`);
  }
  return Object.fromEntries(keys.map((key) => [key, Object.hasOwn(supplied, key) && supplied[key] === true]));
}

function option(input, key, fallback) {
  return Object.hasOwn(input, key) ? input[key] : fallback;
}

function destination(input, name) {
  if (input === null && name !== 'issues') {
    return;
  }
  const includesRemote = name === 'pull_requests';
  record(input, ['provider', 'repository', ...(includesRemote ? ['remote'] : [])], `destinations.${name}`);
  if (input.provider === 'local' && name !== 'pull_requests') {
    requireThat(Object.keys(input).length === 1, `local ${name} cannot name a remote repository`);
    return;
  }
  const segments = typeof input.repository === 'string' ? input.repository.split('/') : [];
  requireThat((input.provider === 'github' && segments.length === 2)
    || (input.provider === 'gitlab' && segments.length >= 2), `destinations.${name} must name a supported repository`);
  for (const segment of segments) {
    safeId(segment, `destinations.${name}.repository segment`);
  }
  if (Object.hasOwn(input, 'remote')) {
    safeId(input.remote, 'destinations.pull_requests.remote');
  }
}

function validateConfig(config) {
  record(config, ['version', 'base_branch', 'destinations', 'policy'], 'config');
  requireThat(config.version === 1, 'config.version must be 1');
  const base = nonblank(config.base_branch, 'config.base_branch');
  requireThat(!base.startsWith('-') && base !== 'HEAD', 'config.base_branch must be a named branch');
  record(config.destinations, DESTINATION_KEYS, 'destinations');
  for (const name of DESTINATION_KEYS) {
    destination(config.destinations[name], name);
  }
  if (Object.hasOwn(config, 'policy')) {
    record(config.policy, ['ocr_external'], 'config.policy');
    if (Object.hasOwn(config.policy, 'ocr_external')) {
      requireThat(typeof config.policy.ocr_external === 'boolean', 'config.policy.ocr_external must be boolean');
    }
  }
  return config;
}

async function init({ root, store }, args) {
  const existing = await store.read(CONFIG_PATH);
  if (Object.keys(args).length === 0 && existing !== null) {
    return validateConfig(existing);
  }
  const config = validateConfig(Object.hasOwn(args, 'config') ? record(args, ['config'], 'init args').config : args);
  if (existing !== null) {
    requireThat(store.digest(existing) === store.digest(config), 'config already exists and differs; review changes before replacing it');
    return existing;
  }
  await store.git(root, ['check-ref-format', `refs/heads/${config.base_branch}`]);
  await store.create(CONFIG_PATH, config);
  return config;
}

function validateDrafts(input) {
  requireThat(Array.isArray(input), 'drafts must be an array');
  const drafts = input.map((draft, index) => {
    record(draft, ['draft_id', 'title', 'body'], 'draft');
    const body = option(draft, 'body', '');
    requireThat(typeof body === 'string', 'draft.body must be text');
    return {
      draft_id: safeId(option(draft, 'draft_id', `draft-${index + 1}`), 'draft.draft_id'),
      title: nonblank(draft.title, 'draft.title'),
      body,
    };
  });
  requireThat(new Set(drafts.map((draft) => draft.draft_id)).size === drafts.length, 'draft IDs must be unique');
  return drafts;
}

async function publish(store, path, candidate) {
  const persisted = await store.read(path);
  if (persisted !== null) {
    requireThat(store.digest(persisted) === store.digest(candidate), `${path} already exists and differs`);
    return persisted;
  }
  await store.create(path, candidate);
  return candidate;
}

async function scope(store, args, configSha) {
  record(args, ['intake_id', 'problem', 'exclusions', 'drafts', 'approval_scope'], 'scope args');
  const intakeId = safeId(args.intake_id, 'intake_id');
  const exclusions = option(args, 'exclusions', []);
  requireThat(Array.isArray(exclusions), 'exclusions must be an array');
  return publish(store, `intakes/${intakeId}.json`, {
    version: 1,
    intake_id: intakeId,
    config_sha256: configSha,
    problem: nonblank(args.problem, 'problem'),
    exclusions: exclusions.map((exclusion) => nonblank(exclusion, 'exclusion')),
    drafts: validateDrafts(option(args, 'drafts', [])),
    approval_scope: grants(option(args, 'approval_scope', {}), ['issue_create'], 'approval_scope'),
  });
}

function issueIds(input, label) {
  requireThat(Array.isArray(input) && input.length > 0, `${label} must be a nonempty array`);
  const ids = input.map((id) => safeId(id, label));
  requireThat(new Set(ids.map((id) => id.toLowerCase())).size === ids.length, `${label} must not contain duplicates`);
  return ids;
}

function issueRef(observation, expectedId, issueDestination) {
  record(observation, null, 'issue observation');
  const id = safeId(observation.id, 'observed issue ID');
  requireThat(expectedId === undefined || id === expectedId, 'issue observation returned a different ID');
  if (issueDestination.provider !== 'local') {
    requireThat(/^[1-9][0-9]*$/u.test(id), 'remote issue ID must be a positive issue number string');
  }
  const url = issueDestination.provider === 'local' ? null : observation.url;
  requireThat(url === null && issueDestination.provider === 'local'
    || typeof url === 'string' && /^https?:\/\/\S+$/u.test(url), 'issue observation must include a valid URL');
  return { id, title: nonblank(observation.title, 'issue title'), url };
}

async function observeIssues({ store, forge }, issueDestination, ids) {
  const refs = [];
  for (const id of ids) {
    if (issueDestination.provider !== 'local') {
      requireThat(/^[1-9][0-9]*$/u.test(id), 'remote issue ID must be a positive issue number string');
    }
    const observation = issueDestination.provider === 'local'
      ? await store.read(`issues/local/${id}.json`)
      : await forge.observeIssue(issueDestination, id);
    requireThat(observation !== null && observation !== undefined, `could not resolve issue ${id}`);
    refs.push(issueRef(observation, id, issueDestination));
  }
  return refs;
}

async function registerDraft({ store, forge }, issueDestination, intakeId, draft) {
  const identity = store.digest({ intake_id: intakeId, draft_id: draft.draft_id });
  if (issueDestination.provider === 'local') {
    const id = `LOCAL-${identity}`;
    const localIssue = await publish(store, `issues/local/${id}.json`, { id, title: draft.title, body: draft.body, url: null });
    return issueRef(localIssue, id, issueDestination);
  }

  requireThat(typeof forge?.registerIssue === 'function', 'forge issue registration is unavailable');
  const path = `issues/registrations/${identity}.json`;
  const binding = store.digest({ destination: issueDestination, draft });
  const registration = await store.read(path);
  if (registration !== null) {
    requireThat(registration.binding_sha256 === binding, 'issue registration destination or draft differs from its recorded intent');
    requireThat(registration.issue, `registration outcome is uncertain for ${intakeId}/${draft.draft_id}; reconcile with the forge and link the existing issue ID`);
    return issueRef(registration.issue, undefined, issueDestination);
  }

  // Persist intent first: a lost response or interrupted success must never replay the write.
  await store.create(path, { version: 1, binding_sha256: binding, issue: null });
  let issue;
  try {
    issue = issueRef(await forge.registerIssue(issueDestination, draft), undefined, issueDestination);
    await store.write(path, { version: 1, binding_sha256: binding, issue });
  } catch (error) {
    throw new Error(`registration outcome is uncertain for ${intakeId}/${draft.draft_id}; reconcile with the forge before retrying`, { cause: error });
  }
  return issue;
}

function artifactRefs(artifact, artifactId, configSha, issueDestination) {
  requireThat(artifact !== null && artifact.version === 1 && artifact.artifact_id === artifactId, 'confirmed issue artifact missing or invalid');
  requireThat(artifact.config_sha256 === configSha, 'confirmed issue artifact configuration has drifted');
  requireThat(Array.isArray(artifact.issues), 'confirmed issue artifact must have an issue list');
  const refs = artifact.issues.map((issue) => issueRef(issue, undefined, issueDestination));
  issueIds(refs.map((issue) => issue.id), 'confirmed issue IDs');
  return refs;
}

async function issues(context, args, issueDestination, configSha, { refreshExisting = false } = {}) {
  const { store } = context;
  record(args, ['artifact_id', 'intake_id', 'issue_ids', 'authority_scope'], 'issues args');
  const artifactId = safeId(args.artifact_id, 'artifact_id');
  const usesIntake = Object.hasOwn(args, 'intake_id');
  requireThat(usesIntake !== Object.hasOwn(args, 'issue_ids'), 'choose exactly one of intake_id or issue_ids');
  const authority = grants(option(args, 'authority_scope', {}), ['issue_create'], 'authority_scope');
  const path = `issues/${artifactId}.json`;
  const intakeId = usesIntake ? safeId(args.intake_id, 'intake_id') : null;
  const ids = usesIntake ? null : issueIds(args.issue_ids, 'issue_ids');
  const source = usesIntake ? { intake_id: intakeId } : { issue_ids: ids };
  const existing = await store.read(path);
  if (existing !== null) {
    const refs = artifactRefs(existing, artifactId, configSha, issueDestination);
    requireThat(existing.source && store.digest(existing.source) === store.digest(source), 'confirmed issue artifact already exists with different input');
    if (refreshExisting) {
      await observeIssues(context, issueDestination, refs.map((issue) => issue.id));
    }
    return existing;
  }

  let refs;
  if (usesIntake) {
    const scoped = await store.read(`intakes/${intakeId}.json`);
    requireThat(scoped !== null && scoped.version === 1 && scoped.intake_id === intakeId, 'scope intake missing or invalid');
    requireThat(scoped.config_sha256 === configSha, 'scope intake configuration has drifted');
    const drafts = validateDrafts(scoped.drafts);
    requireThat(drafts.length > 0, 'scope intake has no drafts');
    if (issueDestination.provider !== 'local') {
      requireThat(scoped.approval_scope?.issue_create === true && authority.issue_create,
        'remote issue registration requires scope approval and an explicit issue_create grant');
    }
    refs = [];
    for (const draft of drafts) {
      refs.push(await registerDraft(context, issueDestination, intakeId, draft));
    }
  } else {
    refs = await observeIssues(context, issueDestination, ids);
  }
  issueIds(refs.map((issue) => issue.id), 'confirmed issue IDs');
  return publish(store, path, { version: 1, artifact_id: artifactId, config_sha256: configSha, source, issues: refs });
}

function dependencies(ids, graphArgs, reasons) {
  const graph = record(graphArgs, ids, 'dependency_graph');
  const outstanding = new Map();
  const dependents = new Map(ids.map((id) => [id, []]));
  const edges = new Map();
  const canonicalGraph = Object.fromEntries(ids.map((id) => {
    const prerequisites = option(graph, id, []);
    requireThat(Array.isArray(prerequisites), 'dependencies must be arrays of issue IDs');
    const pending = new Set(prerequisites);
    requireThat(pending.size === prerequisites.length && !pending.has(id), 'dependency graph contains a duplicate or self edge');
    for (const prerequisite of pending) {
      requireThat(dependents.has(prerequisite), 'dependency graph contains an issue outside the lane');
      dependents.get(prerequisite).push(id);
    }
    edges.set(id, pending);
    outstanding.set(id, pending.size);
    return [id, prerequisites];
  }));
  const ready = ids.filter((id) => outstanding.get(id) === 0);
  for (const id of ready) {
    for (const dependent of dependents.get(id)) {
      const remaining = outstanding.get(dependent) - 1;
      outstanding.set(dependent, remaining);
      if (remaining === 0) {
        ready.push(dependent);
      }
    }
  }
  requireThat(ready.length === ids.length, 'dependency graph contains a cycle');
  requireThat(Array.isArray(reasons), 'dependency_reasons must be an array');
  for (const entry of reasons) {
    record(entry, ['issue', 'depends_on', 'reason'], 'dependency reason');
    nonblank(entry.reason, 'dependency reason');
    requireThat(edges.get(entry.issue)?.delete(entry.depends_on), 'dependency reason must cover one graph edge exactly once');
  }
  requireThat([...edges.values()].every((pending) => pending.size === 0), 'every dependency edge needs a reason');
  return canonicalGraph;
}

async function createLane(context, args, config, configSha) {
  const { store } = context;
  record(args, ['lane_id', 'artifact_id', 'issue_ids', 'dependency_graph', 'dependency_reasons', 'retry_policy', 'authority_scope'], 'create-lane args');
  const laneId = safeId(args.lane_id, 'lane_id');
  const usesArtifact = Object.hasOwn(args, 'artifact_id');
  requireThat(usesArtifact !== Object.hasOwn(args, 'issue_ids'), 'choose exactly one of artifact_id or issue_ids');
  const authority = grants(option(args, 'authority_scope', {}), AUTHORITY_KEYS, 'authority_scope');
  requireThat(config.destinations.pull_requests !== null || !(authority.push || authority.pr_create || authority.pr_merge),
    'push, pr_create, and pr_merge grants require a configured pull request destination');
  const retry = record(option(args, 'retry_policy', { attempt_ceiling: 3 }), ['attempt_ceiling'], 'retry_policy');
  requireThat(Number.isSafeInteger(retry.attempt_ceiling) && retry.attempt_ceiling > 0, 'attempt_ceiling must be a positive safe integer');
  const issueDestination = config.destinations.issues;
  const artifactId = usesArtifact ? safeId(args.artifact_id, 'artifact_id') : laneId;
  const artifact = usesArtifact
    ? await store.read(`issues/${artifactId}.json`)
    : await issues(context, { artifact_id: artifactId, issue_ids: args.issue_ids }, issueDestination, configSha, { refreshExisting: true });
  const ids = artifactRefs(artifact, artifactId, configSha, issueDestination).map((issue) => issue.id);
  const reasons = option(args, 'dependency_reasons', []);
  const graph = dependencies(ids, option(args, 'dependency_graph', {}), reasons);
  if (usesArtifact) {
    await observeIssues(context, issueDestination, ids);
  }
  return publish(store, `lanes/${laneId}.json`, {
    version: 2,
    lane_id: laneId,
    base_branch: config.base_branch,
    config_sha256: configSha,
    source: { artifact_id: artifactId, sha256: store.digest(artifact) },
    confirmed_issues: ids,
    dependency_graph: graph,
    dependency_reasons: reasons,
    retry_policy: retry,
    authority_scope: authority,
  });
}

export async function intake(command, context, args) {
  record(args, null, `${command} args`);
  if (command === 'init') {
    return init(context, args);
  }
  const { store } = context;
  const savedConfig = await store.read(CONFIG_PATH);
  requireThat(savedConfig !== null, 'initialize askill before intake');
  const config = validateConfig(savedConfig);
  const configSha = store.digest(savedConfig);
  switch (command) {
    case 'scope':
      return scope(store, args, configSha);
    case 'issues':
      return issues(context, args, config.destinations.issues, configSha);
    case 'create-lane':
      return createLane(context, args, config, configSha);
    default:
      throw new Error(`unknown intake command: ${command}`);
  }
}
