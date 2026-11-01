import { ImageResponse } from "next/og";

export const alt = "Rakku — aplikasi kasir cafe, stok bahan baku, dan laporan laba";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "64px 72px", background: "#f3efe6", color: "#183126", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 38, fontWeight: 700 }}>Rakku</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -4 }}>Kasir beres. Laba terbaca.</div>
        <div style={{ display: "flex", fontSize: 30, color: "#1d5b38" }}>Kasir cafe · Resep · Stok bahan baku · Multi-outlet</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
        <span>Mulai dengan paket gratis</span>
        <span>rakku.dephilia.com</span>
      </div>
    </div>,
    size,
  );
}
