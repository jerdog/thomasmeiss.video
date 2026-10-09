import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, storedTheme } from "./admin/theme";
import { trackPageView } from "./lib/analytics";
import "./index.css";

// The dashboard and the contract-signing page are separate chunks: the public
// site never downloads them.
const AdminApp = lazy(() => import("./admin/AdminApp"));
const SignApp = lazy(() => import("./sign/SignApp"));

const { pathname } = window.location;
const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
// A client's private signing link — never counted as a site visit.
const isSign = pathname.startsWith("/sign/");

if (!isAdmin && !isSign) trackPageView();
// Before first paint, so the dashboard never flashes the dark site palette.
if (isAdmin) applyTheme(storedTheme());

function Loading({ label }: { label: string }) {
  return (
    <p className="p-6 font-body text-sm text-bone-muted" role="status">
      {label}
    </p>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={<Loading label="Loading dashboard…" />}>
        <AdminApp />
      </Suspense>
    ) : isSign ? (
      <Suspense fallback={<Loading label="Loading contract…" />}>
        <SignApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
