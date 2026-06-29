import { motion } from "motion/react";
import { channels } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { AnimatedLink } from "./ui/AnimatedLink";
import { SectionLabel } from "./ui/SectionLabel";

export function Channels() {
  const reduced = usePrefersReducedMotion();

  return (
    <section id="channels" className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionLabel>Channels</SectionLabel>
        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((channel, i) => (
            <motion.div
              key={channel.name}
              initial={reduced ? false : { opacity: 0, y: 20 }}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              whileHover={reduced ? undefined : { y: -4 }}
              className="border border-border p-8 transition-colors duration-300 hover:border-ember/30"
            >
              <h3 className="font-display text-3xl text-bone">{channel.name}</h3>
              <dl className="mt-6 flex gap-10">
                <div>
                  <dt className="font-body text-xs uppercase tracking-widest text-bone-muted">Films</dt>
                  <dd className="mt-1 font-display text-2xl text-ember-light">{channel.films}</dd>
                </div>
                <div>
                  <dt className="font-body text-xs uppercase tracking-widest text-bone-muted">Followers</dt>
                  <dd className="mt-1 font-display text-2xl text-ember-light">{channel.followers}</dd>
                </div>
              </dl>
              <AnimatedLink
                href={channel.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-block text-sm"
              >
                Open channel →
              </AnimatedLink>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
