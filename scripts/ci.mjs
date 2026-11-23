// The checks on GitHub's computers (.github/workflows/test.yml), from here:
//   node scripts/ci.mjs status        what the latest run is doing, and about how long is left
//   node scripts/ci.mjs watch         the same every 30 seconds, until it is over
//   node scripts/ci.mjs run [bots]    start a run by hand, with bots: all (default), none, or names
//   node scripts/ci.mjs log <part>    the end of what one part of the latest run printed, e.g. log server
//   node scripts/ci.mjs photos [part] the bot photos and test pictures it kept, into ci-output/
// The time left is guessed from how long each part took the last time it passed.
// Needs a GitHub login: GITHUB_TOKEN, or `gh auth login`, or the login git already uses for pushing.
import { execFileSync, spawnSync } from 'node:child_process';

const git = process.platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : 'git';
const remote = execFileSync(git, ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
const repo = /github\.com[/:](.+?)(\.git)?$/.exec(remote)?.[1];
if (!repo) throw new Error('origin is not a GitHub repository: ' + remote);

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const gh = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
  if (gh.status === 0 && gh.stdout.trim()) return gh.stdout.trim();
  // The login git already has for github.com (Git Credential Manager on Windows).
  const cred = spawnSync(git, ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
  const pass = /^password=(.*)$/m.exec(cred.stdout ?? '')?.[1];
  if (pass) return pass;
  throw new Error('No GitHub login found: run `gh auth login`, or set GITHUB_TOKEN.');
}
const auth = token();
const api = async (path, init = {}) => {
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${auth}`, Accept: 'application/vnd.github+json', 'User-Agent': 'bazisaz-ci', ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`GitHub said ${r.status} to ${path}: ${(await r.text()).slice(0, 300)}`);
  return r.status === 204 ? null : r.json();
};
const minutes = (ms) => (ms < 60000 ? `${Math.max(0, Math.round(ms / 1000))} s` : `${Math.round(ms / 60000)} min`);
const took = (j) => (j.started_at && j.completed_at ? new Date(j.completed_at) - new Date(j.started_at) : 0);

/** How long each job took in the most recent runs where it passed. */
async function usual(skipId) {
  const runs = (await api('/actions/workflows/test.yml/runs?per_page=10')).workflow_runs.filter((r) => r.id !== skipId);
  const times = new Map();
  for (const run of runs) {
    for (const j of (await api(`/actions/runs/${run.id}/jobs?per_page=100`)).jobs) {
      if (j.conclusion === 'success' && !times.has(j.name)) times.set(j.name, took(j));
    }
  }
  return times;
}

async function status() {
  const run = (await api('/actions/workflows/test.yml/runs?per_page=1')).workflow_runs[0];
  if (!run) { console.log('No run yet.'); return true; }
  const jobs = (await api(`/actions/runs/${run.id}/jobs?per_page=100`)).jobs;
  const before = await usual(run.id);
  const now = Date.now();
  const started = new Date(run.run_started_at ?? run.created_at);
  console.log(`Run ${run.run_number} (${run.event}, ${run.head_commit?.message.split('\n')[0].slice(0, 60)}): ${run.status}${run.conclusion ? ' → ' + run.conclusion : ''}, ${minutes(now - started)} so far`);
  let left = 0;
  let unknown = 0;
  for (const j of jobs) {
    const usualTime = before.get(j.name);
    let line = `  ${j.conclusion === 'success' ? 'PASS' : j.conclusion === 'failure' ? 'FAIL' : j.conclusion ? j.conclusion.toUpperCase() : j.status === 'in_progress' ? 'RUN ' : 'WAIT'}  ${j.name}`;
    if (j.conclusion) line += `  (${minutes(took(j))})`;
    else if (j.status === 'in_progress') {
      const spent = now - new Date(j.started_at);
      line += `  ${minutes(spent)}` + (usualTime ? ` of about ${minutes(usualTime)}` : '');
      if (usualTime) left = Math.max(left, usualTime - spent); else unknown += 1;
    } else if (usualTime) left = Math.max(left, usualTime); else unknown += 1;
    console.log(line);
  }
  // Parts that wait for the build start only after it; bot jobs appear once the plan is made.
  if (run.status !== 'completed') {
    console.log(left > 0 || !unknown ? `About ${minutes(left)} left.` : 'No earlier run to guess from yet; the first run sets the times.');
  }
  return run.status === 'completed';
}

const [command = 'status', bots = 'all'] = process.argv.slice(2);
if (command === 'run') {
  await api('/actions/workflows/test.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { bots } }) });
  console.log(`Started a run with bots: ${bots}. Follow it with: node scripts/ci.mjs watch`);
} else if (command === 'log') {
  const run = (await api('/actions/workflows/test.yml/runs?per_page=1')).workflow_runs[0];
  const job = (await api(`/actions/runs/${run.id}/jobs?per_page=100`)).jobs.find((j) => j.name.includes(bots));
  if (!job) throw new Error('No part named like ' + bots);
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${job.id}/logs`, { headers: { Authorization: `Bearer ${auth}`, 'User-Agent': 'bazisaz-ci' } });
  const text = (await r.text()).split(/\r?\n/).map((l) => l.replace(/^\S+Z /, ''));
  console.log(text.slice(-Number(process.argv[4] ?? 60)).join('\n'));
} else if (command === 'photos') {
  // The bot photos and test pictures the latest run kept, into ci-output/<part>/ (unzipped).
  const run = (await api('/actions/workflows/test.yml/runs?per_page=1')).workflow_runs[0];
  const { artifacts } = await api(`/actions/runs/${run.id}/artifacts?per_page=100`);
  const { mkdirSync, writeFileSync } = await import('node:fs');
  for (const a of artifacts.filter((x) => x.name !== 'built' && (bots === 'all' || x.name.includes(bots)))) {
    const r = await fetch(a.archive_download_url, { headers: { Authorization: `Bearer ${auth}`, 'User-Agent': 'bazisaz-ci' } });
    mkdirSync('ci-output', { recursive: true });
    const zip = `ci-output/${a.name}.zip`;
    writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
    mkdirSync(`ci-output/${a.name}`, { recursive: true });
    spawnSync(process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar', ['-xf', zip, '-C', `ci-output/${a.name}`]);
    console.log(`ci-output/${a.name}/`);
  }
} else if (command === 'watch') {
  while (!(await status())) await new Promise((r) => setTimeout(r, 30000));
} else {
  await status();
}
