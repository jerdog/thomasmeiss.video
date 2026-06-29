import { useState } from "react";
import { motion } from "motion/react";
import { services } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { SectionLabel } from "./ui/SectionLabel";

const PANEL_ID = "services-panel";

function tabId(index: number) {
  return `service-tab-${index}`;
}

export function Services() {
  const [active, setActive] = useState(0);
  const reduced = usePrefersReducedMotion();
  const activeService = services[active];

  return (
    <section id="services" className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[280px_1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionLabel>Services</SectionLabel>
          <h2 className="font-display text-4xl leading-tight text-bone lg:text-5xl">
            What I bring to your project
          </h2>
          <ul className="mt-10 space-y-2" role="tablist" aria-label="Services">
            {services.map((service, i) => (
              <li key={service.num} role="presentation">
                <button
                  type="button"
                  id={tabId(i)}
                  role="tab"
                  aria-selected={active === i}
                  aria-controls={PANEL_ID}
                  tabIndex={active === i ? 0 : -1}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  className={`group flex w-full items-center gap-4 border-b border-border py-4 text-left transition-colors ${
                    active === i ? "text-ember" : "text-bone-muted hover:text-bone"
                  }`}
                >
                  <span className="font-body text-xs tracking-widest">{service.num}</span>
                  <span className="flex-1 font-display text-xl">{service.title}</span>
                  <span
                    className={`translate-x-0 transition-transform duration-300 ${
                      active === i ? "translate-x-1 opacity-100" : "-translate-x-2 opacity-0"
                    } group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:translate-x-1 group-focus-visible:opacity-100`}
                    aria-hidden="true"
                  >
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={tabId(active)}
          tabIndex={0}
          className="flex min-h-[280px] items-center border border-border p-8 lg:p-12"
        >
          <motion.div
            key={active}
            initial={reduced ? false : { opacity: 0, x: 16 }}
            animate={reduced ? undefined : { opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <p className="mb-2 font-body text-xs uppercase tracking-[0.2em] text-ember">
              {activeService.num} — {activeService.title}
            </p>
            <p className="max-w-lg font-body text-lg leading-relaxed text-bone-muted">
              {activeService.description}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
