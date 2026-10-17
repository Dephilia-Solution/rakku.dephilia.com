import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createEnvironment } from './isolation.mjs';

const owner = process.env.DEMO_OWNER_URL || 'http://localhost:3000';
const pos = process.env.DEMO_POS_URL || 'http://localhost:3001';
const require = createRequire(import.meta.url);
const modulePath = process.env.PLAYWRIGHT_MODULE_PATH
  ? require.resolve('playwright', { paths: [resolve(process.env.PLAYWRIGHT_MODULE_PATH, '..'), resolve(process.env.PLAYWRIGHT_MODULE_PATH)] })
  : require.resolve('playwright');
const imported = await import(pathToFileURL(modulePath).href);
const { chromium } = imported.chromium ? imported : imported.default;
const parent = join(tmpdir(), 'opencode');
await mkdir(parent, { recursive: true });
const artifacts = await mkdtemp(join(parent, 'rakku-routed-demo-'));
const browser = await chromium.launch({ channel: process.env.DEMO_E2E_BROWSER_CHANNEL || 'chrome', headless: process.env.DEMO_E2E_HEADED !== '1' });
const config = { owner, pos };
const results = [];

async function check(name, operation) {
  const env = await createEnvironment(browser, config);
  try {
    await operation(env);
    await env.assertClean();
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: error.stack });
    console.error(`FAIL ${name}\n${error.stack}`);
    for (const page of env.pages.filter(page => !page.isClosed())) {
      await page.screenshot({ path: join(artifacts, `${name}.png`), fullPage: true }).catch(() => {});
      await writeFile(join(artifacts, `${name}-dom.txt`), await page.locator('body').innerText().catch(() => ''), 'utf8');
    }
  } finally {
    await writeFile(join(artifacts, `${name}.json`), JSON.stringify(env.diagnostics(), null, 2));
    await env.context.close();
  }
}

async function near(operation, expected) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (Math.abs(await operation() - expected) < 2) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(Math.abs(await operation() - expected) < 2, `Expected geometry near ${expected}`);
}
const sidebar = page => page.locator('aside[aria-label="Navigasi utama"]');
async function navigate(page, label, path) {
  const link = sidebar(page).getByRole('link', { name: new RegExp(label) });
  await link.click();
  await page.waitForURL(`**${path}`);
  await link.waitFor();
  assert.equal(await link.getAttribute('aria-current'), 'page');
}
async function pinLogin(page, employee = 'Rani', pin = '111111', outlet = 'Pusat') {
  await page.waitForURL('**/demo/pos/login/select-outlet');
  await page.getByRole('button', { name: new RegExp(`Rakku Demo Cafe — ${outlet}`) }).click();
  await page.waitForURL('**/demo/pos/login/select-user');
  await page.getByRole('button', { name: new RegExp(`^${employee} `) }).click();
  await page.waitForURL('**/demo/pos/login/enter-pin?*');
  const digits = page.locator('input[inputmode="numeric"]');
  for (let index = 0; index < 6; index++) await digits.nth(index).fill(pin[index]);
  await page.waitForURL('**/demo/pos/register', { timeout: 20000 });
  await page.getByPlaceholder('Cari produk...').waitFor();
}
async function demoOption(page, label) {
  await page.getByRole('button', { name: 'Opsi demo', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}
const badgeSelector = 'span.bg-forest.rounded-full, span.bg-warning.rounded-full';
async function assertSidebarBadges(page, expected, label = 'Sidebar badges') {
  const aside = sidebar(page), badges = aside.locator(badgeSelector);
  await badges.first().waitFor();
  const count = await badges.count();
  if (expected !== undefined) assert.equal(count, expected, `${label}: expected count`);
  assert.ok(count > 0, `${label}: fixture badge is visible`);
  const side = await aside.boundingBox();
  for (let index = 0; index < count; index++) {
    const badge = badges.nth(index), box = await badge.boundingBox();
    assert.ok(box && box.width >= 10 && box.height >= 10, `${label}: badge ${index} has a rendered size`);
    assert.ok(box.x >= side.x - 1 && box.x + box.width <= side.x + side.width + 1, `${label}: badge ${index} stays inside the sidebar`);
    assert.ok(await badge.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return node === hit || node.contains(hit) || (hit && hit.contains(node));
    }), `${label}: badge ${index} is not clipped by overflow`);
  }
  return count;
}
async function productAdd(page) {
  await page.getByPlaceholder('Cari produk...').fill('Kopi Susu Gula Aren');
  await page.locator('main button').filter({ has: page.locator('p').filter({ hasText: /^Kopi Susu Gula Aren$/ }) }).click();
  await page.getByRole('button', { name: 'Tambahkan', exact: true }).click();
}

try {
  await check('owner-routes-sidebar-state', async env => {
    const page = await env.page(`${owner}/demo/owner/outlets`);
    await page.getByRole('heading', { name: 'Outlet', exact: true }).waitFor();
    await near(async () => (await sidebar(page).boundingBox()).width, 256);
    await near(async () => (await page.locator('.owner-main').boundingBox()).x, 256);
    await page.getByRole('button', { name: 'Ciutkan sidebar' }).click();
    await near(async () => (await sidebar(page).boundingBox()).width, 64);
    await near(async () => (await page.locator('.owner-main').boundingBox()).x, 64);
    await page.getByRole('link', { name: 'Perluas sidebar' }).click();
    await near(async () => (await sidebar(page).boundingBox()).width, 256);
    await page.getByRole('button', { name: 'Tambah Outlet', exact: true }).first().click();
    await page.getByPlaceholder('Outlet Utama').fill('Route Cafe Test');
    await page.getByPlaceholder('Jl. Contoh No. 1, Jakarta').fill('Alamat sementara');
    await page.locator('form').getByRole('button', { name: 'Tambah Outlet', exact: true }).click();
    await page.getByRole('heading', { name: 'Tambah Outlet', exact: true }).waitFor({ state: 'hidden' });
    assert.match(await page.locator('main').innerText(), /Route Cafe Test/);
    await navigate(page, 'Karyawan', '/demo/owner/employees');
    await navigate(page, 'Outlet', '/demo/owner/outlets');
    assert.match(await page.locator('main').innerText(), /Route Cafe Test/);
    await page.goBack();
    await page.waitForURL('**/demo/owner/employees');
    await page.goForward();
    await page.waitForURL('**/demo/owner/outlets');
    await page.getByText('Route Cafe Test', { exact: true }).filter({ visible: true }).waitFor();
    const second = await env.page(`${owner}/demo/owner/outlets`);
    await second.getByRole('heading', { name: 'Outlet', exact: true }).waitFor();
    assert.ok(!(await second.locator('main').innerText()).includes('Route Cafe Test'));
    assert.equal(await page.getByText('Mode Demo — semua perubahan hanya berlaku selama sesi ini.', { exact: true }).count(), 0);
    await page.screenshot({ path: join(artifacts, 'owner-sidebar.png'), fullPage: true });
    await demoOption(page, 'Reset Demo');
    await page.getByRole('heading', { name: 'Outlet', exact: true }).waitFor();
    assert.ok(!(await page.locator('main').innerText()).includes('Route Cafe Test'));
  });

  await check('pos-auth-sidebar-navigation', async env => {
    const page = await env.page(`${owner}/demo`);
    await page.getByRole('link', { name: 'Demo Kasir', exact: true }).click();
    await pinLogin(page);
    await near(async () => (await sidebar(page).boundingBox()).width, 240);
    await near(async () => (await page.locator('.pos-main').boundingBox()).x, 240);
    assert.equal(await assertSidebarBadges(page), 2, 'Draft and low-stock badges render on Kasir/Bahan Baku');
    await page.getByRole('button', { name: 'Ciutkan sidebar' }).click();
    await near(async () => (await page.locator('.pos-main').boundingBox()).x, 64);
    await assertSidebarBadges(page, 2);
    await page.getByRole('link', { name: 'Perluas sidebar' }).click();
    await near(async () => (await sidebar(page).boundingBox()).width, 240);
    await page.screenshot({ path: join(artifacts, 'pos-sidebar-badges.png'), clip: await sidebar(page).boundingBox() });
    await navigate(page, 'Produk', '/demo/pos/products');
    await page.getByRole('link', { name: /Tambah/ }).first().click();
    await page.waitForURL('**/demo/pos/products/add');
    await page.getByRole('heading', { name: 'Tambah Produk', exact: true }).waitFor();
    await navigate(page, 'Bahan Baku', '/demo/pos/ingredients');
    await page.getByPlaceholder('Cari bahan baku...').fill('Biji kopi');
    assert.match(await page.locator('main').innerText(), /6[.,]000/);
    await navigate(page, 'Kasir', '/demo/pos/register');
    await sidebar(page).getByRole('button', { name: 'Ganti User', exact: true }).click();
    await page.waitForURL('**/demo/pos/login/select-user');
    await page.getByRole('heading', { name: 'Pilih Akun', exact: true }).waitFor();
    await demoOption(page, 'Pilih outlet / kasir');
    await pinLogin(page, 'Dita', '333333', 'Taman');
    await assertSidebarBadges(page, 2, 'Taman draft and croissant badges');
    await navigate(page, 'Bahan Baku', '/demo/pos/ingredients');
    await page.getByPlaceholder('Cari bahan baku...').fill('Biji kopi');
    assert.match(await page.locator('main').innerText(), /4[.,]000/);
    await page.screenshot({ path: join(artifacts, 'pos-sidebar.png'), fullPage: true });
  });

  await check('pos-sale-shared-owner-data', async env => {
    const page = await env.page(`${owner}/demo/pos/login/select-outlet`);
    await pinLogin(page);
    await productAdd(page); await productAdd(page);
    await page.getByPlaceholder('Nama Customer (wajib)').filter({ visible: true }).fill('Routed transaction');
    await navigate(page, 'Pesanan', '/demo/pos/orders');
    await navigate(page, 'Kasir', '/demo/pos/register');
    await page.getByRole('button', { name: 'Payment', exact: true }).filter({ visible: true }).click();
    await page.getByRole('dialog', { name: 'Pembayaran', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Tunai', exact: true }).click();
    await page.locator('#payment-cash-amount').fill('100000');
    await page.getByRole('button', { name: 'Selesaikan Transaksi', exact: true }).click();
    await page.getByRole('button', { name: 'Tutup invoice', exact: true }).waitFor();
    const invoiceLabel = await page.getByText(/^Invoice #\d+$/).innerText();
    const number = invoiceLabel.match(/#(\d+)/)[1];
    await page.getByRole('button', { name: 'Tutup invoice', exact: true }).click();
    await navigate(page, 'Bahan Baku', '/demo/pos/ingredients');
    await page.getByPlaceholder('Cari bahan baku...').fill('Biji kopi');
    assert.match(await page.locator('main').innerText(), /5[.,]964/);
    await demoOption(page, 'Buka Owner');
    await page.waitForURL('**/demo/owner/dashboard');
    await navigate(page, 'Pesanan', '/demo/owner/orders');
    await page.getByRole('textbox').first().fill(number);
    await page.getByText(`#${number}`, { exact: true }).filter({ visible: true }).waitFor();
    await demoOption(page, 'Keluar Demo');
    await page.waitForURL('**/demo');
    await page.getByRole('link', { name: 'Demo Owner', exact: true }).click();
    await navigate(page, 'Pesanan', '/demo/owner/orders');
    await page.getByRole('textbox').first().fill(number);
    await page.getByText('Belum ada pesanan', { exact: true }).waitFor();
    assert.equal(await page.getByText(`#${number}`, { exact: true }).count(), 0);
  });

  await check('mobile-sidebar-lazy-route-bundles', async env => {
    const page = await env.page(`${owner}/demo/owner/dashboard`);
    await page.getByRole('heading', { name: /^Halo,/ }).waitFor();
    assert.ok(!env.requests.some(request => /owner\/(?:outlets|products)\/page-/.test(request.url)), 'Dashboard must not load feature page bundles');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Lainnya/ }).click();
    await page.getByRole('link', { name: 'Outlet', exact: true }).filter({ visible: true }).click();
    await page.waitForURL('**/demo/owner/outlets');
    await page.getByRole('heading', { name: 'Menu Lainnya', exact: true }).waitFor({ state: 'hidden' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(artifacts, 'mobile-owner.png'), fullPage: true });
    await page.reload();
    await page.getByRole('heading', { name: 'Outlet', exact: true }).waitFor();
    await env.assertSentinels();
  });

  await check('pos-mobile-menu-and-breakpoints', async env => {
    const page = await env.page(`${owner}/demo/pos/login/select-outlet`);
    await pinLogin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Lainnya/ }).filter({ visible: true }).waitFor();
    await near(async () => (await page.locator('.pos-main').boundingBox()).x, 0);
    await page.getByRole('button', { name: /Lainnya/ }).filter({ visible: true }).click();
    await page.getByRole('link', { name: /Bahan Baku/ }).filter({ visible: true }).click();
    await page.waitForURL('**/demo/pos/ingredients');
    await page.getByRole('heading', { name: 'Menu Lainnya', exact: true }).waitFor({ state: 'hidden' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(artifacts, 'mobile-pos.png'), fullPage: true });
    await page.setViewportSize({ width: 767, height: 1024 });
    await page.getByRole('button', { name: /Lainnya/ }).filter({ visible: true }).waitFor();
    await page.setViewportSize({ width: 768, height: 1024 });
    await near(async () => (await sidebar(page).boundingBox()).width, 240);
    await near(async () => (await page.locator('.pos-main').boundingBox()).x, 240);
  });
} finally {
  await browser.close();
  await writeFile(join(artifacts, 'summary.json'), JSON.stringify({ owner, pos, results }, null, 2));
  console.log(`${results.filter(row => row.passed).length}/${results.length} routed suites passed. Artifacts: ${artifacts}`);
  if (results.some(row => !row.passed)) process.exitCode = 1;
}
