import { motion } from "motion/react";
import { showreel } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { SectionHeading } from "./ui/SectionHeading";
import { VimeoFacade } from "./ui/VimeoFacade";

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
          className="glow-accent relative"
        >
          <div className="relative z-10">
            <VimeoFacade vimeoId={showreel.vimeoId} title={showreel.title} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
