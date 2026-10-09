import { useCallback, useEffect, useState } from "react";
import { getSession, UnauthorizedError, type InvoiceDraft } from "./api";
import { Contracts, type ContractPrefill } from "./components/Contracts";
import { Invoices } from "./components/Invoices";
import { Overview } from "./components/Overview";
import { Submissions } from "./components/Submissions";
import { saveTheme, storedTheme, type Theme } from "./theme";

type Tab = "analytics" | "inquiries" | "contracts" | "invoices";

const TABS: { id: Tab; label: string }[] = [
  { id: "analytics", label: "Analytics" },
  { id: "inquiries", label: "Inquiries" },
  { id: "contracts", label: "Contracts" },
  { id: "invoices", label: "Invoices" },
];

function tabFromHash(): Tab {
  const hash = window.location.hash.slice(1);
  return TABS.some((tab) => tab.id === hash) ? (hash as Tab) : "analytics";
}

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
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [unread, setUnread] = useState(0);
  const [theme, setTheme] = useState<Theme>(storedTheme);
  // Cross-tab hand-offs: an inquiry starts a contract, a contract starts an invoice.
  const [contractPrefill, setContractPrefill] = useState<ContractPrefill | null>(null);
  const [invoicePrefill, setInvoicePrefill] = useState<Partial<InvoiceDraft> | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<number | null>(null);

  const onUnauthorized = useCallback(() => setExpired(true), []);
  const clearContractPrefill = useCallback(() => setContractPrefill(null), []);
  const clearInvoiceIntent = useCallback(() => {
    setInvoicePrefill(null);
    setOpenInvoiceId(null);
  }, []);

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
    window.location.hash = tab === "analytics" ? "" : `#${tab}`;
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

          <nav aria-label="Dashboard sections" className="flex flex-wrap gap-2">
            {TABS.map((item) => (
              <TabButton key={item.id} active={tab === item.id} onClick={() => setTab(item.id)}>
                {item.label}
                {item.id === "inquiries" && unread > 0 && (
                  <span className="ml-2 rounded-full bg-accent/25 px-2 py-0.5 text-[10px] tabular-nums text-accent-light">
                    {unread}
                  </span>
                )}
              </TabButton>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 font-body text-xs text-bone-muted">
            {email && <span className="hidden sm:inline">{email}</span>}
            <button
              type="button"
              onClick={() => {
                const next = theme === "light" ? "dark" : "light";
                saveTheme(next);
                setTheme(next);
              }}
              className="link-underline min-h-11 hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {theme === "light" ? "Dark mode" : "Light mode"}
            </button>
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
        {tab === "analytics" && <Overview onUnauthorized={onUnauthorized} />}
        {tab === "inquiries" && (
          <Submissions
            onUnauthorized={onUnauthorized}
            onUnreadChange={setUnread}
            onDraftContract={(prefill) => {
              setContractPrefill(prefill);
              setTab("contracts");
            }}
          />
        )}
        {tab === "contracts" && (
          <Contracts
            prefill={contractPrefill}
            onPrefillUsed={clearContractPrefill}
            onCreateInvoice={(draft) => {
              setInvoicePrefill(draft);
              setTab("invoices");
            }}
            onOpenInvoice={(id) => {
              setOpenInvoiceId(id);
              setTab("invoices");
            }}
            onUnauthorized={onUnauthorized}
          />
        )}
        {tab === "invoices" && (
          <Invoices
            prefill={invoicePrefill}
            openId={openInvoiceId}
            onIntentUsed={clearInvoiceIntent}
            onUnauthorized={onUnauthorized}
          />
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
