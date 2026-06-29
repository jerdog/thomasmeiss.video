import { motion } from "motion/react";
import { pricingTiers } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { PillButton } from "./ui/PillButton";
import { SectionLabel } from "./ui/SectionLabel";

export function Pricing() {
  const reduced = usePrefersReducedMotion();

  return (
    <section id="pricing" className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionLabel>Pricing</SectionLabel>
        <h2 className="mb-12 max-w-xl font-display text-4xl text-bone lg:text-5xl">
          Transparent packages, room to grow
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {pricingTiers.map((tier, i) => (
            <motion.article
              key={tier.name}
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className={`relative flex flex-col border p-8 transition-colors duration-300 ${
                tier.featured
                  ? "border-ember/50 bg-ember/5 lg:-translate-y-2"
                  : "border-border hover:border-bone-muted/30"
              }`}
            >
              {tier.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-ember px-3 py-1 font-body text-[10px] font-semibold uppercase tracking-widest text-ground">
                  Most booked
                </span>
              )}
              <h3 className="font-display text-2xl text-bone">{tier.name}</h3>
              <p className="mt-2 font-display text-4xl text-ember-light">{tier.price}</p>
              <p className="mt-4 font-body text-sm leading-relaxed text-bone-muted">
                {tier.description}
              </p>
              <ul className="mt-6 flex-1 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2 font-body text-sm text-bone-muted">
                    <span className="text-ember" aria-hidden="true">—</span>
                    {f}
                  </li>
                ))}
              </ul>
              <PillButton
                href="#contact"
                variant={tier.featured ? "primary" : "ghost"}
                className="mt-8 w-full"
              >
                {tier.price === "Custom" ? "Let's talk" : "Get started"}
              </PillButton>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
