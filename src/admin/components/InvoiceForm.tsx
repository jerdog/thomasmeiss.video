import { useId, useState, type FormEvent } from "react";
import {
  centsToInput,
  formatCents,
  invoiceTotals,
  lineTotal,
  parseDollars,
  type InvoiceItem,
} from "../../../shared/money";
import { saveInvoice, UnauthorizedError, type InvoiceDraft } from "../api";
import { ClientFields } from "./ClientFields";
import { BackButton, Button, ErrorBanner, inputClass, labelClass } from "./ui";

/** Line items are edited as strings so a half-typed "12." is not reformatted away. */
interface ItemInput {
  description: string;
  quantity: string;
  rate: string;
}

function toInput(item: InvoiceItem): ItemInput {
  return {
    description: item.description,
    quantity: String(item.quantity),
    rate: item.unitCents ? centsToInput(item.unitCents) : "",
  };
}

function toItem(input: ItemInput): InvoiceItem {
  return {
    description: input.description.trim(),
    quantity: Math.max(0, Number(input.quantity) || 0),
    unitCents: parseDollars(input.rate) ?? 0,
  };
}

export function InvoiceForm({
  invoiceId,
  number,
  initial,
  onSaved,
  onCancel,
  onUnauthorized,
}: {
  invoiceId: number | null;
  number: string | null;
  initial: InvoiceDraft;
  onSaved: (id: number) => void;
  onCancel: () => void;
  onUnauthorized: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<InvoiceDraft>(initial);
  const [items, setItems] = useState<ItemInput[]>(
    initial.items.length ? initial.items.map(toInput) : [{ description: "", quantity: "1", rate: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const parsedItems = items.map(toItem);
  const totals = invoiceTotals(parsedItems, draft.taxRate);

  function updateItem(index: number, patch: Partial<ItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await saveInvoice(invoiceId, {
        ...draft,
        items: parsedItems.filter((item) => item.description),
      });
      onSaved(result.id);
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized();
      setError(err instanceof Error ? err.message : "Could not save the invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <BackButton onClick={onCancel}>Invoices</BackButton>
      <h2 className="font-display text-2xl text-bone">
        {invoiceId ? `Edit invoice ${number ?? ""}` : "New invoice"}
      </h2>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-10" noValidate>
        <ClientFields
          value={draft.client}
          onChange={(client) => setDraft((prev) => ({ ...prev, client }))}
          onUnauthorized={onUnauthorized}
        />

        <fieldset className="space-y-4">
          <legend className="mb-4 font-display text-xl text-bone">Dates</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-issue`} className={labelClass}>
                Issue date
              </label>
              <input
                id={`${id}-issue`}
                type="date"
                className={inputClass}
                value={draft.issueDate}
                onChange={(e) => setDraft((prev) => ({ ...prev, issueDate: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor={`${id}-due`} className={labelClass}>
                Due date
              </label>
              <input
                id={`${id}-due`}
                type="date"
                className={inputClass}
                value={draft.dueDate}
                min={draft.issueDate}
                onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-4 font-display text-xl text-bone">Line items</legend>
          <ol className="space-y-4">
            {items.map((item, index) => {
              const n = index + 1;
              return (
                <li
                  key={index}
                  className="grid gap-3 border-b border-border pb-4 sm:grid-cols-[1fr_5rem_8rem_auto]"
                >
                  <div>
                    <label htmlFor={`${id}-desc-${index}`} className={labelClass}>
                      Description
                    </label>
                    <input
                      id={`${id}-desc-${index}`}
                      className={inputClass}
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${id}-qty-${index}`} className={labelClass}>
                      Qty
                    </label>
                    <input
                      id={`${id}-qty-${index}`}
                      inputMode="decimal"
                      className={inputClass}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${id}-rate-${index}`} className={labelClass}>
                      Rate (USD)
                    </label>
                    <input
                      id={`${id}-rate-${index}`}
                      inputMode="decimal"
                      className={inputClass}
                      value={item.rate}
                      placeholder="0.00"
                      aria-invalid={item.rate !== "" && parseDollars(item.rate) === null ? true : undefined}
                      onChange={(e) => updateItem(index, { rate: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end">
                    <span className="font-body text-sm tabular-nums text-bone">
                      {formatCents(lineTotal(parsedItems[index]))}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                        aria-label={`Remove line ${n}`}
                        className="min-h-11 font-body text-xs uppercase tracking-widest text-red-300 hover:text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-4">
            <Button
              onClick={() => setItems((prev) => [...prev, { description: "", quantity: "1", rate: "" }])}
            >
              Add line
            </Button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-tax`} className={labelClass}>
                Sales tax % <span className="normal-case tracking-normal">(0 for none)</span>
              </label>
              <input
                id={`${id}-tax`}
                type="number"
                min={0}
                max={30}
                step={0.01}
                className={inputClass}
                value={draft.taxRate}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, taxRate: Math.max(0, Number(e.target.value) || 0) }))
                }
              />
            </div>
            <dl className="grid grid-cols-[1fr_auto] content-end gap-x-6 gap-y-1 font-body text-sm">
              {draft.taxRate > 0 && (
                <>
                  <dt className="text-bone-muted">Subtotal</dt>
                  <dd className="text-right tabular-nums text-bone">{formatCents(totals.subtotalCents)}</dd>
                  <dt className="text-bone-muted">Tax</dt>
                  <dd className="text-right tabular-nums text-bone">{formatCents(totals.taxCents)}</dd>
                </>
              )}
              <dt className="text-bone">Total</dt>
              <dd className="text-right font-display text-xl tabular-nums text-bone">
                {formatCents(totals.totalCents)}
              </dd>
            </dl>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-4 font-display text-xl text-bone">Payment</legend>
          <div>
            <label htmlFor={`${id}-pay`} className={labelClass}>
              How to pay
            </label>
            <textarea
              id={`${id}-pay`}
              rows={3}
              className={inputClass}
              value={draft.paymentInstructions}
              onChange={(e) => setDraft((prev) => ({ ...prev, paymentInstructions: e.target.value }))}
              placeholder="e.g. Venmo @thomas-meiss, Zelle to …, or check payable to …"
            />
            <p className="mt-1 font-body text-xs text-bone-muted">
              New invoices start with whatever you used last.
            </p>
          </div>
          <div>
            <label htmlFor={`${id}-notes`} className={labelClass}>
              Notes <span className="normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id={`${id}-notes`}
              rows={3}
              className={inputClass}
              value={draft.notes}
              onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </fieldset>

        <ErrorBanner message={error} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
