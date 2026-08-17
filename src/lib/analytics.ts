/**
 * First-party pageview beacon.
 *
 * Sends one fire-and-forget POST per page load to `/api/collect`, which the
 * Worker records in D1 for the `/admin` dashboard. No cookie, no local storage,
 * no third-party script — the visitor identifier is derived server-side and
 * rotates daily, so there is nothing here that needs a consent banner.
 */
export function trackPageView(): void {
  const payload = JSON.stringify({
    path: window.location.pathname,
    referrer: document.referrer,
  });

  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/collect", blob)) return;
    }
  } catch {
    // Fall through to fetch — a blocked beacon must never break the page.
  }

  void fetch("/api/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}
