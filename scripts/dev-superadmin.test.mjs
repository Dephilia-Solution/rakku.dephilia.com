import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {superadminNodeOptions} from './dev-superadmin.mjs';

function actualHeap(options) {
  return Number(execFileSync(process.execPath,['-e','console.log(require("node:v8").getHeapStatistics().heap_size_limit/1024/1024)'],{
    env:{...process.env,NODE_OPTIONS:options},encoding:'utf8',
  }).trim());
}

test('default memory options are applied by a real Node child process',()=>{
  const options=superadminNodeOptions();
  const limit=actualHeap(options);
  assert.ok(limit>=1024&&limit<1120,`Unexpected heap limit ${limit}`);
  assert.match(options,/--max-semi-space-size=8/);
});
test('existing operator limits and unrelated flags are preserved without duplicates',()=>{
  const options=superadminNodeOptions('--trace-warnings --max_old_space_size=512 --max-semi-space-size=4');
  assert.equal(options,'--trace-warnings --max_old_space_size=512 --max-semi-space-size=4');
  const limit=actualHeap(options); assert.ok(limit>=512&&limit<580);
});
test('explicit project heap override is supported, invalid values fail clearly',()=>{
  assert.match(superadminNodeOptions('', '768'),/--max-old-space-size=768/);
  for(const input of ['0','-1','128','16384','1024 --inspect','invalid'])assert.throws(()=>superadminNodeOptions('',input),/RAKKU_SUPERADMIN_HEAP_MB/);
});

test('development avoids filesystem packs while production retains the default webpack config',async()=>{
  const original=process.env.NODE_ENV, disk=process.env.RAKKU_SUPERADMIN_DISK_CACHE;
  try {
    process.env.NODE_ENV='development';delete process.env.RAKKU_SUPERADMIN_DISK_CACHE;
    const dev=(await import('../apps/superadmin/next.config.mjs?memory-test=dev')).default;
    assert.deepEqual(dev.webpack({cache:{type:'filesystem'}}).cache,{type:'memory',maxGenerations:1});
    process.env.NODE_ENV='production';
    const prod=(await import('../apps/superadmin/next.config.mjs?memory-test=prod')).default;
    assert.equal(prod.webpack,undefined);
    process.env.NODE_ENV='development';process.env.RAKKU_SUPERADMIN_DISK_CACHE='1';
    const optedIn=(await import('../apps/superadmin/next.config.mjs?memory-test=disk')).default;
    assert.equal(optedIn.webpack,undefined);
  } finally {
    if(original===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=original;
    if(disk===undefined)delete process.env.RAKKU_SUPERADMIN_DISK_CACHE;else process.env.RAKKU_SUPERADMIN_DISK_CACHE=disk;
  }
});
