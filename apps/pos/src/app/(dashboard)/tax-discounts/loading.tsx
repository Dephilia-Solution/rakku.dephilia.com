export default function TaxDiscountsLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-container-high" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-surface-container-high" />
      </div>
      <div className="h-11 w-80 animate-pulse rounded-xl bg-surface-container mb-5" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="mb-2 h-20 animate-pulse rounded-xl bg-surface-container-lowest"
        />
      ))}
    </div>
  );
}
