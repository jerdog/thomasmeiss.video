import { useEffect, useRef, useState } from "react";

/** Charts are drawn at measured pixel width so text never scales with a viewBox. */
export function useMeasuredWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/**
 * Axis top = a whole-number tick step × the tick count, so every gridline lands
 * on a clean integer (these are counts — a "7.5 views" tick is nonsense) without
 * leaving the data stranded at the bottom of an over-tall axis.
 */
export function niceMax(max: number, tickCount = 4): number {
  if (max <= tickCount) return tickCount;
  const rawStep = max / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (NICE_STEPS.find((s) => normalized <= s + 1e-9) ?? 10) * magnitude;
  return Math.ceil(step) * tickCount;
}

export function axisTicks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

/** Evenly spaced x positions — one slot per day in the range. */
export function xAt(index: number, count: number, left: number, plotWidth: number) {
  return count <= 1 ? left + plotWidth / 2 : left + (plotWidth * index) / (count - 1);
}
