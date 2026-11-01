import {test} from "node:test";
import assert from "node:assert/strict";
import {deflateRawSync} from "node:zlib";
import sharp from "sharp";
import {normalizeImageReference,readImageZip,processProductImage,prepareImageArchive,boundedMap,IMAGE_LIMITS} from "./import-images";
import type {ParsedRow} from "./import-excel";

// A small ZIP fixture writer permits deliberately hostile central/local headers.
function crc32(bytes:Buffer){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function zip(files:{name:string;bytes:Buffer;flags?:number;mode?:number;declaredSize?:number;method?:number;localName?:string}[]){
  const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
  for(const file of files){const name=Buffer.from(file.name),localName=Buffer.from(file.localName??file.name),method=file.method??0,data=method===8?deflateRawSync(file.bytes):file.bytes;
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(file.flags??0,6);header.writeUInt16LE(method,8);header.writeUInt32LE(crc32(file.bytes),14);
    header.writeUInt32LE(data.length,18);header.writeUInt32LE(file.declaredSize??file.bytes.length,22);header.writeUInt16LE(localName.length,26);
    local.push(header,localName,data);const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(0x0314,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(file.flags??0,8);entry.writeUInt16LE(method,10);
    entry.writeUInt32LE(crc32(file.bytes),16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(file.declaredSize??file.bytes.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(((file.mode??0x8000)<<16)>>>0,38);entry.writeUInt32LE(offset,42);
    central.push(entry,name);offset+=header.length+localName.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
const png=()=>sharp({create:{width:30,height:70,channels:3,background:"#8f4a32"}}).png().toBuffer();
test("ZIP image paths reject traversal, absolute/drive/backslash/URL and normalized duplicates",async()=>{
  const bytes=await png();
  for(const name of ["../a.png","a/../b.png","/a.png","C:/a.png","a\\b.png","https://site/a.png","a//b.png","a/./b.png","a.png ","a.zip","a.xlsx"]){
    assert.throws(()=>normalizeImageReference(name));assert.throws(()=>readImageZip(zip([{name,bytes}])));
  }
  assert.equal(normalizeImageReference("Foto/KOPI.PNG"),"foto/kopi.png");
  assert.throws(()=>readImageZip(zip([{name:"A.png",bytes},{name:"a.PNG",bytes}])));
  assert.throws(()=>readImageZip(zip([{name:"Ａ.png",bytes,flags:0x800},{name:"A.png",bytes}])));
});
test("ZIP rejects encryption, symlinks, nested files, mismatched local headers, bomb ratios, count and truncated/CRC corrupt data",async()=>{
  const bytes=await png();
  for(const file of [
    {name:"a.png",bytes,flags:1},{name:"a.png",bytes,mode:0xa000},{name:"a.png",bytes:Buffer.from("PK\x03\x04nested")},
    {name:"a.png",bytes,localName:"b.png"},{name:"a.png",bytes,declaredSize:IMAGE_LIMITS.fileBytes+1},
    {name:"a.png",bytes:Buffer.alloc(1024*1024),method:8},
  ]) assert.throws(()=>readImageZip(zip([file])));
  assert.throws(()=>readImageZip(zip(Array.from({length:121},(_,i)=>({name:`${i}.png`,bytes})))));
  const archive=zip([{name:"a.png",bytes}]);assert.throws(()=>readImageZip(archive.subarray(0,archive.length-1)));
  archive[35]^=1;assert.throws(()=>readImageZip(archive));
});
test("sharp validates signature/full decode, strips orientation, bounds both dimensions, preserves aspect and never upscales",async()=>{
  const small=await processProductImage(await png(),"small.png");assert.deepEqual([small.width,small.height],[30,70]);assert.equal((await sharp(small.bytes).metadata()).format,"webp");
  const portrait=await sharp({create:{width:1000,height:2000,channels:3,background:"white"}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const rotated=await processProductImage(portrait,"portrait.jpg");assert.deepEqual([rotated.width,rotated.height],[800,400]);
  const huge=await sharp({create:{width:8193,height:1,channels:3,background:"white"}}).png().toBuffer();await assert.rejects(()=>processProductImage(huge),/8192/);
  await assert.rejects(()=>processProductImage(Buffer.from("not a picture")),/signature/);
  await assert.rejects(async()=>processProductImage((await png()).subarray(0,25)),/rusak/);
  await assert.rejects(async()=>processProductImage(await png(),"wrong.jpg"),/Ekstensi/);
  const frames=Buffer.concat([Buffer.alloc(10*10*3,0),Buffer.alloc(10*10*3,255)]);
  const animated=await sharp(frames,{raw:{width:10,height:20,channels:3,pageHeight:10}}).webp({loop:0,delay:[100,100]}).toBuffer();
  assert.equal((await sharp(animated,{animated:true}).metadata()).pages,2);
  await assert.rejects(()=>processProductImage(animated),/animasi/);
});
test("ZIP references map explicitly, duplicate references share a staged asset, missing files report gambar and unused images are counted",async()=>{
  const bytes=await png();const rows:ParsedRow[]=["foto/a.png","FOTO/A.PNG","missing.png","https://bad/a.png",""].map((reference,i)=>({rowNumber:i+2,payload:{kind:"product",image_reference:reference},errors:[],warnings:[]}));
  const result=await prepareImageArchive(zip([{name:"foto/a.png",bytes},{name:"unused.png",bytes}]),rows);
  assert.deepEqual([result.assets.length,result.summary.files,result.summary.matched,result.summary.unreferenced],[1,2,1,1]);
  assert.equal(rows[0].payload.image_reference_normalized,rows[1].payload.image_reference_normalized);assert.equal(rows[2].errors[0].field,"gambar");assert.equal(rows[3].errors[0].field,"gambar");assert.equal(rows[4].errors.length,0);
});
test("bounded workers settle in-flight work on failure and never exceed configured concurrency",async()=>{
  let active=0,max=0,settled=0;
  await assert.rejects(()=>boundedMap([0,1,2,3],async value=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;settled++;if(value===0)throw new Error("fail");return value;}),/fail/);
  assert.equal(max,2);assert.equal(active,0);assert.equal(settled,2);
});
