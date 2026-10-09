import { useCallback, useEffect, useState } from "react";
import { depositCents, renderContract, type ContractAnswers } from "../../../shared/contract";
import { addDays, formatCents } from "../../../shared/money";
import { site } from "../../data/content";
import { ContractPaper } from "../../documents/ContractPaper";
import {
  contractAction,
  deleteContract,
  getContract,
  UnauthorizedError,
  type Contract,
  type InvoiceDraft,
  type LinkedInvoice,
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

export function ContractDetail({
  id,
  onBack,
  onEdit,
  onCreateInvoice,
  onOpenInvoice,
  onUnauthorized,
}: {
  id: number;
  onBack: () => void;
  onEdit: (contract: Contract) => void;
  onCreateInvoice: (draft: Partial<InvoiceDraft>) => void;
  onOpenInvoice: (id: number) => void;
  onUnauthorized: () => void;
}) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [invoices, setInvoices] = useState<LinkedInvoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const headingRef = useFocusOnMount<HTMLHeadingElement>(contract !== null);

  const load = useCallback(async () => {
    try {
      const result = await getContract(id);
      setContract(result.contract);
      setInvoices(result.invoices);
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized();
      setError(err instanceof Error ? err.message : "Could not load the contract.");
    }
  }, [id, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      await load();
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized();
      setError(emailFailureHint(err instanceof Error ? err.message : "Something went wrong."));
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!contract) {
    return (
      <div className="space-y-4">
        <BackButton onClick={onBack}>Contracts</BackButton>
        <ErrorBanner message={error} />
        {!error && (
          <p className="font-body text-sm text-bone-muted" role="status">
            Loading contract…
          </p>
        )}
      </div>
    );
  }

  const { answers, status } = contract;
  const doc =
    contract.document ?? renderContract(answers, { providerName: site.name, date: todayLocal() });
  const signature =
    contract.signerName && contract.signedAt
      ? { name: contract.signerName, signedAt: contract.signedAt }
      : null;

  return (
    <div className="space-y-6">
      <BackButton onClick={onBack}>Contracts</BackButton>

      <div className="flex flex-wrap items-center gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="outline-none font-display text-2xl text-bone">{contract.title}</h2>
        <StatusBadge status={status} />
      </div>

      <p className="font-body text-sm text-bone-muted">
        {answers.client.name} · {answers.client.email} · created {dateTime(contract.createdAt)}
        {contract.sentAt && ` · sent ${dateTime(contract.sentAt)}`}
        {contract.signedAt && ` · signed ${dateTime(contract.signedAt)}`}
      </p>

      <ErrorBanner message={error} />
      {notice && <Notice>{notice}</Notice>}
      {contract.emailError && !error && status === "draft" && (
        <ErrorBanner message={`Last send failed: ${emailFailureHint(contract.emailError)}`} />
      )}

      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <>
            <Button onClick={() => onEdit(contract)}>Edit</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Email ${answers.client.email} a link to review and sign? The contract text is locked once sent.`,
                  )
                ) {
                  void run(() => contractAction(contract.id, "send"), "Sent — the client has a signing link.");
                }
              }}
            >
              Send for signature
            </Button>
          </>
        )}
        {status === "sent" && (
          <Button
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Email ${answers.client.email} the signing link again?`)) {
                void run(() => contractAction(contract.id, "send"), "Signing link re-sent.");
              }
            }}
          >
            Resend link
          </Button>
        )}
        {contract.signUrl && status !== "void" && (
          <Button
            onClick={() => {
              void navigator.clipboard
                .writeText(contract.signUrl!)
                .then(() => setNotice("Signing link copied."))
                .catch(() => setError("Could not copy — the link is " + contract.signUrl));
            }}
          >
            Copy signing link
          </Button>
        )}
        <Button onClick={() => window.print()}>Print / save PDF</Button>
        {status !== "void" && status !== "draft" && (
          <InvoiceButtons answers={answers} contract={contract} onCreateInvoice={onCreateInvoice} />
        )}
        {status !== "void" && (
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              const warning =
                status === "signed"
                  ? "This contract is signed. Void it anyway? The client's link will show it as withdrawn."
                  : "Void this contract? Its signing link will stop working.";
              if (window.confirm(warning)) {
                void run(() => contractAction(contract.id, "void"), "Contract voided.");
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
              if (!window.confirm("Delete this contract permanently?")) return;
              try {
                await deleteContract(contract.id);
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

      {invoices.length > 0 && (
        <section className="rounded border border-border bg-surface p-4">
          <h3 className="font-body text-xs uppercase tracking-widest text-bone-muted">Invoices</h3>
          <ul className="mt-2 space-y-1">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <button
                  type="button"
                  onClick={() => onOpenInvoice(invoice.id)}
                  className="flex min-h-11 w-full flex-wrap items-center gap-3 text-left font-body text-sm text-bone hover:text-accent-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="tabular-nums">{invoice.number}</span>
                  <StatusBadge status={invoice.status} />
                  <span className="ml-auto tabular-nums">{formatCents(invoice.total_cents)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ContractPaper
        doc={doc}
        signature={signature}
        preview={!contract.document}
        layout="page"
        layoutToggle
      />
    </div>
  );
}

/** Prefill invoices from the contract's payment terms. */
function InvoiceButtons({
  answers,
  contract,
  onCreateInvoice,
}: {
  answers: ContractAnswers;
  contract: Contract;
  onCreateInvoice: (draft: Partial<InvoiceDraft>) => void;
}) {
  const today = todayLocal();
  const deposit = depositCents(answers);
  const base = { client: answers.client, contractId: contract.id, issueDate: today };
  const travelLine = answers.travelFeeCents
    ? [{ description: "Travel", quantity: 1, unitCents: answers.travelFeeCents }]
    : [];
  const balanceDueDays =
    answers.balanceTerms === "net-30" ? 30 : answers.balanceTerms === "net-15" ? 15 : 7;

  if (answers.depositPercent > 0 && answers.depositPercent < 100) {
    return (
      <>
        <Button
          onClick={() =>
            onCreateInvoice({
              ...base,
              dueDate: addDays(today, 7),
              items: [
                {
                  description: `Deposit (${answers.depositPercent}%) — ${contract.title}`,
                  quantity: 1,
                  unitCents: deposit,
                },
              ],
            })
          }
        >
          Invoice deposit
        </Button>
        <Button
          onClick={() =>
            onCreateInvoice({
              ...base,
              dueDate: addDays(today, balanceDueDays),
              items: [
                {
                  description: `Balance — ${contract.title}`,
                  quantity: 1,
                  unitCents: answers.feeCents - deposit,
                },
                ...travelLine,
              ],
            })
          }
        >
          Invoice balance
        </Button>
      </>
    );
  }

  return (
    <Button
      onClick={() =>
        onCreateInvoice({
          ...base,
          dueDate: addDays(today, answers.depositPercent >= 100 ? 7 : balanceDueDays),
          items: [
            { description: contract.title, quantity: 1, unitCents: answers.feeCents },
            ...travelLine,
          ],
        })
      }
    >
      Create invoice
    </Button>
  );
}
