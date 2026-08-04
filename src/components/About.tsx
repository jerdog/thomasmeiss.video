import { motion } from "motion/react";
import { channels } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { AnimatedLink } from "./ui/AnimatedLink";
import { SectionHeading } from "./ui/SectionHeading";

export function About() {
  const reduced = usePrefersReducedMotion();

  return (
    <section id="about" className="border-y border-border px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl items-start gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <SectionHeading
            title="About"
            subtitle="Storytelling, from the set to the final cut"
            className="mb-0"
          />
          <p className="mt-6 font-body text-lg leading-relaxed text-bone-muted">
            I'm Thomas Meiss — a video producer and editor from Kansas City with a B.A. in
            Film & Media Studies from the University of Kansas. My craft is storytelling at
            every stage: framing a shot behind the camera and shaping the story in the edit.
            Over the last three years I've produced and cut high-energy content on tight
            deadlines — from Big 12 athletics to brand and documentary work.
          </p>
        </motion.div>

        {/* Keeps id="channels" so existing #channels links still resolve — the
            `:target` rule in index.css supplies the fixed-header offset. */}
        <motion.div
          id="channels"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="border border-border p-8"
        >
          <h3 className="font-body text-xs uppercase tracking-widest text-bone-muted">
            Channels
          </h3>
          <ul className="mt-6 space-y-6">
            {channels.map((channel) => (
              <li key={channel.name}>
                <p className="font-display text-3xl text-bone">{channel.name}</p>
                <p className="mt-1 font-body text-sm text-bone-muted">{channel.handle}</p>
                <AnimatedLink
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${channel.name} channel (opens in new tab)`}
                  className="mt-4 inline-flex min-h-11 items-center text-sm"
                >
                  Open channel →
                </AnimatedLink>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
