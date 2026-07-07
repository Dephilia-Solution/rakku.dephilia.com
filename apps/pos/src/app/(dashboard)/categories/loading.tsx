export default function AdminCategoriesLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-neutral-200" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="mb-2 h-14 animate-pulse rounded-xl bg-white shadow-sm"
        />
      ))}
    </div>
  );
}
