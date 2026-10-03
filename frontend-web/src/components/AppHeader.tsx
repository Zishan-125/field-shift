import OfflineStatus from "./OfflineStatus";

interface AppHeaderProps {
  backendAvailable: boolean;
}

export default function AppHeader({
  backendAvailable,
}: AppHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-lg font-bold text-white">
              FS
            </div>

            <div>
              <h1 className="text-lg font-bold text-slate-900">
                FIELD SHIFT
              </h1>

              <p className="text-xs text-slate-500">
                Farm decision support
              </p>
            </div>
          </div>
        </div>

        <OfflineStatus
          backendAvailable={backendAvailable}
        />
      </div>
    </header>
  );
}