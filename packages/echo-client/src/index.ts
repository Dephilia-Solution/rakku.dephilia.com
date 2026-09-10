export type EchoEmailLog = {
  id: string;
  to: string;
  subject: string;
  status: string;
  created_at: string;
};

export type EchoApiResponse<T> = {
  success: boolean;
  data: T;
};

export type EchoSendParams = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

function requireConfig() {
  const url = process.env.ECHO_API_URL;
  const key = process.env.ECHO_API_KEY;

  if (!url || !key) {
    throw new Error(
      "ECHO_API_URL dan ECHO_API_KEY harus diisi di .env.local"
    );
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

export async function sendEmail(params: EchoSendParams): Promise<EchoEmailLog> {
  const { url, key } = requireConfig();

  const from = params.from ?? process.env.ECHO_FROM;
  const body: Record<string, string> = {
    to: params.to,
    subject: params.subject,
    html: params.html,
  };
  if (from) {
    body.from = from;
  }

  const res = await fetch(`${url}/api/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await readError(res, "Kirim email ke Echo gagal"));
  }

  const json = (await res.json()) as EchoApiResponse<EchoEmailLog>;
  return json.data;
}
