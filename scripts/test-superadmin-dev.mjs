import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Start/restart and repeated compilation requests; no login or DB/provider mutation.
const root=fileURLToPath(new URL('../',import.meta.url));
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1',RAKKU_ISOLATED_BUILD:'1',RAKKU_BUILD_DIRECTORY:'.next-hardening-superadmindev',
  DATABASE_URL:'postgresql://blocked:blocked@127.0.0.1:1/blocked?connect_timeout=1',
  NEON_AUTH_BASE_URL:'http://127.0.0.1:1',NEON_AUTH_COOKIE_SECRET:'isolated-dev-auth-secret-at-least-32-characters'};
for(const provider of ['ECHO','SILOS','VESSEL']) {env[`${provider}_API_URL`]='http://127.0.0.1:1';env[`${provider}_API_KEY`]='blocked';}
// Verify the launcher's defaults rather than inheriting the harness's own cap.
delete env.NODE_OPTIONS; delete env.RAKKU_SUPERADMIN_HEAP_MB;
const results=[];
const dir=resolve(root,'.temp/opencode/superadmin-dev-memory');
await mkdir(dir,{recursive:true});
const pause=ms=>new Promise(done=>setTimeout(done,ms));
for(const phase of ['first-start','restart']) {
  const socket=createServer(); await new Promise(done=>socket.listen(0,'127.0.0.1',done));
  const port=socket.address().port; await new Promise(done=>socket.close(done));
  const origin=`http://127.0.0.1:${port}`;
  const args=['--filter','@rakku/superadmin','dev','--hostname','127.0.0.1','--port',String(port)];
  const child=process.platform==='win32'
    ?spawn('cmd.exe',['/d','/s','/c',`pnpm ${args.join(' ')}`],{cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true})
    :spawn('pnpm',args,{cwd:root,env,stdio:['ignore','pipe','pipe']});
  let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{logs+=data;});
  child.on('error',error=>{logs+=String(error);});
  try {
    const started=Date.now();let html='';
    while(Date.now()-started<100000) {
      if(child.exitCode!==null)throw new Error(`${phase}: dev process exited ${child.exitCode}\n${logs}`);
      try {
        const response=await fetch(`${origin}/login`,{signal:AbortSignal.timeout(45000)});
        const text=await response.text();if(response.ok){html=text;break;}
      } catch {}
      await pause(250);
    }
    assert.ok(html.includes('Masuk sebagai Superadmin'),`${phase}: login failed\n${logs}`);
    const assets=[...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(match=>match[1].replaceAll('&amp;','&')))];
    for(const asset of assets) {
      const response=await fetch(new URL(asset,origin),{signal:AbortSignal.timeout(30000)});
      assert.equal(response.status,200,`${phase}: ${asset}`);await response.body?.cancel();
    }
    // Leave enough idle time to catch the background-cache stage in the bug.
    await pause(12000);
    const again=await fetch(`${origin}/login`,{signal:AbortSignal.timeout(30000)});
    assert.equal(again.status,200);await again.body?.cancel();
    assert.equal(child.exitCode,null,`${phase}: dev server died\n${logs}`);
    assert.ok(!/Array buffer allocation failed|heap out of memory|Committing semi space failed|Caching failed for pack/i.test(logs),logs);
    results.push({phase,loginStatus:200,assets:assets.length,elapsedSec:(Date.now()-started)/1000,aliveAfterCacheWrite:true});
    console.log(`PASS ${phase}: /login 200, ${assets.length} assets, server remains alive after idle/cache checks.`);
  } finally {
    await writeFile(resolve(dir,`${phase}.log`),logs);
    if(child.pid&&child.exitCode===null) {
      if(process.platform==='win32')await new Promise(done=>{const kill=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});kill.once('error',done);kill.once('close',done);});
      else {child.kill('SIGTERM');await pause(500);}
    }
  }
}
await writeFile(resolve(dir,'results.json'),JSON.stringify({results,scope:'Superadmin development start/restart and repeated requests with blocked Auth/DB/providers; default memory budget'},null,2));
