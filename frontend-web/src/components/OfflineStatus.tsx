interface OfflineStatusProps {
  backendAvailable: boolean;
}

export default function OfflineStatus({
  backendAvailable,
}: OfflineStatusProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
      <span className="h-2 w-2 rounded-full bg-emerald-500" />

      {backendAvailable
        ? "Offline mode ready"
        : "Using saved farm data"}
    </div>
  );
}