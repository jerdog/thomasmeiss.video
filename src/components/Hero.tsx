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
          className="mb-6 font-body text-xs font-semibold uppercase tracking-[0.25em] text-ember"
        >
          {site.tagline}
        </motion.p>
        <motion.h1
          {...motionProps}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="max-w-4xl font-display text-[clamp(2.75rem,8vw,5.5rem)] leading-[1.05] tracking-tight text-bone"
        >
          Stories worth{" "}
          <em className="text-ember-light not-italic">framing</em> — documentary,
          wedding, and commercial film.
        </motion.h1>
        <motion.p
          {...motionProps}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 max-w-xl font-body text-lg leading-relaxed text-bone-muted"
        >
          Thomas Meiss produces cinematic video for ad agencies, recording artists,
          startups, and couples. From first treatment to final grade — one producer,
          full craft.
        </motion.p>
        <motion.div
          {...motionProps}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-wrap gap-4"
        >
          <PillButton href="#showreel">View showreel</PillButton>
          <PillButton href="#pricing" variant="ghost">
            See pricing
          </PillButton>
        </motion.div>
      </div>
    </section>
  );
}
