import { readFile, writeFile } from "node:fs/promises";

const source = new URL("../apps/owner/src/content/release-notes.json", import.meta.url);
const destination = new URL("../CHANGELOG.md", import.meta.url);
const data = JSON.parse(await readFile(source, "utf8"));
const semver = /^\d+\.\d+\.\d+$/;

if (!Array.isArray(data.releases) || !data.releases.length || !data.unreleased) {
  throw new Error("Riwayat rilis atau bagian unreleased tidak tersedia.");
}
const versions = new Set();
for (const release of data.releases) {
  if (!semver.test(release.version) || versions.has(release.version)) throw new Error(`Versi tidak valid atau duplikat: ${release.version}`);
  versions.add(release.version);
  if (!["historical", "released"].includes(release.status)) throw new Error(`Status tidak valid: ${release.version}`);
  if (release.status === "released" && (!/^\d{4}-\d{2}-\d{2}$/.test(release.date ?? "") || Number.isNaN(Date.parse(`${release.date}T00:00:00Z`)) || new Date(`${release.date}T00:00:00Z`).toISOString().slice(0, 10) !== release.date)) {
    throw new Error(`Tanggal rilis tidak valid: ${release.version}`);
  }
}
if (data.buildVersion !== null && !data.releases.some(release => release.version === data.buildVersion && release.status === "released")) {
  throw new Error("buildVersion harus null atau merujuk ke rilis berstatus released.");
}

const lines = [
  "# Riwayat Pembaruan Rakku",
  "",
  "> Berkas ini dihasilkan dari `apps/owner/src/content/release-notes.json` dengan `pnpm changelog:generate`. Ubah sumbernya, bukan berkas ini.",
  "> Versi produk, deployment masing-masing aplikasi, dan migrasi database adalah hal berbeda. Status deployment dan migrasi harus diverifikasi pada environment tujuan.",
  "",
  "## Belum dirilis",
  "",
  "Perubahan berikut tercatat di source, tetapi belum dinyatakan sebagai rilis produk atau deployment production.",
];
for (const [key, title] of [["new", "Fitur baru"], ["improved", "Peningkatan"], ["fixed", "Perbaikan"]]) {
  const entries = data.unreleased[key];
  if (!Array.isArray(entries)) throw new Error(`Kategori unreleased tidak valid: ${key}`);
  if (entries.length) lines.push("", `### ${title}`, "", ...entries.map(entry => `- ${entry}`));
}
for (const release of data.releases) {
  lines.push("", `## v${release.version}${release.date ? ` — ${release.date}` : " — tonggak historis"}`, "", release.summary);
  if (release.status === "historical") lines.push("", "Tanggal rilis dan status deployment tidak diketahui; versi ini menjadi baseline dokumentasi.");
  if (release.userChanges?.length) lines.push("", "### Ringkasan pengguna", "", ...release.userChanges.map(entry => `- ${entry}`));
  if (release.technicalChanges?.length) lines.push("", "### Catatan teknis", "", ...release.technicalChanges.map(entry => `- ${entry}`));
}
lines.push("");
const output = lines.join("\n");
if (process.argv.includes("--check")) {
  const existing = await readFile(destination, "utf8");
  if (existing.replace(/\r\n/g, "\n") !== output) throw new Error("CHANGELOG.md tidak sinkron. Jalankan pnpm changelog:generate.");
  console.log("CHANGELOG.md sinkron dengan sumber riwayat.");
} else {
  await writeFile(destination, output, "utf8");
  console.log("CHANGELOG.md diperbarui.");
}
