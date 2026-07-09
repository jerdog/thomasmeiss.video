import { motion } from "motion/react";
import { projects } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { SectionHeading } from "./ui/SectionHeading";
import { VimeoFacade } from "./ui/VimeoFacade";

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
        <SectionHeading title="Selected Work" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:auto-rows-[minmax(180px,auto)]">
          {projects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
              className={`${spanClass[project.id]} ${aspectClass[project.aspect]}`}
            >
              <VimeoFacade
                vimeoId={project.vimeoId}
                title={project.title}
                category={project.category}
                className="h-full"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
