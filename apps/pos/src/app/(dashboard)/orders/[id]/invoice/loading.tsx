export default function InvoiceLoading() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="h-5 w-20 animate-pulse rounded bg-neutral-200" />
          <div className="h-9 w-24 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      </div>
      <div className="max-w-md mx-auto bg-white p-6 sm:p-8 my-4 shadow-sm rounded-2xl sm:my-8">
        <div className="text-center mb-6">
          <div className="h-7 w-32 mx-auto animate-pulse rounded bg-neutral-200 mb-2" />
          <div className="h-4 w-24 mx-auto animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="space-y-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between animate-pulse">
              <div className="h-4 w-24 rounded bg-neutral-200" />
              <div className="h-4 w-32 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-neutral-300 mb-4" />
        <div className="space-y-3 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex justify-between mb-1">
                <div className="h-4 w-40 rounded bg-neutral-200" />
                <div className="h-4 w-20 rounded bg-neutral-200" />
              </div>
              <div className="h-3 w-32 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-neutral-300 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between animate-pulse">
              <div className="h-4 w-24 rounded bg-neutral-200" />
              <div className="h-4 w-20 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
        <div className="flex justify-between pt-2 mt-2 border-t border-neutral-900 animate-pulse">
          <div className="h-5 w-16 rounded bg-neutral-200" />
          <div className="h-5 w-24 rounded bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}
