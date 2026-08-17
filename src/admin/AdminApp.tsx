import { useCallback, useEffect, useState } from "react";
import { getSession, UnauthorizedError } from "./api";
import { Overview } from "./components/Overview";
import { Submissions } from "./components/Submissions";

type Tab = "analytics" | "inquiries";

/**
 * Admin shell for `/admin`.
 *
 * Authentication happens at the edge: Cloudflare Access guards `/admin*` and
 * `/api/admin*`, and the Worker re-verifies the signed assertion on every API
 * call. This component never handles credentials — it only reports who Access
 * says you are, and sends you back through the login flow when the session ends.
 */
export default function AdminApp() {
  const [email, setEmail] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [tab, setTab] = useState<Tab>(
    window.location.hash === "#inquiries" ? "inquiries" : "analytics",
  );
  const [unread, setUnread] = useState(0);

  const onUnauthorized = useCallback(() => setExpired(true), []);

  useEffect(() => {
    document.title = "Dashboard — Thomas Meiss Video";
    getSession()
      .then((session) => setEmail(session.email))
      .catch((err) => {
        if (err instanceof UnauthorizedError) setExpired(true);
        else console.error(err);
      });
  }, []);

  useEffect(() => {
    window.location.hash = tab === "inquiries" ? "#inquiries" : "";
  }, [tab]);

  if (expired) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-bone">Session expired</h1>
        <p className="mt-4 font-body text-sm text-bone-muted">
          Your Cloudflare Access session is no longer valid. Reload to sign in again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mx-auto mt-8 min-h-11 rounded-full border border-accent px-6 font-body text-xs uppercase tracking-widest text-bone transition-colors hover:bg-accent/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Reload
        </button>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-ground">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-ground"
      >
        Skip to content
      </a>

      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-5">
          <h1 className="font-display text-xl text-bone">
            Thomas Meiss Video <span className="text-bone-muted">/ Dashboard</span>
          </h1>

          <nav aria-label="Dashboard sections" className="flex gap-2">
            <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")}>
              Analytics
            </TabButton>
            <TabButton active={tab === "inquiries"} onClick={() => setTab("inquiries")}>
              Inquiries
              {unread > 0 && (
                <span className="ml-2 rounded-full bg-accent/25 px-2 py-0.5 text-[10px] tabular-nums text-accent-light">
                  {unread}
                </span>
              )}
            </TabButton>
          </nav>

          <div className="ml-auto flex items-center gap-4 font-body text-xs text-bone-muted">
            {email && <span className="hidden sm:inline">{email}</span>}
            <a href="/" className="link-underline hover:text-bone">
              View site
            </a>
            <a href="/cdn-cgi/access/logout" className="link-underline hover:text-bone">
              Sign out
            </a>
          </div>
        </div>
      </header>

      <main id="admin-main" className="mx-auto max-w-6xl px-6 py-8">
        {tab === "analytics" ? (
          <Overview onUnauthorized={onUnauthorized} />
        ) : (
          <Submissions onUnauthorized={onUnauthorized} onUnreadChange={setUnread} />
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center rounded-full border px-4 font-body text-xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active
          ? "border-accent bg-accent/15 text-bone"
          : "border-transparent text-bone-muted hover:text-bone"
      }`}
    >
      {children}
    </button>
  );
}
