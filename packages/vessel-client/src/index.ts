import { createHmac, timingSafeEqual } from "node:crypto";

export class ProviderUnavailableError extends Error {
  readonly retryable = true;
  constructor(message = "Provider tidak dapat dihubungi") {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderVerificationError extends Error {
  readonly retryable = false;
  constructor(message = "Verifikasi provider gagal") {
    super(message);
    this.name = "ProviderVerificationError";
  }
}

export interface VesselWebhookVerification {
  status: "valid" | "invalid" | "unverified";
  reason?: string;
}

export function verifyVesselWebhook(input: {
  rawBody: string;
  headers: { get(name: string): string | null };
  secret?: string;
  now?: number;
}): VesselWebhookVerification {
  const secret = input.secret ?? process.env.VESSEL_WEBHOOK_SECRET;
  if (!secret) return { status: "unverified", reason: "Webhook secret belum dikonfigurasi" };
  const signatureHeader = process.env.VESSEL_WEBHOOK_SIGNATURE_HEADER || "x-vessel-signature";
  const timestampHeader = process.env.VESSEL_WEBHOOK_TIMESTAMP_HEADER || "x-vessel-timestamp";
  const mode = process.env.VESSEL_WEBHOOK_SIGNATURE_MODE || "timestamped";
  const signature = input.headers.get(signatureHeader)?.split(",")[0]?.trim();
  if (!signature) return { status: "invalid", reason: "Signature header tidak ada" };
  const timestamp = input.headers.get(timestampHeader)?.trim();
  if (mode === "timestamped") {
    if (!timestamp || !/^\d+$/.test(timestamp)) return { status: "invalid", reason: "Timestamp tidak valid" };
    const tolerance = Number(process.env.VESSEL_WEBHOOK_TOLERANCE_SECONDS || 300);
    const now = input.now ?? Math.floor(Date.now() / 1000);
    if (!Number.isFinite(tolerance) || tolerance < 0 || Math.abs(now - Number(timestamp)) > tolerance) {
      return { status: "invalid", reason: "Timestamp di luar replay window" };
    }
  }
  const payload = mode === "timestamped" ? `${timestamp}.${input.rawBody}` : input.rawBody;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const provided = signature.replace(/^sha256=/i, "").replace(/^v1=/i, "").toLowerCase();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { status: "invalid", reason: "Signature tidak cocok" };
  }
  return { status: "valid" };
}

export type VesselPaymentStatus =
  | "pending"
  | "success"
  | "expired"
  | "failed"
  | "cancelled";

export interface VesselPayment {
  transaction_id: string;
  invoice_number: string;
  tenant_id: string;
  payment_method: string;
  payment_status: VesselPaymentStatus | string;
  qr_string: string;
  expired_at: string;
}

export interface VesselPaymentDetail {
  id: string;
  invoice_number: string;
  payment_status: VesselPaymentStatus | string;
  amount: string;
  qr_string: string | null;
  expired_at: string;
  paid_at: string | null;
}

export interface VesselSyncResult {
  transaction_id: string;
  payment_status: VesselPaymentStatus | string;
  doku_status: string;
  synced: boolean;
}

export interface CreateQrisPaymentParams {
  tenant_id: string;
  invoice_number: string;
  amount: number;
  expired_in_minutes?: number;
  callback_url?: string;
}

interface VesselApiResponse<T> {
  success: boolean;
  data: T;
}

function requireConfig() {
  const url = process.env.VESSEL_API_URL;
  const key = process.env.VESSEL_API_KEY;

  if (!url || !key) {
    throw new Error("VESSEL_API_URL dan VESSEL_API_KEY harus diisi di .env.local");
  }

  return { url: url.replace(/\/+$/, ""), key };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.message === "string") return data.message;
    return fallback;
  } catch {
    return fallback;
  }
}

export async function createQrisPayment(
  params: CreateQrisPaymentParams
): Promise<VesselPayment> {
  const { url, key } = requireConfig();
  let res: Response;
  try {
    res = await fetch(`${url}/api/v1/payments`, {
      signal: AbortSignal.timeout(10000),
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenant_id: params.tenant_id,
        invoice_number: params.invoice_number,
        amount: params.amount,
        expired_in_minutes: params.expired_in_minutes ?? 60,
        ...(params.callback_url ? { callback_url: params.callback_url } : {}),
      }),
    });
  } catch {
    throw new ProviderUnavailableError("Pembuatan QRIS belum dapat dipastikan");
  }

  if (!res.ok) {
    throw new ProviderUnavailableError(await readError(res, "Gagal membuat pembayaran QRIS"));
  }
  try {
    const json = (await res.json()) as VesselApiResponse<VesselPayment>;
    if (!json?.data) throw new Error("empty");
    return json.data;
  } catch {
    throw new ProviderUnavailableError("Respons pembuatan QRIS tidak dapat dibaca");
  }
}

export async function getPaymentStatus(
  transactionId: string
): Promise<VesselPaymentDetail> {
  const { url, key } = requireConfig();
  let res: Response;
  try {
    res = await fetch(
      `${url}/api/v1/payments/${encodeURIComponent(transactionId)}`,
      {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      } as RequestInit
    );
  } catch {
    throw new ProviderUnavailableError("Status provider tidak dapat diambil");
  }

  if (!res.ok) {
    throw new ProviderUnavailableError(await readError(res, "Gagal mengambil status pembayaran"));
  }
  try {
    const json = (await res.json()) as VesselApiResponse<VesselPaymentDetail>;
    if (!json?.data) throw new Error("empty");
    return json.data;
  } catch {
    throw new ProviderUnavailableError("Respons status provider tidak dapat dibaca");
  }
}

export async function syncPaymentStatus(
  transactionId: string
): Promise<VesselSyncResult> {
  const { url, key } = requireConfig();
  let res: Response;
  try {
    res = await fetch(
      `${url}/api/v1/payments/${encodeURIComponent(transactionId)}/check`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      }
    );
  } catch {
    throw new ProviderUnavailableError("Sinkronisasi status provider tidak dapat dihubungi");
  }

  if (!res.ok) {
    throw new ProviderUnavailableError(await readError(res, "Gagal sinkronisasi status pembayaran"));
  }
  try {
    const json = (await res.json()) as VesselApiResponse<VesselSyncResult>;
    if (!json?.data) throw new Error("empty");
    return json.data;
  } catch {
    throw new ProviderUnavailableError("Respons sinkronisasi provider tidak dapat dibaca");
  }
}
