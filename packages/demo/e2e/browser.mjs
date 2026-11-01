import assert from 'node:assert/strict';

export const PRODUCT = 'Kopi Susu Gula Aren';
export const PUSAT = 'Rakku Demo Cafe — Pusat';
export const TAMAN = 'Rakku Demo Cafe — Taman';
export const rp = (number) => `Rp ${number.toLocaleString('id-ID')}`;
export const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function eventually(operation, description, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let last;
  do {
    try { return await operation(); } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`${description}: ${last?.message}`, { cause: last });
}

export async function textIncludes(locator, expected) {
  await eventually(async () => {
    const text = await locator.innerText({ timeout: 1500 });
    if (expected instanceof RegExp) assert.match(text, expected);
    else assert.ok(text.includes(expected), `Expected ${JSON.stringify(expected)} in ${JSON.stringify(text)}`);
  }, `UI text ${expected}`);
}

export async function countIs(locator, number) {
  await eventually(async () => assert.equal(await locator.count(), number), `Expected ${number} matching elements`);
}

export async function visible(locator) { await locator.waitFor({ state: 'visible' }); }
export async function absent(locator) { await locator.waitFor({ state: 'hidden' }); }
export function button(scope, name) { return scope.getByRole('button', { name, exact: typeof name === 'string' }); }
export async function click(scope, name) { await button(scope, name).click(); }
export async function clickTab(scope, name) {
  const target = scope.getByRole('tab', { name, exact: typeof name === 'string' });
  await target.click();
  await eventually(async () => assert.equal(await target.getAttribute('aria-selected'), 'true'), `Select tab ${name}`);
}
export function dialog(page, name) { return page.getByRole('dialog', name ? { name, exact: typeof name === 'string' } : {}); }
export async function closeDialog(page) {
  const opened = dialog(page);
  await click(opened, /^Tutup /);
  await absent(opened);
}

export async function enterOwner(page, url) {
  if (url) await page.goto(`${url}/demo`, { waitUntil: 'domcontentloaded' });
  await click(page, 'Demo Owner');
  await visible(page.getByRole('navigation', { name: 'Fitur demo' }));
}

export async function nav(page, name) {
  const target = page.getByRole('navigation', { name: 'Fitur demo' }).getByRole('button', {
    name: name === 'Bahan Baku' ? /^Bahan Baku(?: •)?$/ : name,
    exact: name !== 'Bahan Baku',
  });
  await target.click();
  await eventually(async () => assert.equal(await target.getAttribute('aria-current'), 'page'), `Navigate ${name}`);
}

export async function selectOutlet(page, name) {
  await page.getByLabel('Pilih outlet demo', { exact: true }).selectOption({ label: name });
}

export async function cashier(page, employee = 'Rani', pin = '111111', outlet = PUSAT) {
  await click(page, 'Beralih POS');
  await loginCashier(page, employee, pin, outlet);
}

export async function loginCashier(page, employee, pin, outlet = PUSAT) {
  await page.getByLabel('Pilih outlet', { exact: true }).selectOption({ label: outlet });
  const select = page.getByLabel('Pilih karyawan', { exact: true });
  const option = select.getByRole('option', { name: new RegExp(`^${escaped(employee)} ·`) });
  await select.selectOption(await option.getAttribute('value'));
  await page.getByLabel('PIN demo', { exact: true }).fill(pin);
  await click(page, 'Masuk Kasir Demo');
}

export function row(page, name) {
  return page.locator('main article').filter({ has: page.getByRole('heading', { name, exact: true }) });
}

export async function searchRow(page, title, name) {
  await page.getByRole('textbox', { name: `Cari ${title}`, exact: true }).fill(name);
  const result = row(page, name);
  await visible(result);
  return result;
}

export async function edit(page, title, name) {
  const found = await searchRow(page, title, name);
  await click(found, 'Edit');
  const opened = dialog(page, `Edit ${title}`);
  await visible(opened);
  return opened;
}

export async function save(page, title) {
  const opened = dialog(page);
  await click(opened, `Simpan ${title}`);
  await absent(opened);
  await textIncludes(page.getByRole('status').filter({ hasText: 'Perubahan demo disimpan.' }), 'Perubahan demo disimpan.');
}

export async function addToCart(page, name = PRODUCT, quantity = 1, customer = '') {
  await nav(page, 'Register');
  await page.getByLabel('Cari produk', { exact: true }).fill(name);
  // Product-card accessible names include category and price; cart buttons are excluded.
  const card = page.locator('main button').filter({ has: page.locator('p', { hasText: new RegExp(`^${escaped(name)}$`) }) });
  await card.click();
  const opened = dialog(page, name);
  await visible(opened);
  for (let i = 1; i < quantity; i++) await click(opened, `Tambah ${name}`);
  await click(opened, 'Tambah ke keranjang');
  await absent(opened);
  if (customer) await page.getByLabel('Nama pelanggan', { exact: true }).fill(customer);
  await textIncludes(page.getByRole('complementary', { name: 'Keranjang' }), `Keranjang · ${quantity} item`);
}

export async function cashSale(page, customer, quantity = 2, name = PRODUCT) {
  await addToCart(page, name, quantity, customer);
  await click(page.getByRole('complementary', { name: 'Keranjang' }), 'Bayar');
  const payment = dialog(page, 'Bayar pesanan demo');
  await click(payment, 'Konfirmasi pembayaran simulasi');
  await visible(dialog(page, /^Invoice #/));
  await textIncludes(dialog(page), 'Status: completed');
  const number = (await dialog(page).getAttribute('aria-labelledby'));
  assert.ok(number, 'Invoice must have an accessible title');
  const title = await dialog(page).getByRole('heading', { level: 2 }).innerText();
  await closeDialog(page);
  return title.replace('Invoice #', '');
}

export async function ingredients(page, expected) {
  await nav(page, 'Bahan Baku');
  for (const [name, stock, unit = 'gram', cost] of expected) {
    const found = await searchRow(page, 'Bahan Baku', name);
    await textIncludes(found, `${stock.toLocaleString('id-ID')} ${unit} ·`);
    if (cost !== undefined) await textIncludes(found, `${rp(cost)}/${unit}`);
  }
}

export async function metric(page, label) {
  const value = page.locator('main p').filter({ hasText: new RegExp(`^${escaped(label)}$`) }).locator('..').locator('p').nth(1);
  await visible(value);
  const text = await value.innerText();
  assert.match(text, /^(?:Rp )?[\d.,-]+$/, `Metric ${label}: ${text}`);
  return Number(text.replace(/^Rp /, '').replaceAll('.', '').replace(',', '.'));
}

export async function report(page, profit = false) {
  await nav(page, 'Laporan');
  await page.getByLabel('Outlet', { exact: true }).selectOption({ label: PUSAT });
  await click(page, 'Hari ini');
  await clickTab(page.locator('main'), profit ? 'Laba rugi' : 'Penjualan');
  return { revenue: await metric(page, 'Pendapatan'), orders: await metric(page, 'Transaksi selesai'),
    ...(profit ? { cogs: await metric(page, 'HPP'), expenses: await metric(page, 'Pengeluaran') } : {}) };
}

export async function ordersFor(page, customer) {
  await nav(page, 'Pesanan');
  await page.getByLabel('Cari pesanan', { exact: true }).fill(customer);
  const result = page.getByRole('row').filter({ has: page.getByRole('cell', { name: new RegExp(escaped(customer)) }) });
  await countIs(result, 1);
  return result;
}

export async function imageUpload(scope) {
  await scope.getByLabel('Upload gambar demo', { exact: true }).setInputFiles({
    name: 'acceptance-preview.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8n8AAAAASUVORK5CYII=', 'base64'),
  });
  const preview = scope.getByRole('img', { name: 'Preview produk', exact: true });
  await eventually(async () => assert.match(await preview.getAttribute('src'), /^blob:/), 'Local blob preview');
  await eventually(async () => assert.equal(await preview.evaluate((image) => image.complete && image.naturalWidth > 0), true), 'Decoded upload preview');
  return preview.getAttribute('src');
}

export async function revoked(page, url) {
  await eventually(async () => assert.equal(await page.evaluate((value) => globalThis.__acceptanceSpy.revoked.includes(value), url), true), `Blob revoked: ${url}`);
}

export async function initialCafe(page) {
  await enterOwner(page);
  await nav(page, 'Register');
  await textIncludes(page.getByRole('complementary', { name: 'Keranjang' }), 'Keranjang · 0 item');
  await countIs(dialog(page), 0);
  await nav(page, 'Produk');
  const seed = await searchRow(page, 'Produk', PRODUCT);
  await textIncludes(seed, rp(26000));
  assert.ok(!(await seed.locator('img').getAttribute('src')).startsWith('blob:'));
  await ingredients(page, [['Biji kopi', 6000], ['Susu full cream', 20000, 'ml']]);
}
