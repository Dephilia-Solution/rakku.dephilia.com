import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

export function superadminNodeOptions(inherited='', heapMb='1024') {
  if (!/^\d+$/.test(heapMb) || Number(heapMb)<256 || Number(heapMb)>8192) throw new Error('RAKKU_SUPERADMIN_HEAP_MB harus berupa angka 256–8192 (MiB).');
  let options=inherited.trim();
  // next dev derives a child heap budget from TOTAL physical RAM unless this
  // option exists in NODE_OPTIONS. CLI-only node flags are overwritten by Next.
  if (!/--max[-_]old[-_]space[-_]size(?:=|\s|$)/.test(options)) options+=` --max-old-space-size=${heapMb}`;
  if (!/--max[-_]semi[-_]space[-_]size(?:=|\s|$)/.test(options)) options+=' --max-semi-space-size=8';
  return options.trim();
}

export function startSuperadmin() {
  const require=createRequire(import.meta.url);
  const cwd=fileURLToPath(new URL('../apps/superadmin/',import.meta.url));
  const next=require.resolve('next/dist/bin/next',{paths:[cwd]});
  const options=superadminNodeOptions(process.env.NODE_OPTIONS,process.env.RAKKU_SUPERADMIN_HEAP_MB);
  console.log('Superadmin dev: explicit Node memory budget (default heap 1024 MiB, semi-space 8 MiB; existing NODE_OPTIONS respected).');
  const args=process.argv.slice(2); if(args[0]==='--')args.shift();
  const child=spawn(process.execPath,[next,'dev','--webpack','-p','3002',...args],{
    cwd,stdio:'inherit',env:{...process.env,NODE_OPTIONS:options},
  });
  const stop=signal=>{if(child.exitCode===null&&!child.killed)child.kill(signal);};
  const interrupt=()=>stop('SIGINT'), terminate=()=>stop('SIGTERM');
  process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);
  child.once('error',error=>{console.error(error.message);process.exitCode=1;});
  child.once('exit',(code,signal)=>{
    process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);
    process.exitCode=code??(signal==='SIGINT'?130:1);
  });
  return child;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startSuperadmin();
