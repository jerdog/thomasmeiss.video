import { motion } from "motion/react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export function Showreel() {
  const reduced = usePrefersReducedMotion();

  return (
    <section id="showreel" className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-8 font-display text-4xl leading-tight tracking-tight text-bone lg:text-5xl">
          Showreel
        </h2>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 32 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="glow-ember relative"
        >
          <div className="relative z-10 aspect-video overflow-hidden rounded-sm border border-border texture-diagonal bg-ground">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <button
                type="button"
                className="group flex h-16 w-16 items-center justify-center rounded-full border border-bone/30 bg-ground/60 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-ember hover:shadow-[0_0_40px_oklch(0.72_0.17_48_/_0.25)]"
                aria-label="Play showreel"
              >
                <span className="ml-1 block h-0 w-0 border-y-[8px] border-l-[14px] border-y-transparent border-l-bone transition-colors group-hover:border-l-ember-light" />
              </button>
              <p className="font-body text-sm uppercase tracking-[0.2em] text-bone-muted">
                Drop showreel here
              </p>
            </div>
            <span className="absolute bottom-4 right-4 rounded-full border border-border bg-ground/80 px-3 py-1 font-body text-xs text-bone-muted backdrop-blur-sm">
              2:47
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
