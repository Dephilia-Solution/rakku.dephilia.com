"use client";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-7 w-7 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-semibold text-neutral-900">
          Halaman Bermasalah
        </h2>
        <p className="mb-5 text-sm text-neutral-600">
          Gagal memuat halaman ini. Silakan coba refresh.
        </p>
        <button
          onClick={reset}
          className="rounded-xl bg-forest px-5 py-2.5 font-semibold text-white transition-colors hover:bg-forest-dark"
        >
          Muat Ulang
        </button>
      </div>
    </div>
  );
}
