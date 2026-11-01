import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createEnvironment } from './isolation.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url)),require=createRequire(import.meta.url);
const {chromium,devices}=require(require.resolve('playwright',{paths:[process.env.PLAYWRIGHT_MODULE_PATH||root]}));
const requireOwner=createRequire(new URL('../../../apps/owner/package.json',import.meta.url));
const owner=process.env.DEMO_OWNER_URL||'http://localhost:3520',pos=process.env.DEMO_POS_URL||'http://localhost:3521';
const artifacts=await mkdtemp(join(tmpdir(),'opencode','rakku-owner-upgrade-'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
async function check(name,operation,options={}){
  const env=await createEnvironment(browser,{owner,pos},options);
  try{await operation(env);await env.assertClean();results.push({name,passed:true});console.log(`PASS ${name}`);}
  catch(error){results.push({name,passed:false,error:error.stack});console.error(`FAIL ${name}\n${error.stack}`);
    for(const page of env.pages.filter(page=>!page.isClosed())){await page.screenshot({path:join(artifacts,`${name}-failed.png`),fullPage:true}).catch(()=>{});await writeFile(join(artifacts,`${name}-dom.txt`),await page.locator('body').innerText().catch(()=>''));}}
  finally{await env.context.close();}
}
async function fit(page,label){
  const geometry=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,main:document.querySelector('.owner-page')?.getBoundingClientRect().toJSON(),sidebar:document.querySelector('aside[aria-label="Navigasi utama"]')?.getBoundingClientRect().toJSON()}));
  assert.ok(geometry.document<=geometry.width+1,`${label}: page overflows ${JSON.stringify(geometry)}`);
  assert.ok(geometry.main&&geometry.main.right<=geometry.width+1&&geometry.main.left>=-1,`${label}: invalid page container`);
  if(geometry.width<768)assert.ok(geometry.main.left<48&&geometry.main.width>geometry.width-60,`${label}: mobile content is squeezed by a sidebar margin`);
  else if(geometry.sidebar?.width)assert.ok(geometry.main.left>=geometry.sidebar.right+12,`${label}: content is covered by the sidebar ${JSON.stringify(geometry)}`);
}
async function ready(page){
  await page.locator('.owner-page').waitFor();await page.locator('.owner-page h1').first().waitFor();
  await page.waitForFunction(()=>!document.querySelector('.owner-page .owner-skeleton,.owner-page [role="status"][aria-label^="Memuat"]'));
  await page.waitForFunction(()=>{
    const main=document.querySelector('.owner-main');if(!main)return false;
    const expected=innerWidth<768?0:document.documentElement.dataset.ownerSidebar==='collapsed'?64:256;
    return Math.abs(main.getBoundingClientRect().left-expected)<1;
  });
}
async function readDownload(page,button){const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks);}
async function previewAndConfirm(page,panel){
  await panel.getByRole('button',{name:'Validasi simulasi',exact:true}).click();
  await panel.getByRole('heading',{name:'Pratinjau impor',exact:true}).waitFor();
  assert.equal(await panel.getByRole('button',{name:'Lanjut ke konfirmasi',exact:true}).isEnabled(),true,await panel.innerText());
  await panel.getByRole('button',{name:'Lanjut ke konfirmasi',exact:true}).click();
  await panel.getByRole('button',{name:'Konfirmasi simulasi',exact:true}).click();
  await panel.getByRole('heading',{name:'Simulasi selesai',exact:true}).waitFor();
}
try{
  await check('dashboard-filters-and-comparisons',async env=>{
    const page=await env.page(`${owner}/demo/owner/dashboard`);await ready(page);
    const transactions=()=>page.getByRole('link',{name:/Transaksi selesai/}).locator('p').nth(1).innerText().then(Number);
    assert.equal(await transactions(),4);
    await page.getByRole('button',{name:'7 hari',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('.owner-page a')].some(a=>a.textContent.includes('Transaksi selesai')&&a.querySelectorAll('p')[1]?.textContent==='28'));
    await page.getByLabel('Outlet dashboard',{exact:true}).selectOption('fixture:pusat');
    await page.waitForFunction(()=>[...document.querySelectorAll('.owner-page a')].some(a=>a.textContent.includes('Transaksi selesai')&&a.querySelectorAll('p')[1]?.textContent==='14'));
    assert.ok((await page.getByRole('link',{name:/Transaksi selesai/}).getAttribute('href')).includes('range=week'));
    await fit(page,'desktop dashboard');
    await page.screenshot({path:join(artifacts,'dashboard-desktop.png'),animations:'disabled'});
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await fit(page,'dashboard 390');
    await page.screenshot({path:join(artifacts,'dashboard-mobile.png'),animations:'disabled'});
  });
  await check('owner-responsive-viewport-matrix',async env=>{
    const page=await env.page(`${owner}/demo/owner/dashboard`);await ready(page);
    const paths=['dashboard','outlets',...['info','produk','bahan','meja','pajak','staf'].map(tab=>`outlets/fixture:pusat?tab=${tab}`)];
    for(const width of [360,375,390,430,768,1024,1440,1920]){
      await page.setViewportSize({width,height:width<768?844:1000});
      for(const path of paths){await page.goto(`${owner}/demo/owner/${path}`);await ready(page);await page.waitForTimeout(80);await fit(page,`${width} ${path}`);}
      if(width===390||width===1440)for(const path of ['orders','reports','settings','subscription','balance','products/add?outlet=fixture:pusat']){await page.goto(`${owner}/demo/owner/${path}`);await ready(page);await fit(page,`${width} ${path}`);}
    }
    await page.setViewportSize({width:390,height:844});await page.goto(`${owner}/demo/owner/outlets/fixture:pusat?tab=produk`);await ready(page);
    await page.screenshot({path:join(artifacts,'outlet-products-mobile.png'),animations:'disabled'});
    await page.setViewportSize({width:1440,height:1000});await page.goto(`${owner}/demo/owner/outlets/fixture:pusat?tab=bahan`);await ready(page);
    await page.screenshot({path:join(artifacts,'outlet-inventory-desktop.png'),animations:'disabled'});
  });
  await check('outlet-tabs-switch-without-page-refresh',async env=>{
    const page=await env.page(`${owner}/demo/owner/outlets/fixture:pusat?tab=produk`);await ready(page);
    let mainNavigations=0;page.on('request',request=>{if(request.isNavigationRequest()&&!request.url().includes('/_next/'))mainNavigations++;});
    for(const [key,label] of [['info','Informasi'],['bahan','Bahan Baku'],['meja','Meja'],['pajak','Pajak & Diskon'],['staf','Staf'],['produk','Produk']]){
      const tab=page.getByRole('tab',{name:label,exact:true});await tab.click();
      await page.waitForFunction(value=>new URL(location.href).searchParams.get('tab')===value,key);
      assert.equal(await tab.getAttribute('aria-selected'),'true',`the ${label} tab should update immediately`);
      await page.getByRole('tabpanel').waitFor();
    }
    assert.equal(mainNavigations,0,'client-only outlet tabs should not reload the document');
    await page.screenshot({path:join(artifacts,'outlet-tab-switch.png'),animations:'disabled'});
  });
  await check('mobile-sheet-focus-and-back',async env=>{
    const page=await env.page(`${owner}/demo/owner/outlets`);await page.setViewportSize({width:360,height:780});await ready(page);
    await page.getByRole('button',{name:'Tambah Outlet',exact:true}).first().click();
    const dialog=page.getByRole('dialog',{name:'Tambah Outlet',exact:true});await dialog.waitFor();
    const box=await dialog.boundingBox();assert.ok(box.width<=360&&box.height<=780);
    for(let count=0;count<8;count++)await page.keyboard.press('Tab');
    assert.ok(await dialog.evaluate(node=>node.contains(document.activeElement)),'keyboard focus must stay inside sheet');
    await page.goBack();await dialog.waitFor({state:'hidden'});assert.ok(page.url().endsWith('/demo/owner/outlets'));
  });
  await check('manual-purchase-wib-and-nested-sheet-back',async env=>{
    const page=await env.page(`${owner}/demo/owner/outlets/fixture:pusat?tab=bahan`);await ready(page);
    await page.getByRole('tab',{name:'Pembelian',exact:true}).click();
    await page.getByRole('button',{name:'Catat Pembelian',exact:true}).click();
    const purchase=page.getByRole('dialog',{name:'Catat Pembelian',exact:true});await purchase.waitFor();
    await purchase.getByPlaceholder('Nama pemasok').fill('Manual WIB Tokyo');
    await purchase.locator('input[type=date]').fill('2026-10-25');
    await purchase.getByRole('combobox').selectOption('fixture:pusat:ingredient:0');
    await purchase.getByRole('spinbutton').nth(0).fill('1');
    await purchase.getByRole('spinbutton').nth(1).fill('120');
    await purchase.getByRole('button',{name:'Simpan Pembelian',exact:true}).click();await purchase.waitFor({state:'hidden'});
    const saved=page.locator('article').filter({has:page.getByRole('heading',{name:'Manual WIB Tokyo',exact:true})});await saved.waitFor();
    assert.match(await saved.innerText(),/25 Okt/,'a browser in Tokyo must not move a selected Jakarta purchase date backward');
    await page.goto(`${owner}/demo/owner/products/add?outlet=fixture:pusat`);await ready(page);
    await page.getByRole('button',{name:'Atur Komposisi',exact:true}).click();
    const parent=page.getByRole('dialog',{name:'Komposisi Produk',exact:true});await parent.waitFor();
    await parent.getByRole('button',{name:'Tambah Bahan Baku',exact:true}).click();
    const child=page.getByRole('dialog',{name:'Tambah Bahan Baku',exact:true});await child.waitFor();
    await page.goBack();await child.waitFor({state:'hidden'});assert.ok(await parent.isVisible(),'Back closes only the topmost sheet');
    await page.goBack();await parent.waitFor({state:'hidden'});assert.ok(page.url().includes('/products/add'));
  },{device:{timezoneId:'Asia/Tokyo',viewport:{width:390,height:844}}});
  await check('demo-product-image-and-purchase-import',async env=>{
    const page=await env.page(`${owner}/demo/owner/outlets/fixture:pusat?tab=produk`);await page.setViewportSize({width:390,height:844});await ready(page);
    await page.getByRole('button',{name:'Import',exact:true}).click();
    let panel=page.locator('section[aria-labelledby]').filter({has:page.getByRole('heading',{name:'Import Excel — Produk',exact:true})});
    panel=page.locator(`section[aria-labelledby="${await panel.getAttribute('aria-labelledby')}"]`);
    const sample=await readDownload(page,panel.getByRole('button',{name:'Unduh contoh demo terisi',exact:true}));
    const malformedBook=new (requireOwner('exceljs').Workbook)();await malformedBook.xlsx.load(sample);malformedBook.getWorksheet('Produk').getCell('A1').value='header_salah';
    await panel.locator('input[type=file][accept^=".xlsx"]').setInputFiles({name:'format-salah.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await malformedBook.xlsx.writeBuffer())});
    await panel.getByRole('button',{name:'Validasi simulasi',exact:true}).click();
    await panel.getByText(/File belum dikirim; periksa sheet\/baris/).waitFor();
    const ExcelJS=requireOwner('exceljs'),book=new ExcelJS.Workbook();await book.xlsx.load(sample);
    const sheet=book.getWorksheet('Produk');let imageColumn=0;sheet.getRow(1).eachCell((cell,column)=>{if(cell.value==='gambar')imageColumn=column;});assert.ok(imageColumn);
    sheet.getRow(2).getCell(imageColumn).value='photo.jpg';
    for(let index=1;index<=20;index++)sheet.addRow([`DEMO-BULK-${index}`,`Produk Bulk ${index}`,'Coffee',18000,'Contoh pagination',null,null,null,null,'']);
    const workbook=Buffer.from(await book.xlsx.writeBuffer());
    await panel.locator('input[type=file][accept^=".xlsx"]').setInputFiles({name:'demo-produks.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:workbook});
    await panel.getByRole('button',{name:'Validasi simulasi',exact:true}).click();await panel.getByRole('heading',{name:'Pratinjau impor',exact:true}).waitFor();
    assert.equal(await panel.getByRole('button',{name:'Lanjut ke konfirmasi',exact:true}).isEnabled(),false,'missing ZIP image must block confirm');
    await panel.getByRole('button',{name:'Pilih / perbaiki file',exact:true}).click();
    const image=await requireOwner('sharp')({create:{width:80,height:100,channels:3,background:'#2e7d32'}}).jpeg().toBuffer();
    const zip=Buffer.from(requireOwner('fflate').zipSync({'photo.jpg':new Uint8Array(image)}));
    await panel.locator('input[type=file][accept^=".zip"]').setInputFiles({name:'photos.zip',mimeType:'application/zip',buffer:zip});
    await previewAndConfirm(page,panel);
    await fit(page,'mobile product image import');
    assert.match(await panel.innerText(),/21 data diimpor/);
    await page.screenshot({path:join(artifacts,'product-import-result.png'),animations:'disabled'});
    await panel.getByRole('button',{name:'Selesai & tutup',exact:true}).click();
    const pagination=page.getByRole('navigation',{name:'Halaman katalog produk'});await pagination.waitFor();
    await pagination.getByRole('button',{name:'Berikutnya',exact:true}).click();assert.match(await pagination.innerText(),/Halaman 2 dari 2/);
    await page.getByPlaceholder('Cari produk...').fill('Kopi Contoh Import');
    await page.getByText('Kopi Contoh Import',{exact:true}).filter({visible:true}).first().waitFor();
    assert.ok(await page.getByRole('img',{name:'Kopi Contoh Import',exact:true}).first().getAttribute('src'));
    await page.getByRole('tab',{name:'Bahan Baku',exact:true}).click();
    await page.getByRole('tab',{name:'Pembelian',exact:true}).click();
    await page.getByRole('button',{name:'Import Pembelian',exact:true}).click();
    panel=page.locator('section[aria-labelledby]').filter({has:page.getByRole('heading',{name:'Import Excel — Pembelian',exact:true})});
    panel=page.locator(`section[aria-labelledby="${await panel.getAttribute('aria-labelledby')}"]`);
    const purchases=await readDownload(page,panel.getByRole('button',{name:'Unduh contoh demo terisi',exact:true}));
    await panel.locator('input[type=file][accept^=".xlsx"]').setInputFiles({name:'purchases.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:purchases});
    await previewAndConfirm(page,panel);assert.match(await panel.innerText(),/2 data diimpor/);
    await fit(page,'mobile purchase import');
    await page.screenshot({path:join(artifacts,'purchase-import-result.png'),animations:'disabled'});
  });
  for(const deviceName of ['iPhone 13','Pixel 7','iPad Mini']){
    const {defaultBrowserType,...device}=devices[deviceName];
    await check(`touch-emulation-${deviceName.replaceAll(' ','-').toLowerCase()}`,async env=>{
      const page=await env.page(`${owner}/demo/owner/outlets`);await ready(page);await fit(page,deviceName);
      await page.getByRole('button',{name:'Tambah Outlet',exact:true}).first().tap();
      const dialog=page.getByRole('dialog',{name:'Tambah Outlet',exact:true});await dialog.waitFor();
      const close=dialog.getByRole('button',{name:'Tutup',exact:true});await page.waitForTimeout(350);
      const rect=await close.boundingBox();assert.ok(rect.width>=44&&rect.height>=44&&rect.x>=0&&rect.x+rect.width<=page.viewportSize().width,'sheet actions must fit after their opening transition');
      await page.screenshot({path:join(artifacts,`${deviceName.replaceAll(' ','-').toLowerCase()}-sheet.png`)});
      await close.tap();await dialog.waitFor({state:'hidden'});
    },{device});
  }
}finally{await writeFile(join(artifacts,'results.json'),JSON.stringify(results,null,2));await browser.close();}
console.log(`${results.filter(row=>row.passed).length}/${results.length} Owner upgrade suites passed. Artifacts: ${artifacts}`);
process.exitCode=results.every(row=>row.passed)?0:1;
