import { motion } from "motion/react";
import { projects } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { SectionHeading } from "./ui/SectionHeading";
import { VimeoFacade } from "./ui/VimeoFacade";

/**
 * Bento columns on a 12-col grid. Keyed off the `span` union in content.ts, so
 * adding a project with an unknown span is a compile error rather than an
 * `undefined` className that silently drops the tile out of the layout.
 */
type ProjectSpan = (typeof projects)[number]["span"];

const spanClass: Record<ProjectSpan, string> = {
  feature: "md:col-span-8",
  // No integer span pairs a 1:1 tile to a 16:9 one at equal height, so the
  // square is bottom-aligned: row 1 keeps a clean baseline and the offset
  // reads as deliberate rather than as a ragged edge.
  accent: "md:col-span-4 md:self-end",
  half: "md:col-span-6",
};

export function WorkGrid() {
  const reduced = usePrefersReducedMotion();

  return (
    <section id="work" className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading title="Selected Work" />
        {/* items-start, not stretch: a stretched row would override each tile's
            aspect-ratio and distort the square graphic. */}
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-12">
          {projects.map((project, i) => (
            <motion.div
              key={project.id}
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
              style={{ aspectRatio: project.ratio }}
              className={spanClass[project.span]}
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
