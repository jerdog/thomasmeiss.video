import { useState } from "react";
import { motion } from "motion/react";
import { showreels } from "../data/content";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { useVimeoThumbnail } from "../hooks/useVimeoThumbnail";
import { SectionHeading } from "./ui/SectionHeading";
import { VimeoFacade } from "./ui/VimeoFacade";

type Reel = (typeof showreels)[number];

function ShowreelThumb({
  reel,
  selected,
  onSelect,
}: {
  reel: Reel;
  selected: boolean;
  onSelect: () => void;
}) {
  const thumb = useVimeoThumbnail(reel.vimeoId);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Show ${reel.title}`}
      className={`group relative aspect-video overflow-hidden rounded-sm border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember ${
        selected ? "border-ember" : "border-border hover:border-bone-muted"
      } ${thumb ? "" : "texture-diagonal bg-ground"}`}
      style={
        thumb
          ? { backgroundImage: `url(${thumb})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      <span
        className={`absolute inset-0 transition-colors ${
          selected ? "bg-ground/0" : "bg-ground/50 group-hover:bg-ground/25"
        }`}
        aria-hidden="true"
      />
      <span
        className="absolute inset-x-0 bottom-0 flex items-center bg-linear-to-t from-ground to-transparent px-2 pb-1.5 pt-4"
        aria-hidden="true"
      >
        <span className="truncate font-body text-[10px] uppercase tracking-[0.15em] text-bone">
          {reel.title}
        </span>
      </span>
    </button>
  );
}

export function Showreel() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const activeReel = showreels[active];

  return (
    <section id="showreel" className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHeading title="Showreel" />
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 32 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="glow-ember relative"
        >
          <div className="relative z-10">
            {/* key remounts the facade on reel change, stopping any playback */}
            <VimeoFacade
              key={activeReel.id}
              vimeoId={activeReel.vimeoId}
              title={activeReel.title}
            />
          </div>
        </motion.div>

        {showreels.length > 1 && (
          <div
            role="group"
            aria-label="Select showreel"
            className="relative z-10 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          >
            {showreels.map((reel, i) => (
              <ShowreelThumb
                key={reel.id}
                reel={reel}
                selected={i === active}
                onSelect={() => setActive(i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
