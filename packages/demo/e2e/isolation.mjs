import assert from 'node:assert/strict';
import { eventually } from './browser.mjs';
import { driverSession } from './chrome.mjs';

const SENTINEL = 'rakku-merchant-acceptance-sentinel';
const VALUE = 'existing-merchant-state-must-survive';
const AUDIT_PREFIX = '__rakku_demo_acceptance_audit__:';

/** Browser instrumentation only: no application state, engine commands, or React internals. */
function installSpies({ origins, auditPrefix }) {
  // Playwright also initializes about:blank popups/print frames and opaque documents.
  // Only these locations are excluded; missing browser primitives on real HTTP pages must fail.
  if (!/^https?:$/.test(location.protocol) || location.origin === 'null' || globalThis.origin === 'null') return;
  const events = [];
  const created = [];
  const revoked = [];
  const lifecycle = [];
  const documentId = crypto.randomUUID();
  const debug = console.debug.bind(console);
  const nativeCacheOpen = CacheStorage.prototype.open;
  const readCaches = async () => {
    const result = [];
    for (const name of await caches.keys()) {
      const cache = await nativeCacheOpen.call(caches, name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (!response) continue; // A real worker's expiration plugin can evict during inspection.
        result.push({ cache: name, url: request.url, responseURL: response.url, redirected: response.redirected,
          contentType: response.headers.get('content-type'), body: /text|json/.test(response.headers.get('content-type') ?? '') ? await response.text() : '' });
      }
    }
    return result;
  };
  const spy = { documentId, events, created, revoked, lifecycle, readCaches, installed: false };
  Object.defineProperty(globalThis, '__acceptanceSpy', { value: spy });
  const emit = (type, detail) => {
    const event = { documentId, sequence: events.length + 1, type, detail, page: location.href, at: Date.now() };
    events.push(event);
    // A primitive console message is emitted synchronously to CDP. An exposed async binding
    // can lose its invocation when this realm is frozen/destroyed during pagehide.
    debug(`${auditPrefix}${JSON.stringify(event)}`);
  };
  const fail = (type, detail) => { emit(type, detail); throw new Error(`Acceptance isolation violation: ${type} ${detail}`); };
  const forbidden = (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? String(input), location.href);
    return /^https?:$/.test(url.protocol) && (!origins.includes(url.origin) || /^\/api(?:\/|$)/.test(url.pathname));
  };
  const fetch = globalThis.fetch;
  globalThis.fetch = function (input, options) {
    if (forbidden(input)) fail('fetch', String(input?.url ?? input));
    return fetch.call(this, input, options);
  };
  const openXHR = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (forbidden(url)) fail('xhr', `${method} ${url}`);
    return openXHR.call(this, method, url, ...rest);
  };
  const beacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = (url, data) => {
    if (forbidden(url)) fail('beacon', String(url));
    return beacon(url, data);
  };
  for (const method of ['setItem', 'removeItem', 'clear']) {
    Storage.prototype[method] = function (...args) { return fail(`storage.${method}`, JSON.stringify(args)); };
  }
  IDBFactory.prototype.open = function (...args) { return fail('indexedDB.open', String(args[0])); };
  IDBFactory.prototype.deleteDatabase = function (name) { return fail('indexedDB.deleteDatabase', name); };
  CacheStorage.prototype.open = function (name) { return fail('cache.open', name); };
  CacheStorage.prototype.delete = function (name) { return fail('cache.delete', name); };
  for (const method of ['put', 'add', 'addAll', 'delete']) {
    Cache.prototype[method] = function (...args) { return fail(`cache.${method}`, String(args[0])); };
  }
  const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(Document.prototype, 'cookie', {
    configurable: cookie.configurable, enumerable: cookie.enumerable, get: cookie.get,
    set(value) { fail('cookie.set', value); },
  });
  const create = URL.createObjectURL;
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    created.push(url); emit('blob.create', url); return url;
  };
  const revoke = URL.revokeObjectURL;
  URL.revokeObjectURL = function (url) {
    const result = revoke.call(this, url);
    revoked.push(url); emit('blob.revoke', url); return result;
  };
  for (const type of ['pageshow', 'pagehide', 'visibilitychange']) {
    addEventListener(type, (event) => {
      const record = { type, persisted: Boolean(event.persisted), visibility: document.visibilityState, trusted: event.isTrusted };
      lifecycle.push(record); emit('lifecycle', record);
    });
  }
  spy.installed = true;
}

export function allowedRequest(request, config) {
  const url = new URL(request.url());
  if (['data:', 'blob:', 'about:'].includes(url.protocol)) return true;
  if (url.pathname === '/_next/webpack-hmr' && [config.owner, config.pos].some(origin => url.origin === origin || url.origin === origin.replace(/^http/, 'ws'))) return true;
  // Existing global styles import Google Fonts; these are static visual assets,
  // never business/auth transports. No production provider origin is allowed.
  if (['GET', 'HEAD'].includes(request.method()) &&
      ((url.origin === 'https://fonts.googleapis.com' && /^\/css(?:2)?$/.test(url.pathname)) ||
       (url.origin === 'https://fonts.gstatic.com' &&
        (/^\/s\/[\w/-]+\.woff2?$/.test(url.pathname) || url.pathname === '/l/font')))) return true;
  if (![config.owner, config.pos].includes(url.origin)) return false;
  if (!['GET', 'HEAD'].includes(request.method()) || /^\/api(?:\/|$)/.test(url.pathname)) return false;
  if (/^\/(?:demo(?:\/menu\/(?:pusat|taman))?\/?|login\/?|~offline)$/.test(url.pathname)) return true;
  if (/^\/demo\/(?:owner|pos)(?:\/(?:dashboard|outlets|employees|settings|products|orders|reports|tax-discounts|tables|subscription|balance|register|ingredients|purchases|expenses|login)(?:\/[\w:%.-]+)*)?\/?$/.test(url.pathname)) return true;
  if (url.pathname.startsWith('/_next/static/')) return true;
  if (url.pathname === '/_next/image') {
    const image = url.searchParams.get('url');
    return Boolean(image && image.startsWith('/') && !image.startsWith('//') && !image.startsWith('/api'));
  }
  return /^\/(?:demo-assets|images|icons|fonts)\/[^?]+\.(?:svg|png|jpe?g|webp|ico|woff2?)$/.test(url.pathname)
    || /^\/(?:sw\.js|swe-worker-[\w-]+\.js|workbox-[\w-]+\.js|manifest(?:\.webmanifest|\.json)|favicon\.ico|icon\.png|apple-icon\.png)$/.test(url.pathname);
}

export async function createEnvironment(browser, config, { pwa = false, history = false } = {}) {
  const events = [], violations = [], errors = [], consoleMessages = [], requests = [], pages = [], observations = [];
  const observed = new Map(), auditSessions = new Map();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta',
    serviceWorkers: pwa ? 'allow' : 'block',
    storageState: {
      cookies: [],
      origins: [config.owner, config.pos].map((origin) => ({ origin, localStorage: [{ name: SENTINEL, value: VALUE }] })),
    },
  });
  await context.addCookies([config.owner, config.pos].map((origin, index) => (
    { name: `${SENTINEL}-${index}`, value: VALUE, url: origin, httpOnly: true, sameSite: 'Lax' }
  )));
  const baselineCookies = await context.cookies();
  const recordAudit = (text, transport) => {
    if (!text.startsWith(AUDIT_PREFIX)) return;
    try {
      const event = JSON.parse(text.slice(AUDIT_PREFIX.length));
      assert.equal(typeof event.documentId, 'string');
      assert.ok(Number.isInteger(event.sequence) && event.sequence > 0);
      const key = `${event.documentId}:${event.sequence}`;
      const previous = observed.get(key);
      if (previous) {
        // De-duplicate the same console record seen through two transports, not actual calls.
        // Two native revocations have different sequence numbers and still fail exact-once checks.
        if (!previous.observedBy.includes(transport)) previous.observedBy.push(transport);
        return;
      }
      const entry = { ...event, observedBy: [transport] };
      observed.set(key, entry); events.push(entry);
      if (!['blob.create', 'blob.revoke', 'lifecycle'].includes(event.type)) violations.push(`${event.type}: ${event.detail} (${event.page})`);
    } catch (error) { errors.push(`Invalid synchronous audit record: ${error.message}`); }
  };
  context.on('page', (page) => {
    pages.push(page);
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack ?? error.message} (${page.url()})`));
    auditSessions.set(page, (async () => {
      const driver = driverSession(page);
      const driverConsole = (message) => {
        if (message.type === 'debug' && typeof message.args[0]?.value === 'string') recordAudit(message.args[0].value, 'driver-console');
      };
      driver.on('Runtime.consoleAPICalled', driverConsole);
      page.once('close', () => driver.off('Runtime.consoleAPICalled', driverConsole));
      const session = await context.newCDPSession(page);
      // Read primitive CDP values without looking up handles in a destroyed execution context.
      session.on('Runtime.consoleAPICalled', (message) => {
        if (message.type === 'debug' && typeof message.args[0]?.value === 'string') recordAudit(message.args[0].value, 'cdp-console');
      });
      await session.send('Runtime.enable');
      return session;
    })().catch((error) => { errors.push(`Unable to attach page audit: ${error.message}`); return null; }));
  });
  context.on('console', (message) => {
    const source = message.page()?.url() || message.location().url || 'worker';
    consoleMessages.push({ type: message.type(), text: message.text(), page: source });
    if (message.type() === 'debug') recordAudit(message.text(), 'context-console');
    if (message.type() === 'error') errors.push(`console: ${message.text()} (${source})`);
  });
  context.on('request', (request) => {
    const allowed = allowedRequest(request, config);
    requests.push({ url: request.url(), method: request.method(), type: request.resourceType(), allowed,
      worker: Boolean(request.serviceWorker()) });
    if (!allowed) violations.push(`Forbidden browser/worker request: ${request.method()} ${request.url()}`);
  });
  context.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  if (!history) {
    await context.route('**/*', (route) => allowedRequest(route.request(), config) ? route.continue() : route.abort('blockedbyclient'));
  }
  // Seed a single merchant cache entry on each actual origin BEFORE installing write spies.
  // A real POS image document lets us seed its cache before /login registers/activates the SW.
  // Neither document is a substitute application or a fabricated demo harness.
  try {
    for (const origin of [config.owner, config.pos]) {
      const seed = await context.newPage();
      await auditSessions.get(seed);
      await seed.goto(`${origin}${origin === config.owner ? '/demo/menu/pusat' : '/images/rakku_logo.png'}`, { waitUntil: 'load' });
      await seed.evaluate(async ({ key, value }) => {
        const cache = await caches.open(key);
        await cache.put(new URL('/merchant-sentinel.txt', location.origin), new Response(value));
      }, { key: SENTINEL, value: VALUE });
      await seed.close();
    }
    await context.addInitScript(installSpies, { origins: [config.owner, config.pos], auditPrefix: AUDIT_PREFIX });
  } catch (error) {
    error.acceptanceDiagnostics = { events, violations, errors, console: consoleMessages, requests, observations };
    await context.close();
    throw error;
  }
  const env = {
    browser, context, config, events, violations, errors, consoleMessages, requests, pages, observations,
    async auditSession(page) { return auditSessions.get(page); },
    observe(label, value) { observations.push({ label, value }); },
    async snapshotSpy(page, label) {
      const snapshot = await page.evaluate(() => {
        const { documentId, installed, created, revoked, lifecycle, events } = globalThis.__acceptanceSpy;
        return { documentId, installed, created, revoked, lifecycle, events };
      });
      observations.push({ label, value: snapshot });
      return snapshot;
    },
    async retainOutgoingSpy(page) {
      const originalId = await page.evaluate(() => globalThis.__acceptanceSpy.documentId);
      const popup = context.waitForEvent('page');
      // Use an actual same-origin public menu document. It holds only our read-only audit
      // object, never the sandbox/app state; no storage, cache, network transport, or fake UI.
      await page.evaluate((url) => { window.open(url, '_blank'); }, `${config.owner}/demo/menu/pusat`);
      const inspector = await popup;
      // The popup event can arrive while its initial about:blank is already loaded.
      await inspector.waitForURL(`${config.owner}/demo/menu/pusat`, { waitUntil: 'domcontentloaded' });
      await auditSessions.get(inspector);
      observations.push({ label: 'refresh-observer-document', value: await inspector.evaluate(() => ({
        url: location.href, origin: globalThis.origin, locationOrigin: location.origin,
        secure: isSecureContext, cachePrimitive: typeof CacheStorage, opener: Boolean(window.opener),
        installed: globalThis.__acceptanceSpy?.installed,
      })) });
      // Programmatic popups can commit before Playwright attaches its init scripts. This
      // observer renders only the real static menu; install our probes before retaining data.
      if (!await inspector.evaluate(() => globalThis.__acceptanceSpy?.installed)) {
        await inspector.evaluate(installSpies, { origins: [config.owner, config.pos], auditPrefix: AUDIT_PREFIX });
      }
      assert.equal(await inspector.evaluate(() => globalThis.__acceptanceSpy?.installed), true);
      await inspector.evaluate(() => {
        Object.defineProperty(globalThis.__acceptanceSpy, 'outgoing', { value: window.opener.__acceptanceSpy });
      });
      assert.equal(await inspector.evaluate(() => globalThis.__acceptanceSpy.outgoing.documentId), originalId,
        'Observer holds the actual outgoing document audit, not a newly seeded realm');
      await page.bringToFront();
      return {
        async read(label) {
          const snapshot = await inspector.evaluate(() => {
            const { documentId, installed, created, revoked, lifecycle, events } = globalThis.__acceptanceSpy.outgoing;
            return { documentId, installed, created, revoked, lifecycle, events };
          });
          assert.equal(snapshot.documentId, originalId);
          observations.push({ label, value: snapshot });
          // These are the original synchronous spy records. Reconcile by document/sequence,
          // retaining exact-once counts even if Chrome discarded outgoing console messages.
          for (const event of snapshot.events) recordAudit(`${AUDIT_PREFIX}${JSON.stringify(event)}`, 'retained-realm');
          return snapshot;
        },
        async close() { await inspector.close(); },
      };
    },
    async page(url = `${config.owner}/demo`) {
      const page = await context.newPage();
      await auditSessions.get(page);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      assert.equal(await page.evaluate(() => globalThis.__acceptanceSpy?.installed), true, `Real HTTP page must be fully instrumented: ${page.url()}`);
      return page;
    },
    async assertSentinels() {
      assert.deepEqual(await context.cookies(), baselineCookies, 'Demo must preserve all seeded merchant cookies exactly');
      const storage = await context.storageState();
      for (const origin of [config.owner, config.pos]) {
        assert.deepEqual(storage.origins.find((entry) => entry.origin === origin)?.localStorage,
          [{ name: SENTINEL, value: VALUE }], `Merchant localStorage unchanged on ${origin}`);
        const inspector = await context.newPage();
        await auditSessions.get(inspector);
        // A read-only POS static document avoids invoking Serwist registration while this
        // non-PWA context deliberately blocks workers. The PWA suite loads real /login itself.
        await inspector.goto(`${origin}${origin === config.owner ? '/demo/menu/pusat' : '/images/rakku_logo.png'}`, { waitUntil: 'domcontentloaded' });
        // CacheStorage.match is read-only and will not recreate a deleted sentinel cache.
        assert.equal(await inspector.evaluate(async (key) => {
          const response = await caches.match(new URL('/merchant-sentinel.txt', location.origin), { cacheName: key });
          return response?.text();
        }, SENTINEL), VALUE, `Merchant cache sentinel unchanged on ${origin}`);
        await inspector.close();
      }
    },
    async assertClean() {
      await env.assertSentinels();
      // Cross-check live/restored realm-local records against the synchronous Node-side audit.
      for (const page of pages.filter((page) => !page.isClosed())) {
        if (/^https?:/.test(page.url())) {
          assert.equal(await page.evaluate(() => globalThis.__acceptanceSpy?.installed), true, `Real HTTP page must retain instrumentation: ${page.url()}`);
        }
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
        if (/^https?:/.test(page.url())) {
          const local = await page.evaluate(() => globalThis.__acceptanceSpy.events);
          for (const event of local) assert.ok(observed.has(`${event.documentId}:${event.sequence}`),
            `Audit transport lost a real browser event: ${JSON.stringify(event)}`);
        }
      }
      assert.deepEqual(violations, [], 'Production business network/storage isolation violations');
      assert.deepEqual(errors, [], 'Browser console/page errors or failed production resources');
    },
    diagnostics() { return { events, violations, errors, console: consoleMessages, requests, observations }; },
  };
  return env;
}

export async function inspectCaches(page) {
  return page.evaluate(() => globalThis.__acceptanceSpy.readCaches());
}

export async function assertOwnerNoWorker(page) {
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller), null, 'Owner must not be controlled by a worker');
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0, 'Owner must not register a worker');
}

export async function allBlobsRevoked(env, start = 0) {
  assert.ok(start >= 0, 'Blob creation must be observed before document replacement');
  await eventually(async () => {
    const events = env.events.slice(start);
    const creations = events.filter((event) => event.type === 'blob.create');
    assert.ok(creations.length, 'Expected an uploaded object URL in this lifecycle flow');
    for (const create of creations) {
      assert.equal(events.filter((event) => event.type === 'blob.revoke' && event.detail === create.detail).length, 1,
        `Object URL must be revoked exactly once: ${create.detail}`);
    }
  }, 'All session object URLs revoked');
}
