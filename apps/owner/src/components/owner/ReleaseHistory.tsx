import { ArrowLeft, History } from "lucide-react";
import { MerchantLink } from "@/lib/merchant-runtime";
import releaseNotes from "@/content/release-notes.json";

function formatReleaseDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export default function ReleaseHistory() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <MerchantLink href="/settings" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <ArrowLeft size={16} aria-hidden="true" />
          Pengaturan
        </MerchantLink>
        <h1 className="mt-2 text-2xl font-bold text-on-surface">Riwayat Pembaruan</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Lihat hal baru dan peningkatan di Rakku.</p>
      </div>

      <section aria-label="Versi aplikasi Owner" className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <History size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold text-on-surface">Versi aplikasi Owner</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {releaseNotes.buildVersion ? `v${releaseNotes.buildVersion}` : "Versi build belum ditetapkan."}
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {releaseNotes.releases.map((release) => (
          <article key={release.version} className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg font-bold text-on-surface">v{release.version}</h2>
              <span className="text-xs font-medium text-on-surface-variant">
                {release.date ? formatReleaseDate(release.date) : "Tonggak historis"}
              </span>
            </div>
            <h3 className="mt-3 font-semibold text-on-surface">{release.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{release.summary}</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-on-surface-variant">
              {release.userChanges.map((change) => <li key={change}>{change}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
