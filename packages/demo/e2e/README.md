# Routed demo browser verification

`routed.mjs` exercises the existing Owner/POS components at real Next routes
`/demo/owner/...` and `/demo/pos/...`. No substitute UI, engine globals, fake API
server, merchant login, shared database mutation, or source-state injection is used.

## Production

Requires Node 20+, Playwright from a local/external tools installation, and Chrome
or Chromium. Build Owner/POS with the corresponding localhost URLs before testing:

```powershell
$env:NEXT_PUBLIC_OWNER_URL = 'http://localhost:3000'
$env:NEXT_PUBLIC_POS_URL = 'http://localhost:3001'
pnpm build --concurrency=1
$env:PLAYWRIGHT_MODULE_PATH = '<tools-directory>\node_modules'
$env:DEMO_E2E_BROWSER_CHANNEL = 'chrome'
pnpm test:demo:browser
```

The default command calls `run-production.mjs --routed`. It owns/cleans its Next
processes, rejects busy ports rather than stopping another user's server, checks
completed build IDs, and blocks database/provider transport configuration. Set
`DEMO_OWNER_URL`/`DEMO_POS_URL` for alternative distinct loopback ports.

Against already-running servers:

```powershell
node packages/demo/e2e/routed.mjs
```

## Development and StrictMode

```powershell
node packages/demo/e2e/run-production.mjs --routed --dev-owner
```

This starts Owner in Next development and POS from its completed production build.
It verifies the same workflows under StrictMode and permits only the local Next
HMR endpoint in addition to the production static/public route policy. Running
development writes Owner's `.next` output; build again before a production run.

## Coverage

| Suite | Assertions |
|---|---|
| `owner-routes-sidebar-state` | Direct nested URL, 256/64 px sidebar/content geometry, logo expansion, portal form create, page/back/forward navigation preserves mutations, independent tab fixture, reset clears data, compact demo marker |
| `pos-auth-sidebar-navigation` | Actual outlet/account/PIN steps, 240/64 px geometry, original product-add route, current menu styling, ingredient data, switch-user route, different outlet/account |
| `pos-sale-shared-owner-data` | Cart survives page navigation, real payment/receipt components, two cafe drinks deduct exact coffee stock, order visible through Owner route, logout removes order |
| `mobile-sidebar-lazy-route-bundles` | Dashboard does not eagerly request feature-page JS chunks; Owner bottom nav/more sheet closes after selection, 390 px layout, refresh and merchant sentinels |
| `pos-mobile-menu-and-breakpoints` | POS phone bottom menu, ingredient navigation, no document overflow, 767/768 px nav boundary and sidebar/content alignment |

`isolation.mjs` installs throwing spies for business fetch/XHR/beacon, persistent
storage writes, cookie writes, IndexedDB, and Cache Storage. Request observers
allow only real demo routes, local app/static assets and existing static font
resources. Cookie/localStorage/cache merchant sentinels must survive every suite.
Errors, blocked requests, storage writes and console/page errors fail verification.

JSON diagnostics, screenshots and a summary are written under a unique temporary
`opencode/rakku-routed-demo-*` directory, not the workspace or application storage.

Domain/adapter contracts remain covered by `pnpm test:demo`; original database
regression tests use PGlite through `pnpm test:db`. The standalone acceptance
harness and its findings are not part of the current repository; `routed.mjs` is
the only active browser suite for the current UI.

## Sidebar badge regression guard

`pos-auth-sidebar-navigation` asserts that the POS sidebar draft/low-stock badges
render with a real size, remain inside the sidebar bounds, and pass
`elementFromPoint` hit-testing while expanded and collapsed at both outlets. This
guards the fixed clipping bug where badges were positioned outside an
`overflow-hidden` icon slot. `pos-sidebar-badges.png` in the artifact directory is
the visual record.

When switching between `--dev-owner` and production runs, delete `apps/owner/.next`
before rebuilding; mixed dev/build artifacts otherwise cause webpack runtime
`MODULE_NOT_FOUND` errors on `next start`.
