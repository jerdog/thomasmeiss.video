import { useState } from "react";
import { useVimeoThumbnail } from "../../hooks/useVimeoThumbnail";

type VimeoFacadeProps = {
  vimeoId: string | null;
  title: string;
  /** Optional local poster override (bypasses the oEmbed fetch). */
  poster?: string;
  className?: string;
};

const FRAME =
  "relative aspect-video w-full overflow-hidden rounded-sm border border-border bg-ground";

/**
 * Lazy "facade" embed: shows a poster + play button and only loads Vimeo's
 * player iframe once the user activates it — keeping initial page load light.
 */
export function VimeoFacade({ vimeoId, title, poster, className = "" }: VimeoFacadeProps) {
  const [playing, setPlaying] = useState(false);
  const fetchedThumb = useVimeoThumbnail(vimeoId);
  const thumb = poster ?? fetchedThumb;

  if (!vimeoId) {
    return (
      <div
        className={`${FRAME} texture-diagonal ${className}`}
        role="img"
        aria-label={`${title}. Video coming soon.`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-display text-2xl text-bone">Coming soon</p>
          <p className="font-body text-sm uppercase tracking-[0.2em] text-bone-muted">
            {title}
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
      aria-label={`Play ${title}`}
      className={`group ${FRAME} ${thumb ? "" : "texture-diagonal"} cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
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
      <span
        className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-ground to-transparent"
        aria-hidden="true"
      />
      <span
        className="absolute bottom-4 left-4 font-body text-xs uppercase tracking-[0.2em] text-bone"
        aria-hidden="true"
      >
        {title}
      </span>
    </button>
  );
}
