import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

// Browser presentation/expiry checks use fixture HTTP responses. All real
// database, Auth and provider transports remain blocked; no signup is submitted.
const root = fileURLToPath(new URL('../',import.meta.url)), require = createRequire(import.meta.url);
const {chromium} = require(require.resolve('playwright',{paths:[process.env.PLAYWRIGHT_MODULE_PATH || root]}));
const buildDirectory = process.env.RAKKU_BUILD_DIRECTORY || '.next-hardening-promotions';
if (!/^\.next-hardening(?:-[a-z0-9]+)*$/.test(buildDirectory)) throw new Error('Invalid build directory');
const env = {...process.env,NODE_ENV:'production',RAKKU_ISOLATED_BUILD:'1',RAKKU_BUILD_DIRECTORY:buildDirectory,
  DATABASE_URL:'postgresql://blocked:blocked@127.0.0.1:1/blocked?connect_timeout=1',
  OWNER_JWT_SECRET:'isolated-promotion-browser-at-least-32-characters',
  NEON_AUTH_BASE_URL:'http://127.0.0.1:1',NEON_AUTH_COOKIE_SECRET:'isolated-promotion-browser-at-least-32-characters'};
for (const provider of ['ECHO','SILOS','VESSEL']) {env[`${provider}_API_URL`]='http://127.0.0.1:1';env[`${provider}_API_KEY`]='blocked';}
const children = [], origins = {}, results = [];
const landingOnly = process.argv.includes('--landing-only');
const promo = {id:'e26c0000-0000-4000-8000-000000000001',name:'Promo Pengguna Baru 2026',plan_name:'Pro',duration_months:3,starts_on:'2026-11-01',ends_on:'2026-12-31',terms:'Hak aktif tiga bulan sejak daftar akun. S&K Berlaku.'};
let browser;
const artifacts = await mkdtemp(join(tmpdir(),'opencode','rakku-signup-promo-'));
try {
  for (const app of landingOnly ? ['landing'] : ['owner','landing']) {
    const cwd = resolve(root,'apps',app);
    await access(resolve(cwd,buildDirectory,'BUILD_ID'));
    const socket = createServer(); await new Promise(done => socket.listen(0,'127.0.0.1',done));
    const port = socket.address().port; await new Promise(done => socket.close(done));
    origins[app]=`http://127.0.0.1:${port}`;
    const cli=require.resolve('next/dist/bin/next',{paths:[cwd]});
    const child=spawn(process.execPath,[cli,'start','-H','127.0.0.1','-p',String(port)],{cwd,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
    children.push(child); let logs=''; for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{logs=(logs+data).slice(-4000);});
    let ready=false;
    for(let i=0;i<100;i++) {
      try {const response=await fetch(`${origins[app]}${app==='owner'?'/register':'/'}`,{signal:AbortSignal.timeout(3000)});await response.body?.cancel();if(response.ok){ready=true;break;}}catch{}
      await new Promise(done=>setTimeout(done,200));
    }
    assert.ok(ready,`${app} did not start: ${logs}`);
  }
  browser=await chromium.launch({channel:'chrome',headless:true});
  for (const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});
    let mode='active';
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/api/public/signup-promotion') {
        if(mode==='unavailable')return route.fulfill({status:503,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"error":"unavailable"}'});
        const promotion=mode==='none'?null:mode==='other-plan'?{...promo,plan_name:'Business'}:mode==='other-duration'?{...promo,duration_months:6}:promo;
        return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({promotion,serverNow:mode==='cutoff'?'2026-12-31T16:59:58.500Z':'2026-12-15T10:00:00Z'})});
      }
      if(Object.values(origins).includes(url.origin))return route.continue();
      return route.abort();
    });
    const page=await context.newPage();
    if (!landingOnly) {
    await page.goto(`${origins.owner}/register`);
    const notice=page.getByRole('complementary',{name:'Promo pendaftaran'});
    await notice.waitFor({state:'visible'});
    assert.match(await notice.innerText(),/Pro gratis 3 bulan kalender/);
    assert.match(await notice.innerText(),/31 Desember 2026/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:join(artifacts,`register-${width}.png`)});
    await page.getByRole('button',{name:'Buat akun',exact:true}).scrollIntoViewIfNeeded();
    assert.ok(await page.getByRole('button',{name:'Buat akun',exact:true}).isVisible());
    results.push({suite:`register-${width}`,pass:true});
    mode='cutoff'; await page.reload(); await notice.waitFor({state:'visible'});
    await notice.waitFor({state:'hidden',timeout:5000});
    results.push({suite:`WIB-cutoff-${width}`,pass:true});
    for (const state of ['none','unavailable']) {
      mode=state; await page.reload(); await page.waitForTimeout(250);
      assert.equal(await notice.count(),0);
      assert.ok(!(await page.locator('body').innerText()).includes('14 hari'));
      results.push({suite:`${state}-${width}`,pass:true});
    }
    }
    mode='active'; await page.goto(origins.landing);
    const landingNotices=page.getByRole('complementary',{name:'Promo pendaftaran'});
    const proPlan=page.locator('[data-plan="pro"]');
    const landingNotice=proPlan.getByRole('complementary',{name:'Promo pendaftaran'});
    await landingNotice.scrollIntoViewIfNeeded(); await landingNotice.waitFor({state:'visible'});
    assert.match(await landingNotice.innerText(),/Gratis 3 bulan untuk pengguna baru/);
    assert.match(await landingNotice.innerText(),/31 Desember 2026/);
    assert.equal(await landingNotices.count(),1);
    assert.equal(await page.locator('#top').getByRole('complementary',{name:'Promo pendaftaran'}).count(),0);
    await landingNotice.getByText('S&K promo',{exact:true}).click();
    assert.ok(await landingNotice.getByText(promo.terms,{exact:true}).isVisible());
    assert.match((await page.getByRole('heading',{level:1}).innerText()).replace(/\s+/g,' '),/Kasir, stok, laporan\. Satu tempat\./);
    const signature=await page.getByRole('heading',{level:1}).locator('span').evaluate(element=>({lines:element.getClientRects().length,right:element.getBoundingClientRect().right}));
    assert.equal(signature.lines,1,'Satu tempat must remain one readable phrase');
    assert.ok(signature.right<=width-16,'Headline extends outside safe page width');
    assert.match(await page.locator('body').innerText(),/menu favorit restomu/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(!(await page.locator('body').innerText()).includes('14 hari'));
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:join(artifacts,`landing-hero-${width}.png`)});
    await page.locator('#harga').screenshot({path:join(artifacts,`landing-pricing-${width}.png`)});
    await page.locator('#stok').screenshot({path:join(artifacts,`landing-recipe-${width}.png`)});
    results.push({suite:`landing-cross-origin-${width}`,pass:true});
    mode='cutoff'; await page.reload(); await landingNotice.waitFor({state:'visible'});
    await landingNotice.waitFor({state:'hidden',timeout:5000});
    await page.waitForFunction(()=>document.querySelectorAll('aside[aria-label="Promo pendaftaran"]').length===0);
    assert.equal(await landingNotices.count(),0);
    results.push({suite:`landing-WIB-cutoff-${width}`,pass:true});
    for(const state of ['none','unavailable']) {
      mode=state; await page.reload(); await page.waitForTimeout(250);
      assert.equal(await landingNotices.count(),0);
      assert.ok(await page.getByRole('link',{name:'Coba Rakku',exact:true}).first().isVisible());
      results.push({suite:`landing-${state}-${width}`,pass:true});
    }
    mode='other-plan'; await page.reload(); await page.waitForTimeout(250);
    assert.equal(await landingNotices.count(),0,'Promo paket lain tidak boleh ditampilkan sebagai promo Pro');
    mode='other-duration'; await page.reload(); await landingNotice.waitFor({state:'visible'});
    assert.match(await landingNotice.innerText(),/Gratis 6 bulan untuk pengguna baru/);
    results.push({suite:`landing-plan-and-duration-${width}`,pass:true});
    await context.close();
  }
  if(process.argv.includes('--motion')) {
    const {checkLandingMotion}=await import('./lib/landing-motion-browser.mjs');
    results.push(...await checkLandingMotion(browser,origins.landing,artifacts));
  }
  await writeFile(join(artifacts,'results.json'),JSON.stringify({results,scope:'mocked public promotion responses; actual production-build register/landing UI; blocked DB/providers'},null,2));
  console.log(`PASS ${results.length} browser checks. Artifacts: ${artifacts}`);
} finally {
  await browser?.close();
  for (const child of children.reverse()) {
    if(!child.pid||child.exitCode!==null)continue;
    if(process.platform==='win32')await new Promise(done=>{const stop=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});stop.once('error',done);stop.once('close',done);});
    else child.kill('SIGTERM');
  }
}
