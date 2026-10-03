import OfflineStatus from "../OfflineStatus";

interface FarmerHeaderProps {
  backendAvailable?: boolean;
  farmerName?: string;
  fieldName?: string;
  [key: string]: unknown;
}

export default function FarmerHeader({
  backendAvailable = true,
  farmerName = "Farmer",
  fieldName = "Your field",
}: FarmerHeaderProps) {
  const firstName =
    farmerName.trim().split(/\s+/)[0] || "Farmer";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-700 text-sm font-black tracking-tight text-white shadow-sm">
              FS
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-950">
                  FIELD SHIFT
                </h1>

                <span className="hidden rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 sm:inline-flex">
                  Farm intelligence
                </span>
              </div>

              <p className="truncate text-xs text-slate-500">
                {fieldName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-slate-400">
                Good to see you
              </p>

              <p className="text-sm font-bold text-slate-800">
                {firstName}
              </p>
            </div>

            <OfflineStatus
              backendAvailable={backendAvailable}
            />
          </div>
        </div>
      </div>
    </header>
  );
}