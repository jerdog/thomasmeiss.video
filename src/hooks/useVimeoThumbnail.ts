import { useEffect, useState } from "react";

// Module-level cache so a reel's thumbnail is fetched once and shared between
// the featured player and its rail button (and across remounts).
const cache = new Map<string, string>();

/**
 * Resolves a Vimeo video's poster image via the public oEmbed endpoint
 * (CORS-enabled, no API key). Returns null until resolved, on failure, or when
 * `vimeoId` is null — callers fall back to the texture placeholder.
 */
export function useVimeoThumbnail(vimeoId: string | null) {
  const [thumb, setThumb] = useState<string | null>(
    vimeoId ? cache.get(vimeoId) ?? null : null,
  );

  useEffect(() => {
    if (!vimeoId) {
      setThumb(null);
      return;
    }
    const cached = cache.get(vimeoId);
    if (cached) {
      setThumb(cached);
      return;
    }

    let cancelled = false;
    const url = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}&width=1280`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("oembed failed"))))
      .then((data: { thumbnail_url?: string }) => {
        if (cancelled || !data.thumbnail_url) return;
        cache.set(vimeoId, data.thumbnail_url);
        setThumb(data.thumbnail_url);
      })
      .catch(() => {
        /* fall back to texture placeholder */
      });

    return () => {
      cancelled = true;
    };
  }, [vimeoId]);

  return thumb;
}
