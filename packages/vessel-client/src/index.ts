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

  const res = await fetch(`${url}/api/v1/payments`, {
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

  if (!res.ok) {
    throw new Error(await readError(res, "Gagal membuat pembayaran QRIS"));
  }

  const json = (await res.json()) as VesselApiResponse<VesselPayment>;
  return json.data;
}

export async function getPaymentStatus(
  transactionId: string
): Promise<VesselPaymentDetail> {
  const { url, key } = requireConfig();

  const res = await fetch(
    `${url}/api/v1/payments/${encodeURIComponent(transactionId)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    } as RequestInit
  );

  if (!res.ok) {
    throw new Error(await readError(res, "Gagal mengambil status pembayaran"));
  }

  const json = (await res.json()) as VesselApiResponse<VesselPaymentDetail>;
  return json.data;
}

export async function syncPaymentStatus(
  transactionId: string
): Promise<VesselSyncResult> {
  const { url, key } = requireConfig();

  const res = await fetch(
    `${url}/api/v1/payments/${encodeURIComponent(transactionId)}/check`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
    }
  );

  if (!res.ok) {
    throw new Error(await readError(res, "Gagal sinkronisasi status pembayaran"));
  }

  const json = (await res.json()) as VesselApiResponse<VesselSyncResult>;
  return json.data;
}
