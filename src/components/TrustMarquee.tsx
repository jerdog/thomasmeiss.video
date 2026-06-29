import { trustClients } from "../data/content";

export function TrustMarquee() {
  const items = [...trustClients, ...trustClients];

  return (
    <div className="overflow-x-clip border-y border-border py-5" aria-hidden="true">
      <div className="animate-marquee flex w-max max-w-none gap-12 whitespace-nowrap motion-reduce:transform-none">
        {items.map((client, i) => (
          <span
            key={`${client}-${i}`}
            className="flex items-center gap-12 font-body text-sm uppercase tracking-[0.15em] text-bone-muted"
          >
            {client}
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-ember" />
          </span>
        ))}
      </div>
    </div>
  );
}
