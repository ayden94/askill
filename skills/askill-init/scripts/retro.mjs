const kinds = ['follow-up-issue', 'convention-change'];
const text = (value) => typeof value === 'string' && value.trim().length > 0;

function recommendation(value) {
  if (!kinds.includes(value?.kind) || !text(value.title) || !text(value.evidence) || !text(value.next_step)) {
    throw new TypeError('Each recommendation needs a valid kind, title, evidence, and next_step');
  }
  return { kind: value.kind, title: value.title, evidence: value.evidence, next_step: value.next_step };
}

export async function retro(command, { store, plan, state }, args, observeAll) {
  const lane_id = plan.lane_id;
  const root = `lanes/${lane_id}`;
  const reportPath = `${root}/retro.json`;
  const notesPath = `${root}/retro-notes.json`;
  const report = await store.read(reportPath);
  if (report) {
    if (command === 'retro-plan') {
      return { action: 'done', report };
    }
    if (command === 'record-retro' && args.basis_sha256 === report.basis_sha256
      && args.summary === report.summary && Array.isArray(args.recommendations)
      && store.digest(args.recommendations.map(recommendation)) === store.digest(report.recommendations)) {
      return { action: 'done', report };
    }
    throw new TypeError('A retrospective is already recorded for this lane');
  }

  const notes = (await store.read(notesPath)) ?? [];
  if (command === 'retro-note') {
    if (args.issue !== undefined && !plan.confirmed_issues.includes(args.issue)) {
      throw new TypeError('A retrospective note must refer to a lane issue or the lane as a whole');
    }
    const candidate = { issue: args.issue ?? null, ...recommendation(args) };
    const note_sha256 = store.digest(candidate);
    if (!notes.some((note) => note.note_sha256 === note_sha256)) {
      await store.write(notesPath, [...notes, { ...candidate, note_sha256 }]);
    }
    return { lane_id, note_sha256 };
  }

  const observations = await observeAll();
  const pending = observations.filter(({ plan: row }) => row.action !== 'done')
    .map(({ plan: row }) => ({ issue: row.issue, action: row.action, reason: row.reason }));
  if (pending.length) {
    if (command === 'retro-plan') {
      return { action: 'wait-lane', lane_id, pending };
    }
    throw new TypeError('A retrospective can only be recorded after all lane issues are done');
  }

  const outcomes = observations.map(({ plan: row, issueRef, entry, pr }) => ({
    issue: row.issue,
    reason: row.reason,
    head_sha: pr?.head ?? row.head_sha,
    issue_url: issueRef?.url ?? null,
    pr_url: pr?.url ?? null,
    evidence: Object.entries({
      contract: entry.contract, implementation: entry.implementation,
      ...entry.reviews, ocr: entry.ocr, last_failure: entry.last_failure, scope_drift: entry.scope_drift,
    }).filter(([, hash]) => hash).map(([kind, hash]) => ({
      kind, path: `.askill/work/${lane_id}/${row.issue}/${hash}.json`,
    })),
  }));
  const basis_sha256 = store.digest({ plan_sha256: state.plan_sha256, outcomes, notes });
  if (command === 'retro-plan') {
    return { action: 'retro', lane_id, basis_sha256, outcomes, notes };
  }
  if (args.basis_sha256 !== basis_sha256 || !text(args.summary) || !Array.isArray(args.recommendations)) {
    throw new TypeError('Use the current retrospective basis and supply a summary and recommendations');
  }
  const recorded = {
    version: 1, lane_id, basis_sha256, outcomes, summary: args.summary,
    recommendations: args.recommendations.map(recommendation),
  };
  await store.create(reportPath, recorded);
  return { action: 'done', report: recorded };
}
