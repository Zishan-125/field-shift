interface StatusBadgeProps {
  label: string;
  status?: "good" | "moderate" | "attention" | "offline";
}

export default function StatusBadge({
  label,
  status = "good",
}: StatusBadgeProps) {
  const styles = {
    good: "bg-green-100 text-green-700",
    moderate: "bg-amber-100 text-amber-700",
    attention: "bg-red-100 text-red-700",
    offline: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${styles[status]}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />

      {label}
    </span>
  );
}