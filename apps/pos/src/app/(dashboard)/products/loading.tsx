export default function AdminProductsLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-200" />
        <div className="h-10 w-36 animate-pulse rounded-xl bg-neutral-200" />
      </div>
      <div className="mb-4 flex gap-3">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-neutral-200" />
        <div className="h-10 w-40 animate-pulse rounded-xl bg-neutral-200" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="mb-2 h-14 animate-pulse rounded-xl bg-white shadow-sm"
        />
      ))}
    </div>
  );
}
