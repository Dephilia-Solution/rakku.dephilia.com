import type { DatabaseClient } from "@rakku/db";
import { claimJobs, completeJob, failJob, JobPermanentError, type JobRecord } from "@rakku/db/jobs";
import { getProviderEvent } from "@rakku/db/provider-events";
import { sendBillingEmail } from "@rakku/emails";
import { logError, logEvent } from "@rakku/observability";
import { handleVesselEvent } from "./vessel-events";

export interface JobRunResult {
  claimed: number;
  completed: number;
  retried: number;
  deadLettered: number;
  batches: number;
}

async function paymentEmail(db: DatabaseClient, job: JobRecord): Promise<void> {
  const invoiceId = typeof job.payload.invoiceId === "string" ? job.payload.invoiceId : "";
  const companyId = typeof job.payload.companyId === "string" ? job.payload.companyId : "";
  const invoiceNumber = typeof job.payload.invoiceNumber === "string" ? job.payload.invoiceNumber : "";
  if (!invoiceId || !companyId || !invoiceNumber) throw new JobPermanentError("Payload email langganan tidak lengkap");
  const planName = typeof job.payload.planName === "string" ? job.payload.planName : "langganan";
  const periodEnd = typeof job.payload.periodEnd === "string" ? new Date(job.payload.periodEnd) : null;
  const amount = Number(job.payload.amount);
  const sent = await sendBillingEmail(db, {
    companyId,
    type: "payment_success",
    period: invoiceNumber,
    subject: `Pembayaran diterima — Paket ${planName} aktif`,
    eyebrow: "Langganan",
    title: "Pembayaran diterima.",
    paragraphs: [
      `Paket ${planName} Anda aktif sampai ${periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd.toLocaleDateString("id-ID") : "-"}.`,
      `Invoice ${invoiceNumber} sebesar Rp${Number.isFinite(amount) ? amount.toLocaleString("id-ID") : "-"} sudah kami terima.`,
    ],
    note: "Terima kasih. Langganan dapat diperpanjang kapan saja dari halaman Langganan.",
  });
  if (sent) return;
  const { data, error } = await db.from("notification_logs")
    .select("id").eq("company_id", companyId).eq("type", "payment_success").eq("period", invoiceNumber).maybeSingle();
  if (error) throw new Error("Pemeriksaan email gagal");
  if (!data) throw new Error("Email pembayaran belum terkirim");
}

async function processJob(db: DatabaseClient, job: JobRecord): Promise<void> {
  switch (job.kind) {
    case "vessel.webhook": {
      const eventId = typeof job.payload.eventId === "string" ? job.payload.eventId : "";
      if (!eventId) throw new JobPermanentError("Payload webhook tidak memiliki event ID");
      const event = await getProviderEvent(db, eventId);
      if (!event) throw new JobPermanentError("Provider event tidak ditemukan");
      if (event.processed_at) return;
      if (event.signature_status === "invalid") throw new JobPermanentError("Signature provider tidak valid");
      await handleVesselEvent(db, event);
      return;
    }
    case "subscription.payment_email":
      await paymentEmail(db, job);
      return;
    default:
      throw new JobPermanentError(`Jenis job tidak dikenal: ${job.kind}`);
  }
}

export async function runDueJobs(db: DatabaseClient, options: {
  workerId: string;
  batchSize?: number;
  leaseSeconds?: number;
  deadlineMs?: number;
  maxBatches?: number;
  jitter?: () => number;
  now?: Date;
}): Promise<JobRunResult> {
  const batchSize = options.batchSize ?? 10;
  const leaseSeconds = options.leaseSeconds ?? 60;
  const deadlineMs = options.deadlineMs ?? 10000;
  const maxBatches = options.maxBatches ?? 20;
  if (!options.workerId.trim() || options.workerId.length > 200) throw new Error("Worker ID tidak valid");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) throw new Error("Batch size tidak valid");
  if (!Number.isInteger(maxBatches) || maxBatches < 1 || maxBatches > 100) throw new Error("Max batches tidak valid");
  const deadline = Date.now() + Math.max(1000, Math.min(60000, deadlineMs));
  const result: JobRunResult = { claimed: 0, completed: 0, retried: 0, deadLettered: 0, batches: 0 };

  while (result.batches < maxBatches && Date.now() < deadline) {
    const jobs = await claimJobs(db, { workerId: options.workerId, limit: batchSize, leaseSeconds });
    if (!jobs.length) break;
    result.batches++;
    result.claimed += jobs.length;
    for (const job of jobs) {
      if (Date.now() > deadline) break;
      try {
        await processJob(db, job);
        if (await completeJob(db, job.id, options.workerId)) result.completed++;
      } catch (error) {
        const retryable = (error as { retryable?: boolean }).retryable !== false;
        logError("provider.job.failed", error, {
          job_id: job.id, job_kind: job.kind, correlation_id: job.correlation_id,
          retryable,
        });
        const failed = await failJob(db, {
          jobId: job.id,
          workerId: options.workerId,
          error,
          retryable,
          jitter: options.jitter,
          now: options.now,
        });
        if (failed.deadLettered) {
          result.deadLettered++;
          logEvent("warn", "provider.job.dead_lettered", {
            job_id: job.id, job_kind: job.kind, correlation_id: job.correlation_id,
          });
        } else if (failed.failed) result.retried++;
      }
    }
  }
  return result;
}
