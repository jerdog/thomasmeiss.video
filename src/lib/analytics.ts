/**
 * First-party analytics beacons.
 *
 * Two fire-and-forget POSTs per visit, both recorded in D1 for the `/admin`
 * dashboard: a pageview on load, and Core Web Vitals once as the page is
 * hidden. No cookie, no local storage, no third-party script — the visitor
 * identifier is derived server-side and rotates daily, so there is nothing here
 * that needs a consent banner.
 */

type Vitals = Record<string, number>;

export function trackPageView(): void {
  send("/api/collect", {
    path: window.location.pathname,
    referrer: document.referrer,
  });

  void trackWebVitals();
}

/**
 * Core Web Vitals, measured with Google's `web-vitals` library.
 *
 * Dynamically imported so it stays out of the initial bundle — the public site
 * downloads it only after the page is already interactive. Metrics arrive at
 * different moments (TTFB early, INP and CLS only once the page is hidden), so
 * they are buffered and sent as a single row rather than one request each.
 */
async function trackWebVitals(): Promise<void> {
  let library;
  try {
    library = await import("web-vitals");
  } catch {
    return; // Chunk blocked or offline — analytics must never break the page.
  }

  const { onCLS, onFCP, onINP, onLCP, onTTFB } = library;
  const pending: Vitals = {};
  const record = (metric: { name: string; value: number }) => {
    pending[metric.name.toLowerCase()] = metric.value;
  };

  onCLS(record);
  onFCP(record);
  onINP(record);
  onLCP(record);
  onTTFB(record);

  /**
   * Sends whatever has arrived since the last flush, then forgets it — so a
   * metric is never reported twice, and a browser that splits the page's
   * lifecycle events across two moments produces two partial rows instead of
   * losing half the metrics.
   *
   * That is safe precisely because each metric is its own nullable column:
   * percentiles skip NULLs, so two partial rows count each metric exactly once.
   */
  const flush = () => {
    const metrics = { ...pending };
    if (Object.keys(metrics).length === 0) return;
    for (const key of Object.keys(metrics)) delete pending[key];
    send("/api/vitals", { path: window.location.pathname, ...metrics });
  };

  // web-vitals finalizes CLS and INP from a capture-phase `visibilitychange`
  // listener on window, so these bubble-phase listeners always run after it.
  // `pagehide` is the backstop for browsers that skip the visibility change.
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  addEventListener("pagehide", flush);
}

function send(url: string, payload: object): void {
  const body = JSON.stringify(payload);

  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    // Fall through to fetch — a blocked beacon must never break the page.
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
