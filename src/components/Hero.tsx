import { motion } from "motion/react";
import { heroPortrait, site } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { PillButton } from "./ui/PillButton";

// Viewfinder framing marks: four L-shaped corners sitting just outside the
// image edge. Decorative — the photo carries the accessible name.
const FRAME_CORNERS = [
  "-left-3 -top-3 border-l border-t",
  "-right-3 -top-3 border-r border-t",
  "-bottom-3 -left-3 border-b border-l",
  "-bottom-3 -right-3 border-b border-r",
];

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
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="lg:order-2">
          <motion.p
            {...motionProps}
            transition={{ duration: 0.7, delay: 0 }}
            className="mb-6 font-body text-xs font-semibold uppercase tracking-[0.25em] text-accent"
          >
            {site.tagline}
          </motion.p>
          <motion.h1
            {...motionProps}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-[clamp(2.75rem,6.5vw,4.75rem)] leading-[1.05] tracking-tight text-bone"
          >
            Stories worth{" "}
            <em className="text-accent-light not-italic">telling</em> — from the first
            frame to the final cut.
          </motion.h1>
          <motion.p
            {...motionProps}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-8 max-w-xl font-body text-lg leading-relaxed text-bone-muted"
          >
            Thomas Meiss is a video producer and editor who shapes story at every stage —
            framing it behind the camera and finding it in the edit. Sports, brand, and
            documentary work, delivered with energy and craft.
          </motion.p>
          <motion.div
            {...motionProps}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-wrap gap-4"
          >
            <PillButton href="#showreel">View showreel</PillButton>
            <PillButton href="#work" variant="ghost">
              See work
            </PillButton>
          </motion.div>
        </div>

        <motion.div
          {...motionProps}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="relative mx-auto w-full max-w-md lg:order-1 lg:max-w-none"
        >
          <div className="relative">
            {heroPortrait.src ? (
              /* Light grade. Turf green is the most saturated thing on the page
                 and fights the cool palette, so it's pulled back and cooled just
                 enough to sit on the ground colour — not enough to flatten skin
                 tones or the blue kit. */
              <div className="relative overflow-hidden rounded-sm">
                <img
                  src={heroPortrait.src}
                  alt={heroPortrait.alt}
                  width={1400}
                  height={1922}
                  /* Hero image is the LCP element — never lazy-load it. */
                  fetchPriority="high"
                  decoding="async"
                  /* Source is taller than 4:5, so cover trims top and bottom.
                     Biased above centre to keep the subject and shed empty turf. */
                  className="aspect-4/5 w-full object-cover object-[50%_38%] saturate-[.82] contrast-[1.06] brightness-[.94]"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-accent/15 mix-blend-soft-light"
                />
              </div>
            ) : (
              <div className="relative aspect-4/5 w-full rounded-sm bg-ground" aria-hidden="true">
                {/* Rule-of-thirds guides — shown only while the frame is empty,
                    so they never clutter a real photograph. */}
                <span className="absolute inset-y-0 left-1/3 w-px bg-bone-muted/10" />
                <span className="absolute inset-y-0 left-2/3 w-px bg-bone-muted/10" />
                <span className="absolute inset-x-0 top-1/3 h-px bg-bone-muted/10" />
                <span className="absolute inset-x-0 top-2/3 h-px bg-bone-muted/10" />
              </div>
            )}

            {FRAME_CORNERS.map((pos) => (
              <span
                key={pos}
                aria-hidden="true"
                className={`pointer-events-none absolute h-10 w-10 border-accent/50 ${pos}`}
              />
            ))}
          </div>

          {heroPortrait.meta && (
            <p className="mt-5 font-body text-[10px] uppercase tracking-[0.25em] text-bone-muted">
              {heroPortrait.meta}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
