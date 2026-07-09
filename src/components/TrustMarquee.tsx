import { useState } from "react";
import { trustClients } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export function TrustMarquee() {
  const items = [...trustClients, ...trustClients];
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);

  return (
    <section aria-label="Trusted by" className="relative border-y border-border">
      {/* Accessible, non-duplicated list for assistive tech */}
      <ul className="sr-only">
        {trustClients.map((client) => (
          <li key={client}>{client}</li>
        ))}
      </ul>

      {/* Visual scrolling track (decorative — duplicated items) */}
      <div className="overflow-x-clip py-5" aria-hidden="true">
        <div
          className="animate-marquee flex w-max max-w-none gap-12 whitespace-nowrap motion-reduce:transform-none"
          style={{ animationPlayState: paused ? "paused" : "running" }}
        >
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

      {!reduced && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? "Resume scrolling client list" : "Pause scrolling client list"}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-ground/80 text-bone-muted backdrop-blur-sm transition-colors hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          {paused ? (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          )}
        </button>
      )}
    </section>
  );
}
