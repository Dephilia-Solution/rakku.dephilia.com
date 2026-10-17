#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);
const rawInput = process.argv.slice(2);
const devOwner = rawInput.includes('--dev-owner');
const args = rawInput.filter(value => value !== '--dev-owner' && value !== '--routed');
const runner = resolve(root, 'packages/demo/e2e/routed.mjs');
const children = [];
const stop = new AbortController();
let cleaning = false;

function endpoint(value) {
  const url = new URL(value);
  assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
    'The controlled Next start wrapper requires loopback HTTP origins');
  assert.ok(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'Expected an origin without credentials or a path');
  return { origin: url.origin, host: url.hostname.replace(/^\[|\]$/g, ''), port: url.port || '80' };
}

function launch(label, command, argv, cwd, env, server = false, stdio = 'inherit') {
  const child = spawn(command, argv, { cwd, env, stdio });
  const record = { label, child, closed: new Promise((resolveClosed) => child.once('close', (code) => resolveClosed(code ?? 1))) };
  children.push(record);
  child.once('error', (error) => stop.abort(new Error(`${label}: ${error.message}`, { cause: error })));
  if (server) child.once('exit', (code, signal) => {
    if (!cleaning) stop.abort(new Error(`${label} exited during acceptance (code ${code}, signal ${signal})`));
  });
  return record;
}

async function interruptible(operation) {
  if (stop.signal.aborted) {
    void Promise.resolve(operation).catch(() => {});
    throw stop.signal.reason;
  }
  let handler;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      handler = () => reject(stop.signal.reason);
      stop.signal.addEventListener('abort', handler, { once: true });
    })]);
  } finally { stop.signal.removeEventListener('abort', handler); }
}

async function unusedPort(host, port) {
  await new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', (error) => reject(new Error(`Port ${host}:${port} is unavailable; use acceptance.mjs for servers already running.`, { cause: error })));
    probe.listen({ host, port: Number(port), exclusive: true }, () => probe.close(resolvePort));
  });
}

async function ready(origin, path) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    stop.signal.throwIfAborted();
    try {
      const response = await fetch(`${origin}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(2000) });
      await response.body?.cancel();
      if (response.status === 200) return;
    } catch { /* A server starting up may not be listening yet. */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Production server not ready after 30s: ${origin}${path}`);
}

async function cleanup() {
  cleaning = true;
  const failures = [];
  for (const { child, closed, label } of [...children].reverse()) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
    let timer;
    try {
      if (process.platform === 'win32') {
        // Restrict termination to this wrapper's own PID tree, including Next/Chromium descendants.
        await new Promise((resolveKill, reject) => {
          const kill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
          kill.once('error', reject);
          kill.once('close', resolveKill);
        });
      } else child.kill('SIGTERM');
      await Promise.race([closed, new Promise((_, reject) => {
        timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`Timed out stopping owned process: ${label}`)); }, 5000);
      })]);
    } catch (error) {
      child.kill('SIGKILL');
      failures.push(error);
    } finally { clearTimeout(timer); }
  }
  if (failures.length) throw new AggregateError(failures, 'Failed to stop owned acceptance processes');
}

async function main() {
  // Listing/help must never launch Next servers, read builds, or contact an application.
  if (args.some((arg) => ['--list', '--help', '-h'].includes(arg))) {
    if (args.includes('--list')) {
      const source = await readFile(resolve(root, 'packages/demo/e2e/routed.mjs'), 'utf8');
      for (const match of source.matchAll(/await check\('([^']+)'/g)) console.log(match[1]);
    } else {
      console.log('node packages/demo/e2e/run-production.mjs [--dev-owner] [--list] [--help]\nSee packages/demo/e2e/README.md for production prerequisites and environment variables.');
    }
    process.exitCode = 0;
    return;
  }
  const owner = endpoint(process.env.DEMO_OWNER_URL || 'http://localhost:3000');
  const pos = endpoint(process.env.DEMO_POS_URL || 'http://localhost:3001');
  assert.notEqual(owner.port, pos.port, 'The controlled Owner/POS servers require distinct ports');
  // Start only existing production builds. DB/provider transports use the previously supplied
  // blocked endpoints; this wrapper never runs build, login, smoke, or database commands.
  const env = { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_OWNER_URL: owner.origin, NEXT_PUBLIC_POS_URL: pos.origin,
    DATABASE_URL: 'postgresql://demo_blocked:demo_blocked@127.0.0.1:1/demo_blocked?connect_timeout=1',
    VESSEL_API_URL: 'http://127.0.0.1:1', VESSEL_API_KEY: 'demo-provider-blocked',
    ECHO_API_URL: 'http://127.0.0.1:1', ECHO_API_KEY: 'demo-provider-blocked',
    SILOS_API_URL: 'http://127.0.0.1:1', SILOS_API_KEY: 'demo-provider-blocked',
    DEMO_OWNER_URL: owner.origin, DEMO_POS_URL: pos.origin };
  const apps = [['owner', owner], ['pos', pos]];
  const builds = [];
  for (const [app, address] of apps) {
    const cwd = resolve(root, `apps/${app}`);
    const buildPath = resolve(cwd, '.next/BUILD_ID');
    const development = devOwner && app === 'owner';
    const buildID = development ? null : (await readFile(buildPath, 'utf8')).trim();
    assert.ok(development || buildID, `Missing completed production build for ${app}`);
    builds.push({ app, buildPath, buildID, development, cwd, cli: require.resolve('next/dist/bin/next', { paths: [cwd] }), address });
    for (const host of address.host === 'localhost' ? ['127.0.0.1', '::1'] : [address.host]) await unusedPort(host, address.port);
  }
  for (const { app, cli, cwd, address, development } of builds) {
    launch(`${app} Next ${development ? 'development' : 'production'}`, process.execPath, [cli, development ? 'dev' : 'start', '-H', address.host, '-p', address.port], cwd, { ...env, NODE_ENV: development ? 'development' : 'production' }, true);
  }
  await interruptible(Promise.all([ready(owner.origin, '/demo'), ready(pos.origin, '/login')]));
  for (const { app, buildPath, buildID } of builds) {
    if (buildID === null) continue;
    assert.equal((await readFile(buildPath, 'utf8')).trim(), buildID, `${app} build changed during startup; wait for main's build to finish`);
  }
  const test = launch('production acceptance', process.execPath, [runner, ...args], root, env);
  process.exitCode = await interruptible(test.closed);
  for (const { app, buildPath, buildID } of builds) {
    if (buildID === null) continue;
    assert.equal((await readFile(buildPath, 'utf8')).trim(), buildID, `${app} build changed during acceptance; this run is invalid`);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop.abort(new Error(`Interrupted by ${signal}`)));
try {
  await main();
} catch (error) {
  console.error(error.stack ?? error);
  process.exitCode = 1;
} finally {
  try { await cleanup(); } catch (error) { console.error(error.stack ?? error); process.exitCode = 1; }
}
