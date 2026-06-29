import { motion } from "motion/react";
import { stats } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { SectionHeading } from "./ui/SectionHeading";

export function About() {
  const reduced = usePrefersReducedMotion();

  return (
    <section id="about" className="border-y border-border px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:gap-20">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <SectionHeading
            title="About"
            subtitle="Twelve years behind the lens"
            className="mb-0"
          />
          <p className="mt-6 font-body text-lg leading-relaxed text-bone-muted">
            I'm Thomas Meiss — a freelance producer and filmmaker based in the Midwest,
            working with agencies, artists, and couples who care about craft. Whether it's
            a vérité documentary, an intimate wedding film, or a punchy brand spot, I lead
            production from concept through final delivery.
          </p>
        </motion.div>
        <motion.ul
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="flex flex-wrap items-center gap-10 lg:justify-end"
        >
          {stats.map((stat) => (
            <li key={stat.label} className="text-center">
              <p className="font-display text-5xl text-ember-light lg:text-6xl">{stat.value}</p>
              <p className="mt-2 font-body text-xs uppercase tracking-[0.2em] text-bone-muted">
                {stat.label}
              </p>
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
