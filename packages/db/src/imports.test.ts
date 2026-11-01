import { test,before,after,beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync,readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql,type SQL } from "drizzle-orm";
import { DatabaseClient,type Catalog,type Row } from "./query";
import { loadCatalog } from "./index";
import { confirmImport,stageImport,ImportError,importPurchaseHash,type StagedImportRow,type ImportDomain,type ImportConflictMode } from "./imports";
import { recordPurchase } from "../../inventory/src/index";
import { prepareImportAssets,cleanupImportAssets,cleanupExpiredImports,findImportCleanupCompanies,releaseImportAssetLease,type ImportAssetProvider } from "../../../apps/owner/src/lib/import/import-assets";
import { buildTemplateWorkbook,parseWorkbook,validateRows,IMPORT_HEADERS } from "../../../apps/owner/src/lib/import/import-excel";
import { createRequire } from "node:module";
import { Buffer } from "node:buffer";
const requireOwner=createRequire(new URL("../../../apps/owner/package.json",import.meta.url));
const ExcelJS=requireOwner("exceljs");

const pg=new PGlite(),dialect=new PgDialect();let catalog:Catalog;
const executor=(connection:Pick<PGlite,"query">)=>(query:SQL):Promise<Row[]>=>{const compiled=dialect.sqlToQuery(query);return connection.query<Row>(compiled.sql,compiled.params).then(result=>result.rows)};
const execute=executor(pg),db=new DatabaseClient(execute,async()=>catalog,work=>pg.transaction(tx=>work(new DatabaseClient(executor(tx),async()=>catalog))));
let companyId:string,ownerId:string,outletId:string,otherCompany:string,otherOutlet:string,categoryId:string;
before(async()=>{
  for(const filename of readdirSync(new URL("../migrations/",import.meta.url)).filter(file=>/^\d+_.*\.sql$/.test(file)).sort())await pg.exec(readFileSync(new URL(`../migrations/${filename}`,import.meta.url),"utf8"));
  catalog=await loadCatalog(execute);await execute(sql`select set_config('app.scope','platform',false)`);
  const tenant=async(code:string)=>{const [owner]=await execute(sql`insert into public.owners(email,name,password_hash) values(${code+"@example.test"},${code},'hash') returning id`);
    const [company]=await execute(sql`insert into public.companies(code,name,password_hash,owner_id) values(${code},${code},'hash',${owner.id}) returning id`);
    const [outlet]=await execute(sql`insert into public.outlets(company_id,name) values(${company.id},'Outlet') returning id`);
    return {owner:String(owner.id),company:String(company.id),outlet:String(outlet.id)};};
  const a=await tenant("IMP-A"),b=await tenant("IMP-B");ownerId=a.owner;companyId=a.company;outletId=a.outlet;otherCompany=b.company;otherOutlet=b.outlet;
  categoryId=String((await db.from("categories").insert({company_id:companyId,outlet_id:outletId,name:"Makanan"}).select("id").single()).data.id);
});
after(()=>pg.close());
// Scenarios share business fixtures, but abandoned previews belong to previous scenarios.
beforeEach(async()=>{
  await execute(sql`update app_private.import_batches set status='failed',expires_at=now()-interval '1 second',image_lease_token=null,image_lease_until=null where status='validated'`);
  // Provider IDs in this database are mocks; discard abandoned assets between scenarios.
  await execute(sql`update app_private.import_assets set state='deleted',provider_file_id=null,provider_url=null,processed_base64=null where state<>'attached'`);
});
const product=(code:string,name="Nasi",category="Makanan",price=18000):StagedImportRow=>({rowNumber:2,payload:{kind:"product",sheet_name:"Produk",sheet_row:2,code,name,category_name:category,price,description:""},errors:[],warnings:[]});
const ingredient=(code:string,name="Beras",stock=1000,cost=16,minimum=100,unit="gram"):StagedImportRow=>({rowNumber:2,payload:{kind:"ingredient",sheet_name:"Bahan Baku",sheet_row:2,code,name,unit,stock_quantity:stock,cost_per_unit:cost,min_stock_alert:minimum},errors:[],warnings:[]});
const recipe=(productCode:string,ingredientCode:string,quantity=150,row=2):StagedImportRow=>({rowNumber:100000+row,payload:{kind:"recipe",linked_workbook:true,sheet_name:"Komposisi",sheet_row:row,product_code:productCode,ingredient_code:ingredientCode,quantity_used:quantity},errors:[],warnings:[]});
const stage=(rows:StagedImportRow[],domain:ImportDomain="products")=>stageImport(db,{companyId,domain,outletId:domain==="employees"?null:outletId,fileName:"menu.xlsx",rows});
const confirm=(batchId:string,options:{conflictMode?:ImportConflictMode;allowNewCategories?:boolean;checkQuota?:(tx:DatabaseClient,domain:ImportDomain,count:number)=>Promise<boolean>}={})=>confirmImport(db,{companyId,ownerId,batchId,allowNewCategories:true,checkQuota:async()=>true,...options});
const count=async(query:SQL)=>Number((await execute(query))[0].n);

test("pending previews are bounded per company and expired previews do not consume capacity",async()=>{
  for(let index=0;index<10;index++)await stage([product(`PENDING-${index}`)]);
  await assert.rejects(()=>stage([product("PENDING-OVER")]),(error:unknown)=>error instanceof ImportError&&error.code==="IMPORT_PENDING_LIMIT");
  await execute(sql`update app_private.import_batches set expires_at=now()-interval '1 second' where company_id=${companyId} and status='validated'`);
  assert.ok(await stage([product("PENDING-AFTER-EXPIRY")]));
});

test("new business-code product import commits and a repeated confirmation is idempotent",async()=>{
  const batch=await stage([product("PRD-001")]);assert.equal((await confirm(batch)).created,1);assert.equal((await confirm(batch)).replayed,true);
  assert.equal((await execute(sql`select code from public.products where code='PRD-001'`))[0].code,"PRD-001");assert.equal(await count(sql`select count(*)::int as n from public.products where code='PRD-001'`),1);
});
test("a staged batch cannot be read or confirmed by another company",async()=>{
  const batch=await stage([product("PRD-FOREIGN")]);await assert.rejects(()=>confirmImport(db,{companyId:otherCompany,ownerId,batchId:batch,checkQuota:async()=>true}),(e:unknown)=>e instanceof ImportError&&e.status===404);
});
test("new categories require explicit consent and case-equivalent product rows create only one category",async()=>{
  const batch=await stage([product("PRD-CAT-A","One","Paket Baru"),{...product("PRD-CAT-B","Two","paket baru"),rowNumber:3}]);
  await assert.rejects(()=>confirm(batch,{allowNewCategories:false}),(e:unknown)=>e instanceof ImportError&&e.code==="IMPORT_CATEGORY_CONFIRMATION_REQUIRED");
  assert.equal(await count(sql`select count(*)::int as n from public.products where code in ('PRD-CAT-A','PRD-CAT-B')`),0);
  const result=await confirm(batch,{allowNewCategories:true});assert.deepEqual([result.created,result.categories_created],[2,1]);
  assert.equal(await count(sql`select count(*)::int as n from public.categories where outlet_id=${outletId} and lower(name)='paket baru'`),1);
});
test("actual XLSX template preview and confirmation saves typed categories and code-linked composition end-to-end",async()=>{
  const [rice]=await execute(sql`insert into public.ingredients(company_id,outlet_id,code,name,unit,stock_quantity,cost_per_unit)
    values(${companyId},${outletId},'BHN-E2E','Rice','gram',1000,16) returning id`);
  const bytes=await buildTemplateWorkbook("products",["Makanan"]), workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  workbook.getWorksheet("Produk").addRow(["PRD-E2E","Rice bowl","Kategori Baru",18000,"Lunch"]);
  workbook.getWorksheet("Komposisi").addRow(["PRD-E2E","BHN-E2E",150]);
  const encoded=Buffer.from(await workbook.xlsx.writeBuffer());
  const parsed=parseWorkbook(encoded.buffer.slice(encoded.byteOffset,encoded.byteOffset+encoded.byteLength) as ArrayBuffer,"products");
  validateRows("products",parsed.rows,{existingIngredientCodes:new Map([["bhn-e2e",{id:rice.id,code:"BHN-E2E",name:"Rice",unit:"gram",is_active:true}]]),
    existingCategories:new Map([["makanan",{id:categoryId,name:"Makanan"}]]),existingProductCodes:new Map()});
  assert.deepEqual(parsed.visibleSheets,["Produk","Komposisi"]);assert.ok(parsed.rows.every(row=>!row.errors.length));
  assert.equal(parsed.rows.find(row=>row.payload.kind==="product")?.payload.category_is_new,true);
  const batch=await stage(parsed.rows), result=await confirm(batch,{allowNewCategories:true});
  assert.deepEqual([result.created,result.categories_created,result.recipes],[1,1,1]);
  const [saved]=await execute(sql`select p.code,p.name,c.name as category,r.quantity_used from public.product_recipes r join public.products p on p.id=r.product_id join public.categories c on c.id=p.category_id where p.code='PRD-E2E'`);
  assert.deepEqual([saved.code,saved.name,saved.category,Number(saved.quantity_used)],["PRD-E2E","Rice bowl","Kategori Baru",150]);
});
test("conflict default skips; explicit update changes fields but preserves the established business code",async()=>{
  await confirm(await stage([product("PRD-SAME","Original")]));const [before]=await execute(sql`select id,code from public.products where code='PRD-SAME'`);
  const skipped=await confirm(await stage([product("prd-same","Ignored")]));assert.equal(skipped.skipped,1);assert.equal((await execute(sql`select name from public.products where id=${before.id}`))[0].name,"Original");
  assert.equal((await confirm(await stage([product("PRD-SAME","Updated", "Makanan",24000)]),{conflictMode:"update"})).updated,1);
  const [after]=await execute(sql`select id,code,name,price from public.products where id=${before.id}`);
  assert.deepEqual([after.id,after.code,after.name,Number(after.price)],[before.id,"PRD-SAME","Updated",24000]);
});
test("outlet-scoped business codes are case-insensitively unique and allow another outlet to reuse them",async()=>{
  await confirm(await stage([product("PRD-CASE")]));assert.equal((await confirm(await stage([product("prd-case","ignored")]))).skipped,1);
  await assert.rejects(()=>db.execute(sql`insert into public.products(company_id,outlet_id,code,name,category_id) values(${companyId},${outletId},'prd-case','duplicate',${categoryId})`));
  const [category]=await execute(sql`insert into public.categories(company_id,outlet_id,name) values(${otherCompany},${otherOutlet},'Food') returning id`);
  const [valid]=await execute(sql`insert into public.products(company_id,outlet_id,code,name,category_id) values(${otherCompany},${otherOutlet},'PRD-CASE','Different outlet',${category.id}) returning id`);assert.ok(valid.id);
  await execute(sql`insert into public.ingredients(company_id,outlet_id,code,name,unit) values(${companyId},${outletId},'BHN-CASE','A','gram')`);
  await assert.rejects(()=>db.execute(sql`insert into public.ingredients(company_id,outlet_id,code,name,unit) values(${companyId},${outletId},'bhn-case','B','gram')`));
});
test("new ingredients store code, stock-opening movement and correct Owner attribution",async()=>{
  const result=await confirm(await stage([ingredient("BHN-RICE")],"ingredients"));assert.equal(result.created,1);
  const [item]=await execute(sql`select id,code,stock_quantity,cost_per_unit from public.ingredients where code='BHN-RICE' and outlet_id=${outletId}`);
  assert.deepEqual([item.code,Number(item.stock_quantity),Number(item.cost_per_unit)],["BHN-RICE",1000,16]);
  const [movement]=await execute(sql`select created_by,created_by_owner_id,quantity_change from public.stock_movements where ingredient_id=${item.id}`);
  assert.deepEqual([movement.created_by,movement.created_by_owner_id,Number(movement.quantity_change)],[null,ownerId,1000]);
});
test("ingredient conflict skips or updates metadata without changing actual stock",async()=>{
  const [old]=await execute(sql`insert into public.ingredients(company_id,outlet_id,code,name,unit,stock_quantity,cost_per_unit,min_stock_alert) values(${companyId},${outletId},'BHN-OLD','Old rice','gram',-25,12,100) returning id`);
  const row=ingredient("bhn-old","New rice",9999,20,500);assert.equal((await confirm(await stage([row],"ingredients"))).skipped,1);
  await confirm(await stage([row],"ingredients"),{conflictMode:"update"});const [saved]=await execute(sql`select code,name,unit,stock_quantity,cost_per_unit,min_stock_alert from public.ingredients where id=${old.id}`);
  assert.deepEqual([saved.code,saved.name,saved.unit,Number(saved.stock_quantity),Number(saved.cost_per_unit),Number(saved.min_stock_alert)],["BHN-OLD","New rice","gram",-25,20,500]);
});
test("product workbook resolves composition codes only inside its outlet",async()=>{
  await execute(sql`insert into public.ingredients(company_id,outlet_id,code,name,unit) values(${otherCompany},${otherOutlet},'BHN-CROSS','Foreign','gram')`);
  const cross=await stage([product("PRD-CROSS"),recipe("PRD-CROSS","BHN-CROSS")]);
  await assert.rejects(()=>confirm(cross),/BHN-CROSS/);
  await execute(sql`insert into public.ingredients(company_id,outlet_id,code,name,unit) values(${companyId},${outletId},'BHN-LOCAL','Rice','gram')`);
  const batch=await stage([product("PRD-COMPOSED","Rice bowl"),recipe("PRD-COMPOSED","BHN-LOCAL",150)]);assert.equal((await confirm(batch)).recipes,1);
  const [row]=await execute(sql`select p.code,i.code as ingredient_code,r.quantity_used from public.product_recipes r join public.products p on p.id=r.product_id join public.ingredients i on i.id=r.ingredient_id where p.code='PRD-COMPOSED'`);
  assert.deepEqual([row.code,row.ingredient_code,Number(row.quantity_used)],["PRD-COMPOSED","BHN-LOCAL",150]);
});
test("a Komposisi-only workbook may update an existing product by code; default skip preserves the stored recipe",async()=>{
  const [ingredientId]=await execute(sql`insert into public.ingredients(company_id,outlet_id,code,name,unit) values(${companyId},${outletId},'BHN-COMP','Coffee','gram') returning id`);
  await confirm(await stage([product("PRD-ONLY","Coffee"),recipe("PRD-ONLY","BHN-COMP",18)]));
  assert.equal((await confirm(await stage([recipe("PRD-ONLY","BHN-COMP",30)]))).skipped,1);
  assert.equal(Number((await execute(sql`select quantity_used from public.product_recipes where ingredient_id=${ingredientId.id}`))[0].quantity_used),18);
  const result=await confirm(await stage([recipe("PRD-ONLY","BHN-COMP",24)]),{conflictMode:"update"});assert.equal(result.recipes,1);
  assert.equal(Number((await execute(sql`select quantity_used from public.product_recipes where ingredient_id=${ingredientId.id}`))[0].quantity_used),24);
});
test("linked product+recipe write rolls back as a whole after any database error",async()=>{
  await execute(sql`insert into public.ingredients(company_id,outlet_id,code,name,unit) values(${companyId},${outletId},'BHN-ROLLBACK','Rice','gram')`);
  const batch=await stage([product("PRD-ROLLBACK"),recipe("PRD-ROLLBACK","BHN-ROLLBACK",4)]);
  await pg.exec(`create function public.fail_import_recipe() returns trigger language plpgsql as $$ begin raise exception 'recipe failure'; end $$;
    create trigger fail_import_recipe before insert on public.product_recipes for each row execute function public.fail_import_recipe();`);
  try {await assert.rejects(()=>confirm(batch),/recipe failure/);assert.equal(await count(sql`select count(*)::int as n from public.products where code='PRD-ROLLBACK'`),0);
    assert.equal((await execute(sql`select status from app_private.import_batches where id=${batch}`))[0].status,"validated");}
  finally {await pg.exec("drop trigger fail_import_recipe on public.product_recipes;drop function public.fail_import_recipe();");}
});
test("employee username conflict is explicitly skipped or updated, preserving login identity",async()=>{
  const [role]=await execute(sql`insert into public.roles(company_id,name) values(${companyId},'Kasir') returning id`);
  const employee=(name:string,pin:string,rowNumber=2):StagedImportRow=>({rowNumber,payload:{kind:"employee",name,username:"cashier",role_name:"Kasir",outlet_names:["Outlet"],pin_hash:pin},errors:[],warnings:[]});
  const batch=await stage([employee("Cashier","old-pin")],"employees");await confirm(batch);
  assert.equal((await confirm(await stage([employee("New Name","ignored")],"employees"))).skipped,1);
  const update=await confirm(await stage([employee("Cashier updated","new-pin")],"employees"),{conflictMode:"update"});assert.equal(update.updated,1);
  const [saved]=await execute(sql`select id,name,username,role_id,pin_hash from public.users where company_id=${companyId} and username='cashier'`);
  assert.deepEqual([saved.name,saved.username,saved.role_id,saved.pin_hash],["Cashier updated","cashier",role.id,"new-pin"]);
});

test("confirmation persists exact counts/options/owner, expiration blocks writes and replay retains updated/skipped/recipe counts",async()=>{
  await confirm(await stage([product("PRD-REPLAY","Before")]));
  const batch=await stageImport(db,{companyId,ownerId,domain:"products",outletId,fileName:"replay.xlsx",rows:[product("PRD-REPLAY","After"),{...product("PRD-REPLAY-NEW"),rowNumber:3}]});
  const first=await confirm(batch,{conflictMode:"update",allowNewCategories:false});assert.deepEqual([first.created,first.updated],[1,1]);
  const replay=await confirm(batch,{conflictMode:"skip",allowNewCategories:true});assert.deepEqual(replay,{...first,replayed:true});
  const [saved]=await execute(sql`select confirmation_options,confirmation_result,created_by_owner_id,confirmed_by_owner_id from app_private.import_batches where id=${batch}`);
  assert.deepEqual(saved.confirmation_result,first);assert.deepEqual(saved.confirmation_options,{conflict_mode:"update",allow_new_categories:false});
  assert.deepEqual([saved.created_by_owner_id,saved.confirmed_by_owner_id],[ownerId,ownerId]);
  const expired=await stage([product("PRD-EXPIRED")]);await execute(sql`update app_private.import_batches set expires_at=now()-interval '1 minute' where id=${expired}`);
  await assert.rejects(()=>confirm(expired),(e:unknown)=>e instanceof ImportError&&e.code==="IMPORT_EXPIRED");assert.equal(await count(sql`select count(*)::int as n from public.products where code='PRD-EXPIRED'`),0);
});

test("v2 stable tiers merge supplied prices without wiping omitted historical prices; blank new tiers fall back to base price",async()=>{
  const [a]=await execute(sql`insert into public.pricing_tiers(company_id,outlet_id,name,slug) values(${companyId},${outletId},'Dine In','import-dine') returning id,name,slug`);
  const [b]=await execute(sql`insert into public.pricing_tiers(company_id,outlet_id,name,slug) values(${companyId},${outletId},'Delivery','import-delivery') returning id,name,slug`);
  const [inactive]=await execute(sql`insert into public.pricing_tiers(company_id,outlet_id,name,slug,is_active) values(${companyId},${outletId},'Historical','import-old',false) returning id`);
  const tiers=[a,b].map(tier=>({...tier,header:`harga_tier:${tier.slug}`}));
  const metadata={schema_version:2,domain:"products",company_id:companyId,outlet_id:outletId,tiers};
  const v2=async(code:string,values:(number|null)[])=>{
    const row=product(code,"Tier product","Makanan",0.29);row.payload.tier_prices=tiers.map((tier,i)=>({...tier,price:values[i]}));
    return stageImport(db,{companyId,ownerId,domain:"products",outletId,fileName:"v2.xlsx",schemaVersion:2,context:{metadata,linked:true},rows:[row]});
  };
  const first=await confirm(await v2("PRD-TIER",[5.67,null]));assert.equal(first.tier_prices,1);
  const [p]=await execute(sql`select id from public.products where code='PRD-TIER'`);
  assert.equal(await count(sql`select count(*)::int as n from public.product_tier_prices where product_id=${p.id}`),1);
  await execute(sql`insert into public.product_tier_prices(product_id,tier_id,price) values(${p.id},${inactive.id},9.99)`);
  await confirm(await v2("PRD-TIER",[null,12.34]),{conflictMode:"update"});
  const saved=await execute(sql`select tier_id,price from public.product_tier_prices where product_id=${p.id}`);
  const prices=new Map(saved.map(row=>[row.tier_id,Number(row.price)]));assert.deepEqual([prices.get(a.id),prices.get(b.id),prices.get(inactive.id)],[5.67,12.34,9.99]);
  const stale=await v2("PRD-TIER-STALE",[1,2]);await execute(sql`update public.pricing_tiers set name='Renamed' where id=${a.id}`);
  await assert.rejects(()=>confirm(stale),(e:unknown)=>e instanceof ImportError&&e.code==="IMPORT_TIERS_STALE");
  assert.equal(await count(sql`select count(*)::int as n from public.products where code='PRD-TIER-STALE'`),0);
  await execute(sql`update public.pricing_tiers set name='Dine In' where id=${a.id}`);
  await execute(sql`delete from public.pricing_tiers where id=${b.id}`);
  await execute(sql`insert into public.pricing_tiers(company_id,outlet_id,name,slug) values(${companyId},${outletId},'Delivery','import-delivery')`);
  await assert.rejects(()=>confirm(stale),(e:unknown)=>e instanceof ImportError&&e.code==="IMPORT_TIERS_STALE");
});

const purchase=(code:string,rowNumber=2,date="2026-11-01"):StagedImportRow=>({rowNumber,payload:{kind:"purchase",sheet_name:"Pembelian",sheet_row:rowNumber,linked_workbook:true,code,date:`${date}T00:00:00+07:00`,supplier:"Supplier",note:"Import"},errors:[]});
const purchaseLine=(purchaseCode:string,ingredientCode:string,quantity=1,cost=2,rowNumber=100002,unit="gram"):StagedImportRow=>({rowNumber,payload:{kind:"purchase_line",sheet_name:"Detail Pembelian",sheet_row:rowNumber-100000,linked_workbook:true,purchase_code:purchaseCode,ingredient_code:ingredientCode,quantity,unit_cost:cost,unit},errors:[]});
const purchaseConfirm=(batchId:string,advanced=true)=>confirmImport(db,{companyId,ownerId,batchId,allowNewCategories:false,checkQuota:async()=>true,checkInventoryAdvanced:async()=>advanced,recordPurchase});
test("purchase workbook uses inventory service atomically, durable reference dedupe across reuploads and deterministic last-header cost",async()=>{
  const [item]=await execute(sql`insert into public.ingredients(company_id,outlet_id,code,name,unit,stock_quantity,cost_per_unit) values(${companyId},${outletId},'BHN-PO','Rice','gram',10,1) returning id`);
  const rows=[purchase("PO-A"),purchase("PO-B",3,"2025-01-01"),purchaseLine("PO-A","BHN-PO",0.29,12.34),purchaseLine("PO-B","BHN-PO",2,99,100003)];
  const batch=await stage(rows,"purchases");const result=await purchaseConfirm(batch);
  assert.equal(result.created,2);assert.equal(result.purchases.length,2);assert.ok(result.purchases.every(p=>p.id));
  let [stock]=await execute(sql`select stock_quantity,cost_per_unit from public.ingredients where id=${item.id}`);assert.deepEqual([Number(stock.stock_quantity),Number(stock.cost_per_unit)],[12.29,99]);
  const purchases=await execute(sql`select created_by_owner_id,purchase_date from public.ingredient_purchases where id=${result.purchases[0].id}`);
  assert.equal(purchases[0].created_by_owner_id,ownerId);assert.equal(new Date(purchases[0].purchase_date).toISOString(),"2026-10-31T17:00:00.000Z");
  assert.deepEqual(await purchaseConfirm(batch),{...result,replayed:true});
  const reupload=await purchaseConfirm(await stage(rows,"purchases"));assert.deepEqual([reupload.created,reupload.skipped],[0,2]);
  [stock]=await execute(sql`select stock_quantity,cost_per_unit from public.ingredients where id=${item.id}`);assert.deepEqual([Number(stock.stock_quantity),Number(stock.cost_per_unit)],[12.29,99]);
  const changed=await stage([purchase("PO-A"),purchaseLine("PO-A","BHN-PO",3,12.34)],"purchases");await assert.rejects(()=>purchaseConfirm(changed),/isi berbeda/);
  const [reference]=await execute(sql`select payload_hash from app_private.import_purchase_references where company_id=${companyId} and outlet_id=${outletId} and reference='PO-A'`);
  assert.equal(reference.payload_hash,importPurchaseHash(rows[0],rows.slice(2)));assert.equal(await count(sql`select count(*)::int as n from public.stock_movements where ingredient_id=${item.id} and type='purchase'`),2);
});
test("purchase confirm rechecks feature, active scoped refs/exact unit, detail bounds and rolls back all headers on a later failure",async()=>{
  const [item]=await execute(sql`insert into public.ingredients(company_id,outlet_id,code,name,unit,stock_quantity) values(${companyId},${outletId},'BHN-PO-ROLL','Rice','gram',5) returning id`);
  const batch=await stage([purchase("PO-ROLL-1"),purchase("PO-ROLL-2",3),purchaseLine("PO-ROLL-1","BHN-PO-ROLL",2,3),purchaseLine("PO-ROLL-2","BHN-PO-ROLL",1,5,100003)],"purchases");
  await assert.rejects(()=>purchaseConfirm(batch,false),(e:unknown)=>e instanceof ImportError&&e.code==="PLAN_LIMIT");
  await execute(sql`update public.ingredients set is_active=false where id=${item.id}`);await assert.rejects(()=>purchaseConfirm(batch),/aktif/);await execute(sql`update public.ingredients set is_active=true where id=${item.id}`);
  let calls=0;await assert.rejects(()=>confirmImport(db,{companyId,ownerId,batchId:batch,checkQuota:async()=>true,checkInventoryAdvanced:async()=>true,
    recordPurchase:async(tx,input)=>{calls++;if(calls===2)throw new Error("late purchase failure");return recordPurchase(tx,input);}}),/late purchase failure/);
  assert.equal(Number((await execute(sql`select stock_quantity from public.ingredients where id=${item.id}`))[0].stock_quantity),5);
  assert.equal(await count(sql`select count(*)::int as n from app_private.import_purchase_references where reference in ('PO-ROLL-1','PO-ROLL-2')`),0);
  assert.equal(await count(sql`select count(*)::int as n from public.stock_movements where ingredient_id=${item.id}`),0);
  await assert.rejects(async()=>purchaseConfirm(await stage([purchase("PO-UNIT"),purchaseLine("PO-UNIT","BHN-PO-ROLL",1,2,100002,"kg")],"purchases")),/satuan/);
  await assert.rejects(async()=>purchaseConfirm(await stage([purchase("PO-CROSS"),purchaseLine("PO-CROSS","BHN-CROSS")],"purchases")),/aktif/);
  await assert.rejects(async()=>purchaseConfirm(await stage([purchase("PO-EMPTY")],"purchases")),/1–100/);
  const dup=await stage([purchase("PO-DUP"),purchaseLine("PO-DUP","BHN-PO-ROLL"),purchaseLine("PO-DUP","BHN-PO-ROLL",1,2,100003)],"purchases");await assert.rejects(()=>purchaseConfirm(dup),/duplikat/);
  const bad=product("PRD-STRUCTURAL");const structural=await stageImport(db,{companyId,domain:"products",outletId,fileName:"bad.xlsx",context:{structural_errors:[{message:"wrong header"}]},rows:[bad]});
  await assert.rejects(()=>confirm(structural),(e:unknown)=>e instanceof ImportError&&e.code==="IMPORT_STRUCTURE_INVALID");
});

function mockProvider(){
  const uploaded:string[]=[],deleted:string[]=[];let failDelete=false;
  const provider:ImportAssetProvider={uploadFile:async()=>{const id=`mock-${uploaded.length+1}`;uploaded.push(id);return{id,url:`https://images.example.test/${id}.webp`};},
    deleteFile:async id=>{if(failDelete)throw new Error("delete unavailable");deleted.push(id);}};
  return{provider,uploaded,deleted,setFailDelete:(value:boolean)=>{failDelete=value;}};
}
async function imageBatch(code:string,extra:StagedImportRow[]=[]){
  const image=await requireOwner("sharp")({create:{width:20,height:30,channels:3,background:"white"}}).webp().toBuffer();
  const row=product(code);row.payload.image_reference="photo.png";row.payload.image_reference_normalized="photo.png";
  return stageImport(db,{companyId,ownerId,domain:"products",outletId,fileName:"images.xlsx",context:{linked:true},rows:[row,...extra],assets:[{reference:"photo.png",bytes:image,width:20,height:30}]});
}
test("durable staged images reuse uploaded IDs after a lost request, attach atomically and replay without uploading again",async()=>{
  const batch=await imageBatch("PRD-IMAGE"),scope={companyId,ownerId,batchId:batch},mock=mockProvider();
  const first=await prepareImportAssets(db,scope,mock.provider);assert.ok(first);assert.equal(mock.uploaded.length,1);
  await assert.rejects(()=>prepareImportAssets(db,scope,mock.provider),(e:unknown)=>e instanceof ImportError&&e.code==="IMPORT_BUSY");
  await assert.rejects(()=>prepareImportAssets(db,{...scope,companyId:otherCompany},mock.provider),(e:unknown)=>e instanceof ImportError&&e.status===404);
  await releaseImportAssetLease(db,scope,first!);const retry=await prepareImportAssets(db,scope,mock.provider);assert.equal(mock.uploaded.length,1);
  const result=await confirmImport(db,{companyId,ownerId,batchId:batch,imageLeaseToken:retry!,checkQuota:async()=>true});assert.equal(result.images,1);
  await cleanupImportAssets(db,scope,mock.provider,retry!,true);await releaseImportAssetLease(db,scope,retry!);assert.equal(mock.deleted.length,0);
  const [saved]=await execute(sql`select image_url,image_silo_id from public.products where code='PRD-IMAGE'`);assert.deepEqual([saved.image_url,saved.image_silo_id],["https://images.example.test/mock-1.webp","mock-1"]);
  const [asset]=await execute(sql`select state,processed_base64 from app_private.import_assets where batch_id=${batch}`);assert.deepEqual([asset.state,asset.processed_base64],["attached",null]);
  assert.equal(await prepareImportAssets(db,scope,mock.provider),null);assert.equal((await confirm(batch)).images,1);
});
test("failed image-backed confirmation cleans new orphans durably, retains retry bytes and expiry scrubs bytes/PIN hashes",async()=>{
  const batch=await imageBatch("PRD-IMAGE-FAIL",[recipe("PRD-IMAGE-FAIL","MISSING")]),scope={companyId,ownerId,batchId:batch},mock=mockProvider();
  let token=await prepareImportAssets(db,scope,mock.provider);
  await assert.rejects(()=>confirmImport(db,{companyId,ownerId,batchId:batch,imageLeaseToken:token!,checkQuota:async()=>true}),/MISSING/);
  assert.equal(await count(sql`select count(*)::int as n from public.products where code='PRD-IMAGE-FAIL'`),0);
  mock.setFailDelete(true);await cleanupImportAssets(db,scope,mock.provider,token!,true);await releaseImportAssetLease(db,scope,token!);
  let [asset]=await execute(sql`select state,provider_file_id,processed_base64 from app_private.import_assets where batch_id=${batch}`);assert.equal(asset.state,"cleanup_pending");assert.equal(asset.provider_file_id,"mock-1");assert.ok(asset.processed_base64);
  mock.setFailDelete(false);token=await prepareImportAssets(db,scope,mock.provider);assert.equal(mock.deleted.length,1);assert.equal(mock.uploaded.length,2);
  await releaseImportAssetLease(db,scope,token!);await execute(sql`update app_private.import_batches set expires_at=now()-interval '1 second' where id=${batch}`);
  assert.ok((await findImportCleanupCompanies(db)).some(row=>row.id===companyId),"scheduled cleanup must discover expired company batches");
  await execute(sql`update app_private.import_rows set payload=payload||'{"pin_hash":"secret"}'::jsonb where batch_id=${batch}`);
  await cleanupExpiredImports(db,companyId,ownerId,mock.provider);
  [asset]=await execute(sql`select state,provider_file_id,processed_base64 from app_private.import_assets where batch_id=${batch}`);assert.deepEqual([asset.state,asset.provider_file_id,asset.processed_base64],["deleted",null,null]);
  assert.equal((await execute(sql`select payload ? 'pin_hash' as has_pin from app_private.import_rows where batch_id=${batch} limit 1`))[0].has_pin,false);
  assert.equal((await execute(sql`select status from app_private.import_batches where id=${batch}`))[0].status,"failed");
});

test("multiple product rows can share one staged image; skipped uploads left after commit are recovered without touching attached files",async()=>{
  const second=product("PRD-IMAGE-SHARED-B");second.rowNumber=3;second.payload.image_reference="photo.png";second.payload.image_reference_normalized="photo.png";
  const batch=await imageBatch("PRD-IMAGE-SHARED-A",[second]),scope={companyId,ownerId,batchId:batch},mock=mockProvider();
  const token=await prepareImportAssets(db,scope,mock.provider);
  const saved=await confirmImport(db,{companyId,ownerId,batchId:batch,imageLeaseToken:token!,checkQuota:async()=>true});assert.equal(saved.images,2);assert.equal(mock.uploaded.length,1);
  await cleanupImportAssets(db,scope,mock.provider,token!,true);await releaseImportAssetLease(db,scope,token!);assert.equal(mock.deleted.length,0);
  const skipped=await imageBatch("PRD-IMAGE-SHARED-A"),skippedScope={companyId,ownerId,batchId:skipped};
  const skippedToken=await prepareImportAssets(db,skippedScope,mock.provider);
  const result=await confirmImport(db,{companyId,ownerId,batchId:skipped,imageLeaseToken:skippedToken!,checkQuota:async()=>true});assert.deepEqual([result.skipped,result.images],[1,0]);
  // Simulate process loss after commit, before normal cleanup.
  await releaseImportAssetLease(db,skippedScope,skippedToken!);
  await cleanupExpiredImports(db,otherCompany,ownerId,mock.provider);assert.equal(mock.deleted.length,0);
  await cleanupExpiredImports(db,companyId,ownerId,mock.provider);assert.deepEqual(mock.deleted,["mock-2"]);
  assert.equal((await execute(sql`select state from app_private.import_assets where batch_id=${batch}`))[0].state,"attached");
});
test("provider upload/delete are outside DB transactions; partial upload failure cleans already completed provider files",async()=>{
  let inTransaction=false,uploads=0,deletes=0;
  const monitored=new DatabaseClient(execute,async()=>catalog,work=>pg.transaction(async connection=>{
    inTransaction=true;try{return await work(new DatabaseClient(executor(connection),async()=>catalog));}finally{inTransaction=false;}
  }));
  const bytes=await requireOwner("sharp")({create:{width:10,height:10,channels:3,background:"white"}}).webp().toBuffer();
  const rows=[product("PRD-PARTIAL-IMAGE-A"),{...product("PRD-PARTIAL-IMAGE-B"),rowNumber:3}];
  rows.forEach((row,i)=>{row.payload.image_reference=`${i}.png`;row.payload.image_reference_normalized=`${i}.png`;});
  const batch=await stageImport(monitored,{companyId,ownerId,domain:"products",outletId,fileName:"partial.xlsx",rows,assets:[0,1].map(i=>({reference:`${i}.png`,bytes,width:10,height:10}))});
  const provider:ImportAssetProvider={uploadFile:async()=>{assert.equal(inTransaction,false);if(++uploads===2)throw new Error("provider upload failure");return{id:"partial-1",url:"https://image.test/partial-1.webp"};},
    deleteFile:async id=>{assert.equal(inTransaction,false);assert.equal(id,"partial-1");deletes++;}};
  await assert.rejects(()=>prepareImportAssets(monitored,{companyId,ownerId,batchId:batch},provider),/provider upload failure/);
  assert.equal(deletes,1);const assets=await execute(sql`select state,provider_file_id from app_private.import_assets where batch_id=${batch}`);
  assert.ok(assets.every(asset=>asset.state==="staged"&&asset.provider_file_id===null));
  assert.equal((await execute(sql`select image_lease_token from app_private.import_batches where id=${batch}`))[0].image_lease_token,null);
});
test("new private import tables use platform-only RLS and deny ordinary owner scope",async()=>{
  await pg.exec("create role import_private_reader nosuperuser;grant usage on schema app_private to import_private_reader;grant select on app_private.import_assets,app_private.import_purchase_references to import_private_reader;");
  try {
    await pg.exec("set role import_private_reader;select set_config('app.scope','owner',false);");
    assert.equal(await count(sql`select count(*)::int as n from app_private.import_assets`),0);assert.equal(await count(sql`select count(*)::int as n from app_private.import_purchase_references`),0);
    await execute(sql`select set_config('app.scope','platform',false)`);assert.ok(await count(sql`select count(*)::int as n from app_private.import_assets`)>0);
  }finally{await pg.exec("reset role;select set_config('app.scope','platform',false);");}
});
