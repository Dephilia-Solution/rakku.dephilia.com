import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/dependency-audit-summary.mjs <audit.json>");
  process.exit(2);
}
let report;
try {
  report = JSON.parse(readFileSync(path, "utf8"));
} catch {
  console.error("Audit report is missing or not valid JSON; refusing to report a clean audit.");
  process.exit(1);
}

const findings = [];
for (const advisory of Object.values(report.advisories ?? {})) {
  findings.push({
    severity: advisory.severity,
    package: advisory.module_name,
    id: advisory.github_advisory_id ?? String(advisory.id ?? ""),
    title: advisory.title,
    url: advisory.url,
  });
}
for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
  const details = via.filter(item => item && typeof item === "object");
  if (!details.length) {
    findings.push({ severity: vulnerability.severity, package: name, id: "", title: "", url: "" });
  }
  for (const item of details) {
    findings.push({
      severity: item.severity ?? vulnerability.severity,
      package: name,
      id: item.github_advisory_id ?? item.source ?? "",
      title: item.title ?? "",
      url: item.url ?? "",
    });
  }
}

const counts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
for (const finding of findings) {
  const severity = String(finding.severity ?? "info").toLowerCase();
  if (severity in counts) counts[severity]++;
}
const knownBraces = (finding) =>
  finding.package === "braces" && (
    String(finding.id).includes("vfj7-8cjw-p6xm") ||
    String(finding.url).includes("vfj7-8cjw-p6xm") ||
    String(finding.title).toLowerCase().includes("braces")
  );
const unmitigatedHigh = findings.filter(finding =>
  String(finding.severity).toLowerCase() === "high" && !knownBraces(finding)
);
const critical = findings.filter(finding => String(finding.severity).toLowerCase() === "critical");

console.log(JSON.stringify({
  counts,
  raw_findings: findings.length,
  known_patched_high: findings.filter(knownBraces).length,
  unmitigated_high: unmitigatedHigh.length,
  critical: critical.length,
}, null, 2));
for (const finding of critical) console.error(`CRITICAL ${finding.package} ${finding.id} ${finding.title}`);
for (const finding of unmitigatedHigh) console.error(`HIGH ${finding.package} ${finding.id} ${finding.title}`);
if (critical.length || unmitigatedHigh.length) process.exitCode = 1;
