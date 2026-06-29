interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({
  title,
  subtitle,
  className = "mb-8",
}: SectionHeadingProps) {
  return (
    <header className={className}>
      <h2 className="font-display text-4xl leading-tight tracking-tight text-bone lg:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 max-w-xl font-body text-lg leading-relaxed text-bone-muted">
          {subtitle}
        </p>
      )}
    </header>
  );
}
