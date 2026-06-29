interface SectionLabelProps {
  children: string;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-ember">
        {children}
      </span>
      <span className="h-px flex-1 max-w-16 bg-border hairline" aria-hidden="true" />
    </div>
  );
}
