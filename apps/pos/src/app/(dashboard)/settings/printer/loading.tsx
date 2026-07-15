export default function PrinterSettingsLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-52 animate-pulse rounded bg-neutral-200 mb-2" />
          <div className="h-4 w-64 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="h-7 w-24 animate-pulse rounded-full bg-neutral-200" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl bg-white shadow-sm border border-neutral-100"
          />
        ))}
      </div>
    </div>
  );
}
