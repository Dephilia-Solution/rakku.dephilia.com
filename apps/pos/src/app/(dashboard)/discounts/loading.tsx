export default function DiscountsLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-neutral-200 mb-2" />
          <div className="h-4 w-64 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-xl bg-neutral-200" />
      </div>
      <div className="flex gap-2 mb-4">
        <div className="h-10 w-36 animate-pulse rounded-xl bg-neutral-200" />
        <div className="h-10 w-36 animate-pulse rounded-xl bg-neutral-200" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl bg-white shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}
