export default function OrdersLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-neutral-200" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-lg bg-neutral-200"
          />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="mb-3 h-16 animate-pulse rounded-xl bg-white shadow-sm"
        />
      ))}
    </div>
  );
}
