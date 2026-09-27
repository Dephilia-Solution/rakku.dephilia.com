export default function ReportsLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-neutral-200" />
      <div className="mb-6 grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl bg-white shadow-sm"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-white shadow-sm" />
    </div>
  );
}
