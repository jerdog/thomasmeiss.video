import { motion } from "motion/react";
import { projects } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { SectionLabel } from "./ui/SectionLabel";

const spanClass: Record<string, string> = {
  documentary: "md:col-span-4 md:row-span-1",
  wedding: "md:col-span-2 md:row-span-2",
  commercial: "md:col-span-2 md:row-span-2",
  aerial: "md:col-span-4 md:row-span-1",
};

const aspectClass: Record<string, string> = {
  wide: "aspect-video",
  tall: "aspect-[4/5]",
};

export function WorkGrid() {
  const reduced = usePrefersReducedMotion();

  return (
    <section id="work" className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionLabel>Selected Work</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:auto-rows-[minmax(180px,auto)]">
          {projects.map((project, i) => (
            <motion.a
              key={project.id}
              href={project.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
              whileHover={reduced ? undefined : { scale: 1.02 }}
              className={`group relative overflow-hidden rounded-sm border border-border texture-diagonal bg-ground transition-colors duration-300 hover:border-ember/40 hover:shadow-[0_0_48px_oklch(0.72_0.17_48_/_0.08)] ${spanClass[project.id]} ${aspectClass[project.aspect]} flex flex-col justify-end p-5`}
            >
              <span className="mb-3 inline-flex w-fit rounded-full border border-border px-3 py-1 font-body text-[10px] uppercase tracking-[0.15em] text-ember">
                {project.category}
              </span>
              <div className="flex items-end justify-between gap-4">
                <h3 className="font-display text-2xl text-bone">{project.title}</h3>
                <span className="translate-x-2 font-body text-sm text-bone-muted opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
                  {project.platform} →
                </span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
