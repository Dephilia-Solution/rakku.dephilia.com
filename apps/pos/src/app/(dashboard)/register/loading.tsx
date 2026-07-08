export default function RegisterLoading() {
  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 md:ml-16">
        <div className="mb-4 h-11 w-full animate-pulse rounded-xl bg-neutral-200" />
        <div className="mb-4 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-20 animate-pulse rounded-full bg-neutral-200"
            />
          ))}
        </div>
        <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl bg-white shadow-sm"
            >
              <div className="h-[120px] rounded-t-xl bg-neutral-200" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 rounded bg-neutral-200" />
                <div className="h-4 w-1/2 rounded bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden w-[380px] animate-pulse border-l border-neutral-200 bg-white p-5 md:flex">
        <div className="mb-6 h-6 w-3/4 rounded bg-neutral-200" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-4 space-y-2">
            <div className="h-4 w-1/2 rounded bg-neutral-200" />
            <div className="h-4 w-1/3 rounded bg-neutral-200" />
          </div>
        ))}
        <div className="mt-8 h-12 w-full rounded-xl bg-neutral-200" />
      </div>
    </div>
  );
}
