export const metadata = {
  title: "Offline - Rakku POS",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        margin: 0,
        background: "#f5f5f5",
        color: "#333",
      }}
    >
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }} aria-hidden>
          📡
        </div>
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
          Anda sedang offline
        </h1>
        <p style={{ color: "#666", margin: "0 0 1.5rem" }}>
          Periksa koneksi internet Anda lalu coba lagi.
        </p>
        <a
          href="/"
          style={{
            background: "#2E7D32",
            color: "white",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Coba lagi
        </a>
      </div>
    </div>
  );
}
