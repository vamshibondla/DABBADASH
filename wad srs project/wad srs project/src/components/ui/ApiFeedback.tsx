interface ApiFeedbackProps {
  isLoading: boolean;
  error: string | null;
  onRetry: () => Promise<void>;
}

export function ApiFeedback({ isLoading, error, onRetry }: ApiFeedbackProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Loading live dashboard data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void onRetry().catch(() => undefined)}
          className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  return null;
}
