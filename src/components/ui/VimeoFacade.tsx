import { useState } from "react";
import { useVimeoThumbnail } from "../../hooks/useVimeoThumbnail";

type VimeoFacadeProps = {
  vimeoId: string | null;
  title: string;
  /** Optional label shown over the poster (used by Selected Work tiles). */
  category?: string;
  /** Optional local poster override (bypasses the oEmbed fetch). */
  poster?: string;
  /** Caller owns sizing — defaults to 16:9; the bento grid passes "h-full". */
  className?: string;
};

const FRAME =
  "relative w-full overflow-hidden rounded-sm border border-border bg-ground";

/**
 * Lazy "facade" embed: shows a poster + play button and only loads Vimeo's
 * player iframe once the user activates it — keeping initial page load light.
 */
export function VimeoFacade({
  vimeoId,
  title,
  category,
  poster,
  className = "aspect-video",
}: VimeoFacadeProps) {
  const [playing, setPlaying] = useState(false);
  const fetchedThumb = useVimeoThumbnail(vimeoId);
  const thumb = poster ?? fetchedThumb;
  const label = category ? `${category}: ${title}` : title;

  if (!vimeoId) {
    return (
      <div
        className={`${FRAME} texture-diagonal ${className}`}
        role="img"
        aria-label={`${label}. Video coming soon.`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          {category && (
            <span className="inline-flex rounded-full border border-border px-3 py-1 font-body text-[10px] uppercase tracking-[0.15em] text-accent">
              {category}
            </span>
          )}
          <p className="font-display text-2xl text-bone">{title}</p>
          <p className="font-body text-xs uppercase tracking-[0.2em] text-bone-muted">
            Coming soon
          </p>
        </div>
      </div>
    );
  }

  if (playing) {
    return (
      <div className={`${FRAME} ${className}`}>
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0&dnt=1`}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${label}`}
      className={`group ${FRAME} ${thumb ? "" : "texture-diagonal"} cursor-pointer text-left transition-colors hover:border-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
      style={
        thumb
          ? { backgroundImage: `url(${thumb})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      <span
        className="absolute inset-0 bg-ground/30 transition-colors duration-300 group-hover:bg-ground/10"
        aria-hidden="true"
      />
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-accent bg-ground/70 text-accent backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 group-hover:bg-accent group-hover:text-ground">
          <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
      {category && (
        <>
          <span
            className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-ground to-transparent"
            aria-hidden="true"
          />
          <span className="absolute inset-x-4 bottom-4 flex flex-col gap-2" aria-hidden="true">
            <span className="inline-flex w-fit rounded-full border border-border bg-ground/40 px-3 py-1 font-body text-[10px] uppercase tracking-[0.15em] text-accent backdrop-blur-sm">
              {category}
            </span>
            <span className="font-display text-xl text-bone">{title}</span>
          </span>
        </>
      )}
    </button>
  );
}
