import { sql } from "drizzle-orm";
import type { DatabaseClient, Row } from "./query";
import { addSignupCalendarMonths, isPromotionDate, type PublicSignupPromotion, type SignupPromotion, type SignupPromotionInput, type SignupPromotionRecipient, type SignupPromotionAudit } from "../../shared-types/src/signup-promotions";
import { jakartaDateKey } from "../../shared-types/src/reporting";

export class SignupPromotionError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); this.name = "SignupPromotionError"; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: unknown): string { if (typeof value !== "string" || !UUID.test(value)) throw new SignupPromotionError("INVALID_ID", "ID promo/paket tidak valid"); return value; }
const instant = (value: unknown) => new Date(value as string | Date).toISOString();
const day = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : instant(value).slice(0, 10);
function dbError(error: unknown): never {
  if (error instanceof SignupPromotionError) throw error;
  const e = error as { code?: string; cause?: unknown };
  if (e?.cause) return dbError(e.cause);
  if (e?.code === "42P01" || e?.code === "42703") throw new SignupPromotionError("PROMOTION_SCHEMA_NOT_READY", "Skema promo belum siap. Terapkan migration 0020 sebelum mengaktifkan pendaftaran.", 503);
  if (e?.code === "23P01") throw new SignupPromotionError("PROMOTION_OVERLAP", "Periode promo aktif bertabrakan dengan promo lain. Nonaktifkan atau sesuaikan tanggalnya.", 409);
  if (e?.code === "23503") throw new SignupPromotionError("INVALID_PLAN", "Paket atau promo yang dirujuk tidak tersedia.", 409);
  throw error;
}
function config(row: Row): SignupPromotion {
  return { id: row.id, name: row.name, plan_id: row.plan_id, plan_name: row.plan_name,
    duration_months: Number(row.duration_months), starts_on: day(row.starts_on), ends_on: day(row.ends_on), terms: row.terms,
    is_active: row.is_active, revision: String(row.revision), created_at: instant(row.created_at), updated_at: instant(row.updated_at), recipient_count: Number(row.recipient_count ?? 0) };
}
function validate(value: unknown): SignupPromotionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SignupPromotionError("INVALID_PROMOTION", "Data promo tidak valid");
  const v = value as Record<string, unknown>;
  if (typeof v.name !== "string" || !v.name.trim() || v.name.trim().length > 120 || typeof v.terms !== "string" || !v.terms.trim() || v.terms.length > 5000
    || !Number.isInteger(v.duration_months) || Number(v.duration_months) < 1 || Number(v.duration_months) > 24
    || !isPromotionDate(v.starts_on) || !isPromotionDate(v.ends_on) || v.ends_on < v.starts_on || typeof v.is_active !== "boolean") {
    throw new SignupPromotionError("INVALID_PROMOTION", "Isi nama, paket, durasi 1–24 bulan, periode tanggal WIB yang valid, dan status promo.");
  }
  return {name: v.name.trim(), plan_id: id(v.plan_id), terms: v.terms.trim(), duration_months: Number(v.duration_months), starts_on: v.starts_on, ends_on: v.ends_on, is_active: v.is_active};
}

const promotionSelection = sql`select p.*,pl.name as plan_name,
  (select count(*) from app_private.signup_promotion_enrollments e where e.promotion_id=p.id) as recipient_count
  from app_private.signup_promotions p join public.plans pl on pl.id=p.plan_id`;

export async function listSignupPromotions(db: DatabaseClient): Promise<SignupPromotion[]> {
  try { return (await db.execute(sql`${promotionSelection} order by p.starts_on desc,p.id limit 100`)).map(config); } catch (error) { return dbError(error); }
}

export async function getSignupPromotionDetail(db: DatabaseClient, promotionId: string) {
  id(promotionId);
  try {
    const [row] = await db.execute(sql`${promotionSelection} where p.id=${promotionId}`);
    if (!row) throw new SignupPromotionError("PROMOTION_NOT_FOUND", "Promo tidak ditemukan", 404);
    const recipients = await db.execute(sql`select e.*,o.name as owner_name,c.name as company_name
      from app_private.signup_promotion_enrollments e join public.owners o on o.id=e.owner_id
      left join public.companies c on c.id=e.company_id where e.promotion_id=${promotionId}
      order by e.created_at desc,e.owner_id limit 100`);
    const audit = await db.execute(sql`select id,actor_id,created_at,before_config,after_config
      from app_private.signup_promotions_audit where promotion_id=${promotionId} order by created_at desc,id desc limit 30`);
    return {promotion: config(row), recipients: recipients.map((r): SignupPromotionRecipient => ({owner_id: r.owner_id, owner_name: r.owner_name, company_id: r.company_id, company_name: r.company_name,
      benefit_starts_at: instant(r.benefit_starts_at), benefit_ends_at: instant(r.benefit_ends_at), applied_at: r.applied_at ? instant(r.applied_at) : null,
      plan_name: r.promotion_snapshot.plan_name, duration_months: Number(r.promotion_snapshot.duration_months)})),
    audit: audit.map((r): SignupPromotionAudit => ({id: r.id, actor_id: r.actor_id, created_at: instant(r.created_at), before_config: r.before_config, after_config: r.after_config}))};
  } catch (error) { return dbError(error); }
}

export async function saveSignupPromotion(db: DatabaseClient, value: unknown, actorId: string, promotionId?: string, expectedRevision?: unknown): Promise<SignupPromotion> {
  const input = validate(value);
  if (!actorId?.trim() || actorId.length > 200) throw new SignupPromotionError("INVALID_ACTOR", "Identitas admin tidak valid");
  if (promotionId) {
    id(promotionId);
    if (typeof expectedRevision !== "string" || !/^\d{1,18}$/.test(expectedRevision)) throw new SignupPromotionError("REVISION_REQUIRED", "Muat ulang data promo sebelum menyimpan");
  }
  try {
    return await db.transaction(async tx => {
      let before: SignupPromotion | null = null;
      if (promotionId) {
        const [locked] = await tx.execute(sql`select id,revision from app_private.signup_promotions where id=${promotionId} for update`);
        if (!locked) throw new SignupPromotionError("PROMOTION_NOT_FOUND", "Promo tidak ditemukan", 404);
        if (String(locked.revision) !== expectedRevision) throw new SignupPromotionError("STALE_REVISION", "Promo sudah berubah. Muat ulang lalu tinjau sebelum menyimpan.", 409);
        const [row] = await tx.execute(sql`${promotionSelection} where p.id=${promotionId}`); before = config(row);
      }
      const [plan] = await tx.execute(sql`select id,slug,name,is_active from public.plans where id=${input.plan_id} for share`);
      if (!plan || plan.slug === "free" || (input.is_active && !plan.is_active)) throw new SignupPromotionError("INVALID_PLAN", "Pilih paket premium yang aktif");
      let saved: Row;
      if (promotionId) {
        [saved] = await tx.execute(sql`update app_private.signup_promotions set name=${input.name},plan_id=${input.plan_id},duration_months=${input.duration_months},
          starts_on=${input.starts_on}::date,ends_on=${input.ends_on}::date,terms=${input.terms},is_active=${input.is_active},revision=revision+1,updated_at=now()
          where id=${promotionId} returning *`);
      } else {
        [saved] = await tx.execute(sql`insert into app_private.signup_promotions(name,plan_id,duration_months,starts_on,ends_on,terms,is_active)
          values (${input.name},${input.plan_id},${input.duration_months},${input.starts_on}::date,${input.ends_on}::date,${input.terms},${input.is_active}) returning *`);
      }
      const after = config({...saved, plan_name: plan.name, recipient_count: before?.recipient_count ?? 0});
      await tx.execute(sql`insert into app_private.signup_promotions_audit(promotion_id,actor_id,before_config,after_config)
        values (${saved.id},${actorId},${JSON.stringify(before)}::jsonb,${JSON.stringify(after)}::jsonb)`);
      return after;
    });
  } catch (error) { return dbError(error); }
}

export async function getPublicSignupPromotion(db: DatabaseClient, now: Date = new Date()): Promise<PublicSignupPromotion | null> {
  try {
    const date = jakartaDateKey(now);
    const [row] = await db.execute(sql`select p.id,p.name,pl.name as plan_name,p.duration_months,p.starts_on,p.ends_on,p.terms
      from app_private.signup_promotions p join public.plans pl on pl.id=p.plan_id
      where p.is_active=true and pl.is_active=true and p.starts_on<=${date}::date and p.ends_on>=${date}::date limit 1`);
    return row ? {id: row.id, name: row.name, plan_name: row.plan_name, duration_months: Number(row.duration_months), starts_on: day(row.starts_on), ends_on: day(row.ends_on), terms: row.terms} : null;
  } catch (error) { return dbError(error); }
}

/** Call in the SAME transaction that inserts a new owner. Includes no-offer decisions. */
export async function reserveSignupPromotion(db: DatabaseClient, ownerId: string): Promise<void> {
  id(ownerId);
  try {
    await db.transaction(async tx => {
      const [owner] = await tx.execute(sql`select id,created_at from public.owners where id=${ownerId} for update`);
      if (!owner) throw new SignupPromotionError("OWNER_NOT_FOUND", "Owner tidak ditemukan", 404);
      const [existing] = await tx.execute(sql`select owner_id from app_private.signup_promotion_enrollments where owner_id=${ownerId}`);
      if (existing) return;
      const date = jakartaDateKey(instant(owner.created_at));
      const [promo] = await tx.execute(sql`select p.*,pl.name as plan_name from app_private.signup_promotions p join public.plans pl on pl.id=p.plan_id
        where p.is_active=true and pl.is_active=true and p.starts_on<=${date}::date and p.ends_on>=${date}::date
        limit 1 for share of p,pl`);
      const start = promo ? instant(owner.created_at) : null;
      const end = promo ? addSignupCalendarMonths(start!, Number(promo.duration_months)) : null;
      const snapshot = promo ? {name: promo.name,plan_name: promo.plan_name,plan_id: promo.plan_id,duration_months: Number(promo.duration_months), starts_on: day(promo.starts_on),ends_on: day(promo.ends_on),terms: promo.terms,revision: String(promo.revision)} : {};
      await tx.execute(sql`insert into app_private.signup_promotion_enrollments(owner_id,promotion_id,plan_id,promotion_snapshot,benefit_starts_at,benefit_ends_at)
        values (${ownerId},${promo?.id ?? null},${promo?.plan_id ?? null},${JSON.stringify(snapshot)}::jsonb,${start}::timestamptz,${end}::timestamptz)`);
    });
  } catch (error) { return dbError(error); }
}

export interface AppliedSignupBenefit {promotionName: string; planName: string; durationMonths: number; startsAt: string; endsAt: string; active: boolean;}
/** Use the reserved snapshot even after campaign expiry/deactivation. Never backfill owners. */
export async function applySignupPromotion(db: DatabaseClient, ownerId: string, companyId: string, now: Date = new Date()): Promise<AppliedSignupBenefit | null> {
  id(ownerId); id(companyId);
  try {
    return await db.transaction(async tx => {
      const [owner] = await tx.execute(sql`select id from public.owners where id=${ownerId} for update`);
      if (!owner) throw new SignupPromotionError("OWNER_NOT_FOUND", "Owner tidak ditemukan", 404);
      const [company] = await tx.execute(sql`select id,owner_id,subscription_status,plan_id from public.companies where id=${companyId} for update`);
      if (!company || company.owner_id !== ownerId) throw new SignupPromotionError("INVALID_COMPANY", "Perusahaan tidak cocok dengan owner", 403);
      const [enrollment] = await tx.execute(sql`select * from app_private.signup_promotion_enrollments where owner_id=${ownerId} for update`);
      if (!enrollment?.promotion_id) return null;
      if (enrollment.applied_at && enrollment.company_id !== companyId) return null;
      const active = Date.parse(instant(enrollment.benefit_ends_at)) > now.getTime();
      const benefit = {promotionName: enrollment.promotion_snapshot.name,planName: enrollment.promotion_snapshot.plan_name,durationMonths: Number(enrollment.promotion_snapshot.duration_months),startsAt: instant(enrollment.benefit_starts_at),endsAt: instant(enrollment.benefit_ends_at),active};
      if (enrollment.applied_at) return benefit;
      // Protect already paid/manually provisioned companies. Onboarding creates
      // a plan-less company; no existing company's entitlement is overwritten.
      if (company.plan_id) return null;
      if (active) await tx.execute(sql`update public.companies set plan_id=${enrollment.plan_id},subscription_status='trial',
        trial_ends_at=${benefit.endsAt}::timestamptz,plan_expires_at=null where id=${companyId}`);
      await tx.execute(sql`update app_private.signup_promotion_enrollments set company_id=${companyId},applied_at=${now.toISOString()}::timestamptz where owner_id=${ownerId}`);
      return benefit;
    });
  } catch (error) { return dbError(error); }
}

/** Fresh installations seed after plans; existing campaign edits are never reset. */
export async function seedDefaultSignupPromotion(db: DatabaseClient): Promise<void> {
  try {
    await db.execute(sql`insert into app_private.signup_promotions(id,name,plan_id,duration_months,starts_on,ends_on,terms,is_active)
      select 'e26c0000-0000-4000-8000-000000000001','Promo Pengguna Baru 2026',p.id,3,
        (now() at time zone 'Asia/Jakarta')::date,'2026-12-31'::date,
        'Untuk akun baru. Pro gratis 3 bulan kalender sejak pendaftaran akun. Daftar paling lambat 31 Desember 2026 pukul 23.59 WIB. Hak akses tetap berlaku sampai tanggal akhir masing-masing. Setelah berakhir, akun menggunakan paket Free kecuali telah berlangganan.',true
      from public.plans p where p.slug='pro' and p.is_active=true and (now() at time zone 'Asia/Jakarta')::date<='2026-12-31'::date
        and not exists(select 1 from app_private.signup_promotions s where s.is_active=true and s.ends_on>=(now() at time zone 'Asia/Jakarta')::date and s.starts_on<='2026-12-31'::date)
      on conflict(id) do nothing`);
  } catch (error) { return dbError(error); }
}
