import { useCallback, useEffect, useRef, useState } from "react";
import { emptyAnswers, type ContractAnswers } from "../../../shared/contract";
import { formatCents } from "../../../shared/money";
import {
  getContracts,
  UnauthorizedError,
  type ContractStatus,
  type ContractSummary,
  type InvoiceDraft,
} from "../api";
import { dateTime } from "../format";
import { ContractDetail } from "./ContractDetail";
import { ContractForm } from "./ContractForm";
import { Button, ErrorBanner, FilterButtons, StatusBadge } from "./ui";

type Filter = ContractStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "sent", label: "Awaiting signature" },
  { value: "signed", label: "Signed" },
  { value: "void", label: "Void" },
];

/** A contract to start from an inquiry: the answers it can fill in, and its id. */
export interface ContractPrefill {
  answers: Partial<ContractAnswers>;
  submissionId: number | null;
}

type View =
  | { mode: "list" }
  | { mode: "form"; id: number | null; initial: ContractAnswers; submissionId: number | null }
  | { mode: "detail"; id: number };

export function Contracts({
  prefill,
  onPrefillUsed,
  onCreateInvoice,
  onOpenInvoice,
  onUnauthorized,
}: {
  prefill: ContractPrefill | null;
  onPrefillUsed: () => void;
  onCreateInvoice: (draft: Partial<InvoiceDraft>) => void;
  onOpenInvoice: (id: number) => void;
  onUnauthorized: () => void;
}) {
  const [view, setView] = useState<View>({ mode: "list" });
  // Back from a detail or form view: focus the list heading (WCAG 2.4.3).
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousMode = useRef(view.mode);
  useEffect(() => {
    if (view.mode === "list" && previousMode.current !== "list") listHeadingRef.current?.focus();
    previousMode.current = view.mode;
  }, [view.mode]);
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<ContractSummary[]>([]);
  const [counts, setCounts] = useState<Partial<Record<Filter, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!prefill) return;
    const defaults = emptyAnswers();
    setView({
      mode: "form",
      id: null,
      initial: {
        ...defaults,
        ...prefill.answers,
        client: { ...defaults.client, ...prefill.answers.client },
      },
      submissionId: prefill.submissionId,
    });
    onPrefillUsed();
  }, [prefill, onPrefillUsed]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await getContracts(filter === "all" ? null : filter);
      setItems(page.items);
      const all = Object.values(page.counts).reduce((sum, n) => sum + n, 0);
      setCounts({ ...page.counts, all });
      setError("");
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized();
      setError(err instanceof Error ? err.message : "Could not load contracts.");
    } finally {
      setLoading(false);
    }
  }, [filter, onUnauthorized]);

  useEffect(() => {
    if (view.mode === "list") void load();
  }, [view.mode, load]);

  if (view.mode === "form") {
    return (
      <ContractForm
        key={view.id ?? "new"}
        contractId={view.id}
        initial={view.initial}
        submissionId={view.submissionId}
        onSaved={(id) => setView({ mode: "detail", id })}
        onCancel={() => setView(view.id ? { mode: "detail", id: view.id } : { mode: "list" })}
        onUnauthorized={onUnauthorized}
      />
    );
  }

  if (view.mode === "detail") {
    return (
      <ContractDetail
        id={view.id}
        onBack={() => setView({ mode: "list" })}
        onEdit={(contract) =>
          setView({
            mode: "form",
            id: contract.id,
            initial: contract.answers,
            submissionId: contract.submissionId,
          })
        }
        onCreateInvoice={onCreateInvoice}
        onOpenInvoice={onOpenInvoice}
        onUnauthorized={onUnauthorized}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={listHeadingRef} tabIndex={-1} className="font-display text-2xl text-bone outline-none">
          Contracts
        </h2>
        <Button
          variant="primary"
          onClick={() =>
            setView({ mode: "form", id: null, initial: emptyAnswers(), submissionId: null })
          }
        >
          New contract
        </Button>
      </div>

      <FilterButtons
        label="Filter by status"
        options={FILTERS}
        value={filter}
        counts={counts}
        onChange={setFilter}
      />

      <ErrorBanner message={error} />

      {items.length === 0 ? (
        <p className="font-body text-sm text-bone-muted" role="status">
          {loading
            ? "Loading contracts…"
            : filter === "all"
              ? "No contracts yet. Start one here, or from an inquiry."
              : "Nothing here."}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((contract) => (
            <li key={contract.id} className="rounded border border-border bg-surface">
              <button
                type="button"
                onClick={() => setView({ mode: "detail", id: contract.id })}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <StatusBadge status={contract.status} />
                <span className="font-body text-sm font-semibold text-bone">{contract.title}</span>
                <span className="font-body text-sm text-bone-muted">{contract.client_name}</span>
                {contract.email_error && contract.status === "draft" && (
                  <span className="font-body text-xs text-warning">⚠ send failed</span>
                )}
                <span className="ml-auto font-body text-sm tabular-nums text-bone">
                  {formatCents(contract.fee_cents)}
                </span>
                <span className="w-full font-body text-xs tabular-nums text-bone-muted sm:w-auto">
                  {contract.signed_at
                    ? `Signed ${dateTime(contract.signed_at)}`
                    : contract.sent_at
                      ? `Sent ${dateTime(contract.sent_at)}`
                      : `Updated ${dateTime(contract.updated_at)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
