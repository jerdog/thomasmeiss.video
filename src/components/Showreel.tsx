import { motion } from "motion/react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { SectionHeading } from "./ui/SectionHeading";

export function Showreel() {
  const reduced = usePrefersReducedMotion();

  return (
    <section id="showreel" className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading title="Showreel" />
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 32 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="glow-ember relative"
        >
          <div
            className="relative z-10 aspect-video overflow-hidden rounded-sm border border-border texture-diagonal bg-ground"
            role="img"
            aria-label="Showreel placeholder. Video coming soon."
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-display text-2xl text-bone">Coming soon</p>
              <p className="font-body text-sm uppercase tracking-[0.2em] text-bone-muted">
                Showreel video will appear here
              </p>
            </div>
            <span
              className="absolute bottom-4 right-4 rounded-full border border-border bg-ground/80 px-3 py-1 font-body text-xs text-bone-muted backdrop-blur-sm"
              aria-hidden="true"
            >
              2:47
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
