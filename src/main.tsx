import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { trackPageView } from "./lib/analytics";
import "./index.css";

// The dashboard is a separate chunk: the public site never downloads it.
const AdminApp = lazy(() => import("./admin/AdminApp"));

const isAdmin =
  window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");

if (!isAdmin) trackPageView();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense
        fallback={
          <p className="p-6 font-body text-sm text-bone-muted" role="status">
            Loading dashboard…
          </p>
        }
      >
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
