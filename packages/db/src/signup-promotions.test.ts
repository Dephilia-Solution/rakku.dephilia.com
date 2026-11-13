import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { DatabaseClient, type Catalog, type Row } from "./query";
import { loadCatalog } from "./index";
import { addSignupCalendarMonths, isSignupPromotionOpen } from "../../shared-types/src/signup-promotions";
import { applySignupPromotion, getPublicSignupPromotion, getSignupPromotionDetail, listSignupPromotions, reserveSignupPromotion, saveSignupPromotion, seedDefaultSignupPromotion, SignupPromotionError } from "./signup-promotions";
import { getCompanyPlan } from "../../plans/src/index";

// In-memory PostgreSQL only. No env, provider, database URL or application server.
const pg = new PGlite(), dialect = new PgDialect();
let catalog: Catalog, proId: string, businessId: string, legacyOwner: string, legacyCompany: string;
const executeOn = (connection: Pick<PGlite, "query">) => async (query: SQL): Promise<Row[]> => {
  const q = dialect.sqlToQuery(query); return (await connection.query<Row>(q.sql, q.params)).rows;
};
const execute = executeOn(pg);
const db = new DatabaseClient(execute, async () => catalog, work => pg.transaction(tx => work(new DatabaseClient(executeOn(tx), async () => catalog))));
const actor = "fixture-superadmin";
const iso = (v: unknown) => new Date(v as string).toISOString();
async function owner(at = "2026-12-31T16:59:59.000Z", connection = db) {
  const [r] = await connection.execute(sql`insert into public.owners(email,name,password_hash,created_at,email_verified_at)
    values (${`${randomUUID()}@fixture.invalid`},'Fixture','not-a-password',${at}::timestamptz,${at}::timestamptz) returning id`);
  return String(r.id);
}
async function company(ownerId: string) {
  const [r] = await execute(sql`insert into public.companies(code,name,password_hash,owner_id) values (${randomUUID()},'Fixture','fixture',${ownerId}) returning id`);
  return String(r.id);
}
async function campaign(input: Record<string, unknown> = {}) {
  return saveSignupPromotion(db, {name: 'Fixture campaign',plan_id: proId,duration_months: 3,starts_on: '2026-11-01',ends_on: '2026-12-31',terms: 'S&K Berlaku',is_active: true,...input}, actor);
}
const hasCode = (code: string) => (error: unknown) => error instanceof SignupPromotionError && error.code === code;
async function resetPromos() { await execute(sql`update app_private.signup_promotions set is_active=false`); }

before(async () => {
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter(f => /^\d+_.*\.sql$/.test(f) && !f.startsWith('0020')).sort()) await pg.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url),'utf8'));
  await execute(sql`select set_config('app.scope','platform',false)`);
  const plans = await execute(sql`insert into public.plans(slug,name,max_outlets) values ('free','Free',1),('pro','Pro',3),('business','Business',-1) returning id,slug`);
  proId = String(plans.find(p => p.slug === 'pro')!.id); businessId = String(plans.find(p => p.slug === 'business')!.id);
  legacyOwner = await owner('2026-10-01T03:00:00Z'); legacyCompany = await company(legacyOwner);
  await execute(sql`update public.companies set plan_id=${proId},subscription_status='trial',trial_ends_at='2026-10-15T03:00:00Z' where id=${legacyCompany}`);
  await pg.exec(readFileSync(new URL('../migrations/0020_signup_promotions.sql',import.meta.url),'utf8'));
  catalog = await loadCatalog(execute);
  await resetPromos();
});
after(() => pg.close());

test('calendar months use WIB, preserve time, clamp month ends and leap years', () => {
  assert.equal(addSignupCalendarMonths('2026-12-31T16:59:59Z',3),'2027-03-31T16:59:59.000Z');
  assert.equal(addSignupCalendarMonths('2026-11-30T04:30:00Z',3),'2027-02-28T04:30:00.000Z');
  assert.equal(addSignupCalendarMonths('2027-01-31T16:00:00Z',1),'2027-02-28T16:00:00.000Z');
  assert.equal(addSignupCalendarMonths('2028-01-31T16:00:00Z',1),'2028-02-29T16:00:00.000Z');
  assert.equal(addSignupCalendarMonths('2026-12-31T17:30:00Z',3),'2027-03-31T17:30:00.000Z'); // Jan 1 WIB -> Apr 1 WIB
  assert.throws(() => addSignupCalendarMonths('invalid',3));
  assert.throws(() => addSignupCalendarMonths('2026-12-31',0));
});

test('migration does not extend or rewrite existing owners and 14-day trials', async () => {
  const [row] = await execute(sql`select subscription_status,trial_ends_at from public.companies where id=${legacyCompany}`);
  assert.equal(row.subscription_status,'trial'); assert.equal(iso(row.trial_ends_at),'2026-10-15T03:00:00.000Z');
  const [count] = await execute(sql`select count(*) as n from app_private.signup_promotion_enrollments where owner_id=${legacyOwner}`);
  assert.equal(Number(count.n),0);
});

test('inclusive WIB deadline, public endpoint selection and next-day exclusion', async () => {
  await resetPromos(); const promo = await campaign();
  const last = new Date('2026-12-31T16:59:59.999Z'), next = new Date('2026-12-31T17:00:00Z');
  assert.equal(isSignupPromotionOpen(promo,last),true); assert.equal(isSignupPromotionOpen(promo,next),false);
  assert.equal((await getPublicSignupPromotion(db,last))?.id,promo.id);
  assert.equal(await getPublicSignupPromotion(db,next),null);
  assert.equal(await getPublicSignupPromotion(db,new Date('2026-10-31T16:59:59Z')),null);
});

test('Dec31 signup retains three months through March31 despite delayed onboarding and changed/disabled campaign', async () => {
  await resetPromos(); const promo = await campaign();
  const ownerId = await owner(); await reserveSignupPromotion(db,ownerId); await reserveSignupPromotion(db,ownerId);
  await saveSignupPromotion(db,{...promo,plan_id: businessId,duration_months: 6,is_active: false},actor,promo.id,promo.revision);
  const companyId = await company(ownerId);
  const benefit = await applySignupPromotion(db,ownerId,companyId,new Date('2027-01-05T00:00:00Z'));
  assert.equal(benefit?.planName,'Pro'); assert.equal(benefit.durationMonths,3);
  assert.equal(benefit.endsAt,'2027-03-31T16:59:59.000Z');
  const [row] = await execute(sql`select * from public.companies where id=${companyId}`);
  assert.equal(row.plan_id,proId); assert.equal(row.subscription_status,'trial'); assert.equal(iso(row.trial_ends_at),benefit.endsAt);
  const detail = await getSignupPromotionDetail(db,promo.id);
  assert.equal(detail.promotion.recipient_count,1); assert.equal(detail.recipients[0].duration_months,3); assert.equal(detail.recipients[0].plan_name,'Pro');
  assert.equal(detail.audit.length,2);
});

test('after-cutoff signup has a frozen no-offer decision and cannot receive a later campaign on retry', async () => {
  await resetPromos(); await campaign(); const ownerId = await owner('2026-12-31T17:00:00Z');
  await reserveSignupPromotion(db,ownerId);
  await resetPromos(); await campaign({starts_on:'2027-01-01',ends_on:'2027-02-01'});
  await reserveSignupPromotion(db,ownerId);
  const companyId = await company(ownerId);
  assert.equal(await applySignupPromotion(db,ownerId,companyId,new Date('2027-01-02T00:00:00Z')),null);
  const [row] = await execute(sql`select plan_id,trial_ends_at from public.companies where id=${companyId}`);
  assert.equal(row.plan_id,null); assert.equal(row.trial_ends_at,null);
});

test('legacy owner onboarding does not backfill a new campaign; expired reservation does not restart', async () => {
  await resetPromos(); await campaign();
  const old = await owner('2026-12-15T00:00:00Z'), oldCompany = await company(old);
  assert.equal(await applySignupPromotion(db,old,oldCompany),null);
  const reserved = await owner(); await reserveSignupPromotion(db,reserved);
  const c = await company(reserved), benefit = await applySignupPromotion(db,reserved,c,new Date('2027-04-01T00:00:00Z'));
  assert.equal(benefit?.active,false);
  const [row] = await execute(sql`select plan_id from public.companies where id=${c}`); assert.equal(row.plan_id,null);
});

test('reapplying does not overwrite a paid upgrade, and a different company cannot consume the same benefit', async () => {
  await resetPromos(); await campaign(); const o = await owner(); await reserveSignupPromotion(db,o); const c = await company(o);
  await applySignupPromotion(db,o,c,new Date('2027-01-01T00:00:00Z'));
  await execute(sql`update public.companies set plan_id=${businessId},subscription_status='active',plan_expires_at='2028-01-01' where id=${c}`);
  await applySignupPromotion(db,o,c,new Date('2027-01-02T00:00:00Z'));
  const [paid] = await execute(sql`select plan_id,subscription_status from public.companies where id=${c}`);
  assert.equal(paid.plan_id,businessId); assert.equal(paid.subscription_status,'active');
  const another = await company(o); assert.equal(await applySignupPromotion(db,o,another),null);
  const foreign = await company(await owner());
  await assert.rejects(applySignupPromotion(db,o,foreign),hasCode('INVALID_COMPANY'));
});

test('actual plan resolver keeps premium after campaign cutoff and falls back to Free only at the individual benefit end', async () => {
  await resetPromos(); await campaign(); const o = await owner(), c = await company(o);
  await reserveSignupPromotion(db,o); await applySignupPromotion(db,o,c,new Date('2027-01-01T00:00:00Z'));
  const clock = Date.now;
  try {
    Date.now = () => Date.parse('2027-03-31T16:59:58Z');
    const active = await getCompanyPlan(db,c); assert.equal(active.plan.slug,'pro'); assert.equal(active.is_trial,true);
    Date.now = () => Date.parse('2027-03-31T16:59:59Z');
    const ended = await getCompanyPlan(db,c); assert.equal(ended.plan.slug,'free'); assert.equal(ended.status,'expired');
    assert.equal((await execute(sql`select id from public.companies where id=${c}`)).length,1);
  } finally { Date.now = clock; }
});

test('overlap exclusion, strict validation, optimistic revision and append audit', async () => {
  await resetPromos(); const p = await campaign();
  await assert.rejects(campaign({starts_on:'2026-12-31',ends_on:'2027-01-31'}),hasCode('PROMOTION_OVERLAP'));
  await campaign({is_active:false});
  await assert.rejects(campaign({duration_months:90}),hasCode('INVALID_PROMOTION'));
  await assert.rejects(campaign({terms:''}),hasCode('INVALID_PROMOTION'));
  await assert.rejects(campaign({starts_on:'2026-02-30'}),hasCode('INVALID_PROMOTION'));
  const changed = await saveSignupPromotion(db,{...p,name:'Changed'},actor,p.id,p.revision);
  assert.equal(changed.revision,'1');
  await assert.rejects(saveSignupPromotion(db,{...p,name:'Lost update'},actor,p.id,p.revision),hasCode('STALE_REVISION'));
  assert.equal((await getSignupPromotionDetail(db,p.id)).audit.length,2);
  assert.ok((await listSignupPromotions(db)).some(row => row.id===p.id));
  await execute(sql`update public.plans set is_active=false where id=${proId}`);
  try {
    await assert.rejects(saveSignupPromotion(db,{...changed,is_active:true},actor,p.id,changed.revision),hasCode('INVALID_PLAN'));
    const disabled = await saveSignupPromotion(db,{...changed,is_active:false},actor,p.id,changed.revision);
    assert.equal(disabled.is_active,false); // Deactivation must remain possible for an inactive target plan.
  } finally { await execute(sql`update public.plans set is_active=true where id=${proId}`); }
});

test('signup and reservation roll back together; awarded dates cannot be edited even through raw SQL', async () => {
  await resetPromos(); await campaign(); let rolledBack = '';
  await assert.rejects(db.transaction(async tx => {rolledBack = await owner(undefined,tx); await reserveSignupPromotion(tx,rolledBack); throw new Error('fixture rollback');}));
  assert.equal((await execute(sql`select id from public.owners where id=${rolledBack}`)).length,0);
  assert.equal((await execute(sql`select owner_id from app_private.signup_promotion_enrollments where owner_id=${rolledBack}`)).length,0);
  const o = await owner(); await reserveSignupPromotion(db,o);
  await assert.rejects(execute(sql`update app_private.signup_promotion_enrollments set benefit_ends_at='2028-01-01' where owner_id=${o}`),/immutable/);
});

test('default seed preserves admin edits and missing-schema is a clear rollout error', async () => {
  await resetPromos();
  await execute(sql`delete from app_private.signup_promotions where id='e26c0000-0000-4000-8000-000000000001'`);
  await seedDefaultSignupPromotion(db);
  const rows = await execute(sql`select * from app_private.signup_promotions where id='e26c0000-0000-4000-8000-000000000001'`);
  if (rows.length) {
    await execute(sql`update app_private.signup_promotions set name='Admin setting',is_active=false where id=${rows[0].id}`);
    await seedDefaultSignupPromotion(db);
    const [row] = await execute(sql`select name,is_active from app_private.signup_promotions where id=${rows[0].id}`);
    assert.equal(row.name,'Admin setting'); assert.equal(row.is_active,false);
  }
  const missing = new DatabaseClient(async () => {throw Object.assign(new Error('missing'),{code:'42P01'});},async () => catalog);
  await assert.rejects(getPublicSignupPromotion(missing),hasCode('PROMOTION_SCHEMA_NOT_READY'));
});

test('tenant scope cannot read campaigns or enrollment identities', async () => {
  await pg.exec(`CREATE ROLE promo_tenant NOLOGIN; GRANT USAGE ON SCHEMA public,app_private TO promo_tenant;
    GRANT SELECT ON public.plans,app_private.signup_promotions,app_private.signup_promotion_enrollments TO promo_tenant;`);
  try {
    await pg.exec(`SET ROLE promo_tenant; SELECT set_config('app.scope','tenant',false);`);
    assert.equal((await execute(sql`select * from app_private.signup_promotions`)).length,0);
    assert.equal((await execute(sql`select * from app_private.signup_promotion_enrollments`)).length,0);
  } finally { await pg.exec(`RESET ROLE; SELECT set_config('app.scope','platform',false);`); }
});
