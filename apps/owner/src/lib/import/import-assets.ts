import { randomUUID, createHash } from "node:crypto";
import { sql, type DatabaseClient } from "@rakku/db";
import { ImportError } from "@rakku/db/imports";
import { boundedMap } from "./import-images";

export interface ImportAssetProvider {
  uploadFile: (input: {file:Buffer;filename:string;contentType:string}) => Promise<{id:string;url:string}>;
  deleteFile: (id:string) => Promise<void>;
}
export interface ImportAssetScope { companyId:string; batchId:string; ownerId:string; }
const LEASE_SECONDS = 600;

export async function findImportCleanupCompanies(db: DatabaseClient) {
  return db.execute(sql`select c.id,c.owner_id from public.companies c where c.owner_id is not null and exists (
    select 1 from app_private.import_batches b where b.company_id=c.id and (b.image_lease_until is null or b.image_lease_until<now())
      and ((b.status='validated' and b.expires_at<=now()) or exists (select 1 from app_private.import_assets a where a.batch_id=b.id
        and (a.state='cleanup_pending' or (a.state in ('staged','uploaded') and (b.status<>'validated' or b.expires_at<=now()))))))
    order by c.id limit 20`);
}

/** Short DB lease, never an open transaction during provider IO. A crashed lease is reclaimable.
 * Silos has no idempotency-key API: a process kill between remote success and persisting its ID
 * cannot be repaired automatically. Once an ID is saved, all retries/cleanup are durable. */
export async function prepareImportAssets(db:DatabaseClient, scope:ImportAssetScope, provider:ImportAssetProvider):Promise<string | null> {
  const token = randomUUID();
  const claimed = await db.transaction(async tx => {
    const [batch] = await tx.execute(sql`select * from app_private.import_batches where id=${scope.batchId} and company_id=${scope.companyId} for update`);
    if (!batch) throw new ImportError("Batch tidak ditemukan.",404);
    if (batch.created_by_owner_id && batch.created_by_owner_id !== scope.ownerId) throw new ImportError("Owner batch tidak sesuai sesi.",403);
    if (batch.status === "confirmed") return false;
    if (batch.status !== "validated" || new Date(batch.expires_at).getTime() <= Date.now()) throw new ImportError("Preview import kedaluwarsa. Validasi ulang.",409,"IMPORT_EXPIRED");
    if (batch.image_lease_token && new Date(batch.image_lease_until).getTime() > Date.now()) throw new ImportError("Batch sedang diproses. Coba kembali.",409,"IMPORT_BUSY");
    if (batch.context?.structural_errors?.length || (batch.context?.linked && Number(batch.error_rows) > 0)) throw new ImportError("Perbaiki seluruh error workbook terkait sebelum konfirmasi.",409,"IMPORT_LINKED_ERRORS");
    await tx.execute(sql`update app_private.import_batches set image_lease_token=${token},image_lease_until=now()+${LEASE_SECONDS}*interval '1 second' where id=${batch.id}`);
    return true;
  });
  if (!claimed) return null;
  const deadline=Date.now()+240_000;
  try {
    // Reconcile previous failed deletions before producing additional files.
    await cleanupImportAssets(db,scope,provider,token,false);
    const pending=await db.execute(sql`select id from app_private.import_assets where batch_id=${scope.batchId} and company_id=${scope.companyId} and state='cleanup_pending' limit 1`);
    if(pending.length) throw new ImportError("Penghapusan gambar sebelumnya belum selesai. Coba kembali.",503,"IMPORT_ASSET_CLEANUP_PENDING");
    const assets = await db.execute(sql`select a.id,a.reference,a.processed_base64,a.content_hash,a.state,a.provider_file_id
      from app_private.import_assets a where a.batch_id=${scope.batchId} and a.company_id=${scope.companyId} and a.state='staged' order by a.id`);
    await boundedMap(assets,async asset => {
      if(Date.now()>deadline) throw new ImportError("Waktu upload batch habis. Coba kembali.",503,"IMPORT_UPLOAD_TIMEOUT");
      if (!asset.processed_base64) throw new ImportError("Gambar staging kedaluwarsa; validasi ulang.",409);
      const bytes = Buffer.from(asset.processed_base64,"base64");
      if (createHash("sha256").update(bytes).digest("hex") !== asset.content_hash) throw new ImportError("Integritas gambar staging gagal.",409);
      const uploaded = await provider.uploadFile({file:bytes,filename:`import-${scope.batchId}-${asset.id}.webp`,contentType:"image/webp"});
      if (typeof uploaded.id !== "string" || !uploaded.id || typeof uploaded.url !== "string" || !/^https:\/\//.test(uploaded.url)) {
        if (uploaded.id) await provider.deleteFile(uploaded.id);
        throw new Error("Respons upload gambar tidak valid.");
      }
      try {
        // The lease is checked again for every persisted ID. No silent attachment after expiry.
        const saved = await db.execute(sql`update app_private.import_assets a set provider_file_id=${uploaded.id},provider_url=${uploaded.url},state='uploaded',updated_at=now()
          from app_private.import_batches b where a.id=${asset.id} and a.batch_id=b.id and b.id=${scope.batchId} and b.company_id=${scope.companyId}
            and b.image_lease_token=${token} and b.image_lease_until>now() and b.status='validated' returning a.id`);
        if (!saved.length) throw new ImportError("Lease gambar berakhir. Coba kembali.",409,"IMPORT_BUSY");
      } catch (error) {
        // If persistence failed before recording the provider ID, delete that remote orphan now.
        // If DELETE fails, retain its ID for subsequent cleanup (when DB is reachable).
        try { await provider.deleteFile(uploaded.id); }
        catch {
          await db.execute(sql`update app_private.import_assets set provider_file_id=${uploaded.id},provider_url=${uploaded.url},state='cleanup_pending',updated_at=now()
            where id=${asset.id} and company_id=${scope.companyId} and state='staged'`);
        }
        throw error;
      }
    });
    return token;
  } catch (error) {
    await cleanupImportAssets(db,scope,provider,token,true).catch(() => undefined);
    await releaseImportAssetLease(db,scope,token);
    throw error;
  }
}

export async function releaseImportAssetLease(db:DatabaseClient,scope:ImportAssetScope,token:string) {
  await db.execute(sql`update app_private.import_batches set image_lease_token=null,image_lease_until=null
    where id=${scope.batchId} and company_id=${scope.companyId} and image_lease_token=${token}`);
}

/** Marks a durable delete intent first. Attached assets are never touched, including after
 * an ambiguous commit/HTTP failure. Provider deletion is retryable; bytes survive for retry. */
export async function cleanupImportAssets(db:DatabaseClient,scope:ImportAssetScope,provider:ImportAssetProvider,token:string,allUnattached:boolean,deadline=Date.now()+120_000) {
  const assets = await db.transaction(async tx => {
    const [batch] = await tx.execute(sql`select status,expires_at from app_private.import_batches where id=${scope.batchId}
      and company_id=${scope.companyId} and image_lease_token=${token} for update`);
    if (!batch) return [];
    if (batch.status !== "validated") await tx.execute(sql`update app_private.import_assets set state='deleted',processed_base64=null,updated_at=now()
      where batch_id=${scope.batchId} and company_id=${scope.companyId} and state='staged'`);
    return tx.execute(sql`update app_private.import_assets set state='cleanup_pending',updated_at=now()
      where batch_id=${scope.batchId} and company_id=${scope.companyId} and provider_file_id is not null
        and (state='cleanup_pending' ${allUnattached ? sql`or state='uploaded'` : sql``}) returning id,provider_file_id`);
  });
  let attempts=0;
  await boundedMap(assets,async asset => {
    if(Date.now()>deadline)return;
    attempts++;
    try {
      await provider.deleteFile(asset.provider_file_id);
      await db.execute(sql`update app_private.import_assets a set provider_file_id=null,provider_url=null,cleanup_error=null,
        state=case when b.status='validated' and b.expires_at>now() then 'staged' else 'deleted' end,
        processed_base64=case when b.status='validated' and b.expires_at>now() then a.processed_base64 else null end,updated_at=now()
        from app_private.import_batches b where a.id=${asset.id} and a.batch_id=b.id and b.image_lease_token=${token} and a.state='cleanup_pending'`);
    } catch (error) {
      await db.execute(sql`update app_private.import_assets set cleanup_error=${String(error instanceof Error ? error.message : error).slice(0,500)},updated_at=now()
        where id=${asset.id} and company_id=${scope.companyId} and state='cleanup_pending'`);
    }
  });
  return attempts;
}

/** Owner-scoped maintenance, also called opportunistically by validate/confirm. Bound work per
 * invocation; callers may repeat until batches=0. Expired PIN hashes and private bytes are scrubbed. */
export async function cleanupExpiredImports(db:DatabaseClient,companyId:string,ownerId:string,provider:ImportAssetProvider) {
  const batches = await db.execute(sql`select b.id from app_private.import_batches b where b.company_id=${companyId}
    and (b.image_lease_until is null or b.image_lease_until<now()) and
      ((b.status='validated' and b.expires_at<=now()) or exists(select 1 from app_private.import_assets a where a.batch_id=b.id and
        (a.state='cleanup_pending' or (a.state in ('staged','uploaded') and (b.status<>'validated' or b.expires_at<=now())))))
    order by b.created_at limit 5`);
  let deleted = 0,processed=0;const deadline=Date.now()+60_000;
  for (const batch of batches) {
    if(Date.now()>deadline)break;
    const token = randomUUID(), scope = {companyId,ownerId,batchId:String(batch.id)};
    const claimed = await db.execute(sql`update app_private.import_batches set image_lease_token=${token},image_lease_until=now()+${LEASE_SECONDS}*interval '1 second'
      where id=${batch.id} and company_id=${companyId} and (image_lease_until is null or image_lease_until<now()) returning id`);
    if (!claimed.length) continue;
    processed++;
    try {
      deleted += await cleanupImportAssets(db,scope,provider,token,true,deadline);
      await db.transaction(async tx => {
        await tx.execute(sql`update app_private.import_assets a set processed_base64=null,state=case when a.provider_file_id is null then 'deleted' else a.state end,updated_at=now()
          from app_private.import_batches b where a.batch_id=b.id and b.id=${batch.id} and b.company_id=${companyId} and b.expires_at<=now() and a.state<>'attached'`);
        await tx.execute(sql`update app_private.import_rows r set payload=payload-'pin'-'pin_hash' from app_private.import_batches b
          where r.batch_id=b.id and b.id=${batch.id} and b.company_id=${companyId} and b.expires_at<=now()`);
        await tx.execute(sql`update app_private.import_batches set status='failed' where id=${batch.id} and company_id=${companyId} and expires_at<=now() and status='validated'`);
      });
    } finally { await releaseImportAssetLease(db,scope,token); }
  }
  return {batches:processed,delete_attempts:deleted};
}
