interface SectionTitleProps {
  eyebrow: string;
  title: string;
  description?: string;
}

export default function SectionTitle({
  eyebrow,
  title,
  description,
}: SectionTitleProps) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-600">
        {eyebrow}
      </p>

      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>

      {description && (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}