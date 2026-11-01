import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const cwd = fileURLToPath(new URL("../apps/landing/", import.meta.url));
const require = createRequire(import.meta.url);
const server = createServer();
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const canonical = (process.env.SITE_URL || "https://rakku.dephilia.com").replace(/\/$/, "");
const cli = require.resolve("next/dist/bin/next", { paths: [cwd] });
const child = spawn(process.execPath, [cli, "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd, env: { ...process.env, NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
let logs = "";
for (const stream of [child.stdout, child.stderr]) stream.on("data", data => { logs = `${logs}${data}`.slice(-5000); });
const request = path => fetch(`${origin}${path}`, { signal: AbortSignal.timeout(15_000) });
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) break;
    try { const r = await request("/"); await r.body?.cancel(); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, `Landing failed to start: ${logs}`);
  const home = await request("/"); const html = await home.text();
  assert.equal(home.status, 200);
  const canonicalHref = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.equal(canonicalHref?.replace(/\/$/, ""), canonical);
  assert.match(html, /<meta name="robots" content="index, follow"/);
  assert.match(html, /<meta property="og:image" content="https:\/\/[^\"]+\/opengraph-image/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const faq = schema["@graph"].find(node => Array.isArray(node["@type"]) && node["@type"].includes("FAQPage"));
  assert.equal(faq.mainEntity.length, 10);
  assert.equal((html.match(/<details\b/g) || []).length, 10);
  assert.ok(html.includes("Tidak. Data tetap tersimpan"), "closed FAQ answers must exist in server HTML");
  assert.ok(html.includes("Transaksi kasir Rakku membutuhkan koneksi internet"));
  assert.ok(!html.includes("opacity:0"), "content must be visible before hydration");
  console.log("PASS homepage: canonical, robots meta, social metadata, JSON-LD, and all FAQ answers in initial HTML");
  const robots = await request("/robots.txt");
  assert.equal(robots.status, 200); const robotsText = await robots.text();
  assert.ok(robotsText.includes("Allow: /")); assert.ok(robotsText.includes(`Sitemap: ${canonical}/sitemap.xml`));
  const sitemap = await request("/sitemap.xml");
  assert.equal(sitemap.status, 200); const xml = await sitemap.text();
  assert.ok(xml.includes(`<loc>${canonical}/</loc>`));
  assert.equal((xml.match(/<loc>/g) || []).length, 1);
  assert.ok(!xml.includes("localhost"));
  console.log("PASS robots.txt and sitemap.xml: canonical production origin, real public URLs only");
  const og = await request("/opengraph-image");
  assert.equal(og.status, 200); assert.match(og.headers.get("content-type"), /image\/png/);
  await og.body?.cancel();
  const original = await request("/images/kopsuaren.webp"); const originalBytes = (await original.arrayBuffer()).byteLength;
  const optimized = await fetch(`${origin}/_next/image?url=%2Fimages%2Fkopsuaren.webp&w=384&q=75`, { headers: { accept: "image/webp" }, signal: AbortSignal.timeout(15_000) });
  assert.equal(optimized.status, 200); assert.match(optimized.headers.get("content-type"), /image\/webp/);
  const optimizedBytes = (await optimized.arrayBuffer()).byteLength;
  assert.ok(optimizedBytes < originalBytes / 4);
  console.log(`PASS image optimizer: ${originalBytes} → ${optimizedBytes} bytes (${Math.round((1 - optimizedBytes / originalBytes) * 100)}% smaller for a 384px image)`);
  if (process.argv.includes("--browser")) {
    const { chromium } = require(require.resolve("playwright", { paths: [process.env.PLAYWRIGHT_MODULE_PATH || cwd] }));
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const artifacts = await mkdtemp(join(tmpdir(), "opencode", "rakku-landing-seo-"));
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(origin, { waitUntil: "networkidle" });
      assert.ok(await page.getByRole("heading", { level: 1 }).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const answer = page.locator("details").nth(4);
      await answer.locator("summary").click();
      assert.ok(await answer.locator("p").isVisible(), "FAQ must work without hydration");
      await page.screenshot({ path: join(artifacts, "mobile-no-javascript.png"), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(origin, { waitUntil: "networkidle" });
      assert.ok(await page.getByRole("heading", { level: 1 }).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: join(artifacts, "desktop-no-javascript.png"), fullPage: true });
      await context.close();
      console.log(`PASS browser without JavaScript: visible content, working native FAQ, and no horizontal overflow at 390px/1440px. Artifacts: ${artifacts}`);
    } finally { await browser.close(); }
  }
} finally {
  if (child.pid && child.exitCode === null) {
    if (process.platform === "win32") await new Promise(resolve => {
      const kill = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      kill.once("error", resolve); kill.once("close", resolve);
    });
    else { child.kill("SIGTERM"); await new Promise(resolve => child.once("close", resolve)); }
  }
}
