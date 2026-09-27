export default function ProductFormLoading() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 animate-pulse rounded-full bg-surface-container" />
          <div>
            <div className="h-7 w-40 animate-pulse rounded bg-surface-container-high" />
            <div className="h-4 w-64 animate-pulse rounded bg-surface-container mt-2" />
          </div>
        </div>
        <div className="h-10 w-36 animate-pulse rounded-lg bg-surface-container-high" />
      </div>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="aspect-square animate-pulse rounded-xl bg-surface-container" />
          <div className="h-72 animate-pulse rounded-xl bg-surface-container-lowest" />
        </div>
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="h-44 animate-pulse rounded-xl bg-surface-container-lowest" />
          <div className="h-80 animate-pulse rounded-xl bg-surface-container-lowest" />
        </div>
      </div>
    </div>
  );
}
