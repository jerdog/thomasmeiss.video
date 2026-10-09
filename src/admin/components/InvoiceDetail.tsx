import { useCallback, useEffect, useState } from "react";
import { site } from "../../data/content";
import { InvoicePaper } from "../../documents/InvoicePaper";
import {
  deleteInvoice,
  getInvoice,
  invoiceAction,
  UnauthorizedError,
  type Invoice,
} from "../api";
import { dateTime } from "../format";
import {
  BackButton,
  Button,
  ErrorBanner,
  Notice,
  StatusBadge,
  emailFailureHint,
  todayLocal,
  useFocusOnMount,
} from "./ui";

export function InvoiceDetail({
  id,
  onBack,
  onEdit,
  onUnauthorized,
}: {
  id: number;
  onBack: () => void;
  onEdit: (invoice: Invoice) => void;
  onUnauthorized: () => void;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const headingRef = useFocusOnMount<HTMLHeadingElement>(invoice !== null);

  const load = useCallback(async () => {
    try {
      setInvoice((await getInvoice(id)).invoice);
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized();
      setError(err instanceof Error ? err.message : "Could not load the invoice.");
    }
  }, [id, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: Parameters<typeof invoiceAction>[1], success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await invoiceAction(id, action);
      setNotice(success);
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized();
      setError(emailFailureHint(err instanceof Error ? err.message : "Something went wrong."));
    } finally {
      await load();
      setBusy(false);
    }
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <BackButton onClick={onBack}>Invoices</BackButton>
        <ErrorBanner message={error} />
        {!error && (
          <p className="font-body text-sm text-bone-muted" role="status">
            Loading invoice…
          </p>
        )}
      </div>
    );
  }

  const { status } = invoice;
  const overdue = status === "sent" && invoice.dueDate < todayLocal();

  return (
    <div className="space-y-6">
      <BackButton onClick={onBack}>Invoices</BackButton>

      <div className="flex flex-wrap items-center gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="outline-none font-display text-2xl tabular-nums text-bone">Invoice {invoice.number}</h2>
        <StatusBadge status={overdue ? "overdue" : status} />
      </div>

      <p className="font-body text-sm text-bone-muted">
        {invoice.client.name} · {invoice.client.email}
        {invoice.contractTitle && ` · for “${invoice.contractTitle}”`}
        {invoice.sentAt && ` · sent ${dateTime(invoice.sentAt)}`}
        {invoice.lastReminderAt && ` · reminded ${dateTime(invoice.lastReminderAt)}`}
        {invoice.paidAt && ` · paid ${dateTime(invoice.paidAt)}`}
      </p>

      <ErrorBanner message={error} />
      {notice && <Notice>{notice}</Notice>}
      {invoice.emailError && !error && (
        <ErrorBanner message={`Last email failed: ${emailFailureHint(invoice.emailError)}`} />
      )}

      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <>
            <Button onClick={() => onEdit(invoice)}>Edit</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Email invoice ${invoice.number} to ${invoice.client.email}? It can't be edited after.`)) {
                  void run("send", "Invoice emailed.");
                }
              }}
            >
              Email to client
            </Button>
          </>
        )}
        {status === "sent" && (
          <>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Email ${invoice.client.email} a payment reminder?`)) {
                  void run("remind", "Reminder sent.");
                }
              }}
            >
              Send reminder
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Email invoice ${invoice.number} to ${invoice.client.email} again?`)) {
                  void run("send", "Invoice re-sent.");
                }
              }}
            >
              Resend invoice
            </Button>
          </>
        )}
        {(status === "draft" || status === "sent") && (
          <Button disabled={busy} onClick={() => void run("paid", "Marked as paid.")}>
            Mark paid
          </Button>
        )}
        {status === "paid" && (
          <Button disabled={busy} onClick={() => void run("unpaid", "Marked as unpaid.")}>
            Mark unpaid
          </Button>
        )}
        <Button onClick={() => window.print()}>Print / save PDF</Button>
        {(status === "draft" || status === "sent") && (
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Void invoice ${invoice.number}? It will no longer count as outstanding.`)) {
                void run("void", "Invoice voided.");
              }
            }}
          >
            Void
          </Button>
        )}
        {(status === "draft" || status === "void") && (
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm(`Delete invoice ${invoice.number} permanently?`)) return;
              try {
                await deleteInvoice(invoice.id);
                onBack();
              } catch (err) {
                if (err instanceof UnauthorizedError) return onUnauthorized();
                setError(err instanceof Error ? err.message : "Could not delete.");
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>

      <InvoicePaper invoice={invoice} providerName={site.name} />
    </div>
  );
}
