import { useCallback, useEffect, useState } from "react";
import { addDays, formatCents } from "../../../shared/money";
import {
  getInvoices,
  UnauthorizedError,
  type InvoiceDraft,
  type InvoiceFilter,
  type InvoicesPage,
} from "../api";
import { shortDay } from "../format";
import { InvoiceDetail } from "./InvoiceDetail";
import { InvoiceForm } from "./InvoiceForm";
import { Button, ErrorBanner, FilterButtons, StatusBadge, todayLocal } from "./ui";

type Filter = InvoiceFilter | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "sent", label: "Outstanding" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

const DEFAULT_DUE_DAYS = 14;

type View =
  | { mode: "list" }
  | { mode: "form"; id: number | null; number: string | null; initial: InvoiceDraft }
  | { mode: "detail"; id: number };

export function Invoices({
  prefill,
  openId,
  onIntentUsed,
  onUnauthorized,
}: {
  /** Start a new invoice from these values (e.g. a contract's deposit). */
  prefill: Partial<InvoiceDraft> | null;
  /** Open this invoice directly. */
  openId: number | null;
  onIntentUsed: () => void;
  onUnauthorized: () => void;
}) {
  const [view, setView] = useState<View>({ mode: "list" });
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState<InvoicesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const blankDraft = useCallback(
    (overrides: Partial<InvoiceDraft> = {}): InvoiceDraft => {
      const today = todayLocal();
      return {
        client: { name: "", email: "", company: "", phone: "", address: "" },
        contractId: null,
        issueDate: today,
        dueDate: addDays(today, DEFAULT_DUE_DAYS),
        items: [],
        taxRate: 0,
        notes: "",
        paymentInstructions: page?.defaults.paymentInstructions ?? "",
        ...overrides,
      };
    },
    [page],
  );

  useEffect(() => {
    if (openId) {
      setView({ mode: "detail", id: openId });
      onIntentUsed();
    } else if (prefill && page) {
      // Waits for the first page so the payment-instructions default is known.
      setView({ mode: "form", id: null, number: null, initial: blankDraft(prefill) });
      onIntentUsed();
    }
  }, [openId, prefill, page, blankDraft, onIntentUsed]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPage(await getInvoices(filter === "all" ? null : filter));
      setError("");
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized();
      setError(err instanceof Error ? err.message : "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }, [filter, onUnauthorized]);

  useEffect(() => {
    if (view.mode === "list") void load();
  }, [view.mode, load]);

  if (view.mode === "form") {
    return (
      <InvoiceForm
        key={view.id ?? "new"}
        invoiceId={view.id}
        number={view.number}
        initial={view.initial}
        onSaved={(id) => setView({ mode: "detail", id })}
        onCancel={() => setView(view.id ? { mode: "detail", id: view.id } : { mode: "list" })}
        onUnauthorized={onUnauthorized}
      />
    );
  }

  if (view.mode === "detail") {
    return (
      <InvoiceDetail
        id={view.id}
        onBack={() => setView({ mode: "list" })}
        onEdit={(invoice) =>
          setView({
            mode: "form",
            id: invoice.id,
            number: invoice.number,
            initial: {
              client: invoice.client,
              contractId: invoice.contractId,
              issueDate: invoice.issueDate,
              dueDate: invoice.dueDate,
              items: invoice.items,
              taxRate: invoice.taxRate,
              notes: invoice.notes ?? "",
              paymentInstructions: invoice.paymentInstructions ?? "",
            },
          })
        }
        onUnauthorized={onUnauthorized}
      />
    );
  }

  const today = todayLocal();
  const counts: Partial<Record<Filter, number>> | undefined = page
    ? {
        ...page.counts,
        all: page.counts.draft + page.counts.sent + page.counts.paid + page.counts.void,
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-bone">Invoices</h2>
        <Button
          variant="primary"
          onClick={() => setView({ mode: "form", id: null, number: null, initial: blankDraft() })}
        >
          New invoice
        </Button>
      </div>

      {page && (
        <dl className="grid gap-4 sm:grid-cols-3">
          <Tile label="Outstanding" value={formatCents(page.summary.outstandingCents)} />
          <Tile
            label="Overdue"
            value={formatCents(page.summary.overdueCents)}
            footnote={`${page.counts.overdue} invoice${page.counts.overdue === 1 ? "" : "s"}`}
          />
          <Tile label="Paid this year" value={formatCents(page.summary.paidThisYearCents)} />
        </dl>
      )}

      <FilterButtons
        label="Filter by status"
        options={FILTERS}
        value={filter}
        counts={counts}
        onChange={setFilter}
      />

      <ErrorBanner message={error} />

      {!page || page.items.length === 0 ? (
        <p className="font-body text-sm text-bone-muted" role="status">
          {loading ? "Loading invoices…" : filter === "all" ? "No invoices yet." : "Nothing here."}
        </p>
      ) : (
        <ul className="space-y-3">
          {page.items.map((invoice) => {
            const overdue = invoice.status === "sent" && invoice.due_date < today;
            return (
              <li key={invoice.id} className="rounded border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => setView({ mode: "detail", id: invoice.id })}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <StatusBadge status={overdue ? "overdue" : invoice.status} />
                  <span className="font-body text-sm font-semibold tabular-nums text-bone">
                    {invoice.number}
                  </span>
                  <span className="font-body text-sm text-bone-muted">
                    {invoice.client_company || invoice.client_name}
                  </span>
                  {invoice.email_error && (
                    <span className="font-body text-xs text-warning">⚠ email failed</span>
                  )}
                  <span className="ml-auto font-body text-sm tabular-nums text-bone">
                    {formatCents(invoice.total_cents)}
                  </span>
                  <span className="w-full font-body text-xs tabular-nums text-bone-muted sm:w-auto">
                    {invoice.status === "paid" ? "Paid" : `Due ${shortDay(invoice.due_date)}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Tile({ label, value, footnote }: { label: string; value: string; footnote?: string }) {
  return (
    <div className="rounded border border-border bg-surface p-5">
      <dt className="font-body text-xs uppercase tracking-widest text-bone-muted">{label}</dt>
      <dd className="mt-2 font-display text-3xl tabular-nums text-bone">{value}</dd>
      {footnote && <dd className="mt-1 font-body text-xs text-bone-muted">{footnote}</dd>}
    </div>
  );
}
