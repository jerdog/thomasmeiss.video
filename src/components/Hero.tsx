import { motion } from "motion/react";
import { site } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { PillButton } from "./ui/PillButton";

export function Hero() {
  const reduced = usePrefersReducedMotion();
  const motionProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.7 },
      };

  return (
    <section className="relative px-6 pb-24 pt-36 lg:px-10 lg:pb-32 lg:pt-44">
      <div className="mx-auto max-w-7xl">
        <motion.p
          {...motionProps}
          transition={{ duration: 0.7, delay: 0 }}
          className="mb-6 font-body text-xs font-semibold uppercase tracking-[0.25em] text-accent"
        >
          {site.tagline}
        </motion.p>
        <motion.h1
          {...motionProps}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="max-w-4xl font-display text-[clamp(2.75rem,8vw,5.5rem)] leading-[1.05] tracking-tight text-bone"
        >
          Stories worth{" "}
          <em className="text-accent-light not-italic">telling</em> — from the first
          frame to the final cut.
        </motion.h1>
        <motion.p
          {...motionProps}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 max-w-xl font-body text-lg leading-relaxed text-bone-muted"
        >
          Thomas Meiss is a video producer and editor who shapes story at every stage —
          framing it behind the camera and finding it in the edit. Sports, brand, and
          documentary work, delivered with energy and craft.
        </motion.p>
        <motion.div
          {...motionProps}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-wrap gap-4"
        >
          <PillButton href="#showreel">View showreel</PillButton>
          <PillButton href="#work" variant="ghost">
            See work
          </PillButton>
        </motion.div>
      </div>
    </section>
  );
}
