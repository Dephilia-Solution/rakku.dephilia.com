interface RakkuEmailInput {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  note: string;
}

const LOGO_URL =
  "https://cdn.dephilia.com/Product%20Image/c26d88fc-f783-4e63-8521-36f0f1e65aed-rakku_logo_email.png";
const LOGOTYPE_URL =
  "https://cdn.dephilia.com/Product%20Image/02b32e17-0f2f-4875-bd2e-4e12f118878f-rakku_logotype_email.png";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderRakkuEmail(input: RakkuEmailInput): string {
  const { eyebrow, title, paragraphs, ctaLabel, ctaUrl, note } = input;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} — Rakku POS</title>
</head>
<body style="margin:0;padding:0;background:#F7F5F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #ECE6DA;overflow:hidden;">
          <tr>
            <td align="center" style="padding:30px 32px 26px 32px;">
              <div style="font-size:0;">
                <img
                  src="${esc(LOGO_URL)}"
                  alt=""
                  width="42"
                  height="42"
                  style="display:inline-block;vertical-align:middle;border:0;outline:none;text-decoration:none;margin-right:10px;"
                />
                <img
                  src="${esc(LOGOTYPE_URL)}"
                  alt="Rakku"
                  width="96"
                  height="30"
                  style="display:inline-block;vertical-align:middle;border:0;outline:none;text-decoration:none;height:30px;width:auto;"
                />
              </div>
            </td>
          </tr>
          <tr>
            <td style="font-size:0;line-height:0;background:#1B4F1F;background:linear-gradient(90deg,#1B4F1F 0%,#2E7D32 55%,#4CAF50 100%);" height="6">
              <div style="height:6px;line-height:0;background:#1B4F1F;background:linear-gradient(90deg,#1B4F1F 0%,#2E7D32 55%,#4CAF50 100%);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:38px 38px 30px 38px;">
              <span style="display:block;text-align:center;font-family:'DM Sans','Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#2E7D32;margin-bottom:12px;">
                ${esc(eyebrow)}
              </span>
              <h1 style="margin:0 0 14px 0;text-align:center;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-size:25px;line-height:1.25;font-weight:600;color:#1A1A1A;letter-spacing:-0.01em;">
                ${esc(title)}
              </h1>
              ${paragraphs
                .map(
                  (p) => `
              <p style="margin:0 0 12px 0;text-align:center;font-family:'DM Sans','Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.65;color:#5C6560;">
                ${esc(p)}
              </p>`
                )
                .join("")}
              <div style="text-align:center;padding:22px 0 8px 0;">
                <a
                  href="${esc(ctaUrl)}"
                  style="display:inline-block;background:#2E7D32;color:#ffffff;text-decoration:none;font-family:'DM Sans','Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;line-height:1;padding:15px 30px;border-radius:10px;mso-padding-alt:0;"
                >
                  <span style="mso-text-raise:8px;">${esc(ctaLabel)}</span>
                </a>
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#F3F8F1;border:1px solid #E0EBD9;border-radius:12px;">
                <tr>
                  <td style="padding:14px 18px;text-align:center;font-family:'DM Sans','Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.55;color:#4F6A56;">
                    ${esc(note)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 38px 30px 38px;">
              <div style="border-top:1px solid #EFEAE0;padding-top:18px;text-align:center;font-family:'DM Sans','Inter',-apple-system,'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.6;color:#9AA29B;">
                <span style="font-weight:600;color:#6B756E;">Rakku POS</span> — setiap transaksi, tersusun rapi di raknya.<br />
                Email ini dikirim otomatis, mohon tidak membalas.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
