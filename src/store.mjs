import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync, linkSync, lstatSync, mkdirSync, readFileSync, realpathSync,
  renameSync, rmdirSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

export class StoreError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'StoreError';
  }
}

function statOrNull(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function directory(path, create) {
  if (create) {
    try {
      mkdirSync(path, { mode: 0o700 });
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  const status = statOrNull(path);
  if (status === null) {
    return false;
  }
  if (!status.isDirectory()) {
    throw new StoreError(`Expected a real directory: ${path}`);
  }
  return true;
}

function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

export function git(cwd, argv) {
  const gitEnvironment = { ...process.env };
  for (const name of [
    'GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_NAMESPACE',
  ]) {
    delete gitEnvironment[name];
  }
  try {
    return execFileSync('git', ['-C', cwd, ...argv], {
      encoding: 'utf8',
      env: { ...gitEnvironment, GIT_MASTER: '1', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      maxBuffer: 8 * 1024 * 1024,
    }).trimEnd();
  } catch (error) {
    throw new StoreError(`git ${argv[0]} failed: ${error?.stderr?.toString().trim() || error?.message}`, { cause: error });
  }
}

export function projectRoot(cwd) {
  const root = realpathSync(git(resolve(cwd), ['rev-parse', '--show-toplevel']));
  const common = realpathSync(resolve(root, git(root, ['rev-parse', '--git-common-dir'])));
  if (common !== join(root, '.git')) {
    const worktrees = git(root, ['worktree', 'list', '--porcelain', '-z']);
    const first = worktrees.split('\0')[0];
    if (!first.startsWith('worktree ')) {
      throw new StoreError('Cannot resolve the primary project worktree');
    }
    return realpathSync(first.slice('worktree '.length));
  }
  return root;
}

export function excludeRuntimeState(root) {
  const exclude = git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'info/exclude']);
  const status = statOrNull(exclude);
  if (status && !status.isFile()) {
    throw new StoreError(`Expected a regular Git exclude file: ${exclude}`);
  }
  const rules = '# askill runtime state\n/.askill/*\n!/.askill/config.json\n/.worktrees/\n';
  const existing = status ? readFileSync(exclude, 'utf8') : '';
  if (!existing.includes(rules)) {
    directory(resolve(exclude, '..'), true);
    appendFileSync(exclude, `\n${rules}`);
  }
}

export function openStore(root) {
  const stateRoot = join(root, '.askill');
  function stateFile(relativePath, create) {
    const parts = relativePath.split('/');
    if (parts.some((part) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/u.test(part))) {
      throw new StoreError(`Invalid state path: ${relativePath}`);
    }
    let parent = stateRoot;
    if (!directory(parent, create)) {
      return null;
    }
    for (const part of parts.slice(0, -1)) {
      parent = join(parent, part);
      if (!directory(parent, create)) {
        return null;
      }
    }
    const target = join(parent, parts.at(-1));
    const existing = statOrNull(target);
    if (existing && !existing.isFile()) {
      throw new StoreError(`Expected a regular state file: ${relativePath}`);
    }
    return { parent, target, existing };
  }

  function publish(relativePath, value, replace) {
    const { parent, target } = stateFile(relativePath, true);
    const temporary = join(parent, `.pending-${randomUUID()}`);
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    if (replace) {
      try {
        renameSync(temporary, target);
      } catch (error) {
        unlinkSync(temporary);
        throw error;
      }
    } else {
      try {
        linkSync(temporary, target);
      } finally {
        unlinkSync(temporary);
      }
    }
    return value;
  }

  return {
    read(relativePath) {
      const location = stateFile(relativePath, false);
      return location?.existing ? JSON.parse(readFileSync(location.target, 'utf8')) : null;
    },
    write: (path, value) => publish(path, value, true),
    create: (path, value) => publish(path, value, false),
    digest,
    git,
    async transaction(operation) {
      directory(stateRoot, true);
      const lock = join(stateRoot, '.write-lock');
      try {
        mkdirSync(lock, { mode: 0o700 });
      } catch (error) {
        if (error?.code === 'EEXIST') {
          throw new StoreError('Project write lock is held. Inspect the active coordinator before recovering an abandoned lock.', { cause: error });
        }
        throw error;
      }
      try {
        return await operation();
      } finally {
        rmdirSync(lock);
      }
    },
  };
}
