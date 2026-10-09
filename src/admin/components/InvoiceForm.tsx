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
import {
  BackButton,
  Button,
  ErrorBanner,
  FieldError,
  focusFirst,
  inputClass,
  invalidClass,
  labelClass,
  useFocusOnMount,
} from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  // Keyed by field id suffix: "client-name", "due", "desc-0", "rate-2", …
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const headingRef = useFocusOnMount<HTMLHeadingElement>();

  const parsedItems = items.map(toItem);
  const totals = invoiceTotals(parsedItems, draft.taxRate);

  function updateItem(index: number, patch: Partial<ItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  /** Field order matters: the first key is the field that receives focus. */
  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!draft.client.name.trim()) next["client-name"] = "Enter the client's name.";
    if (!draft.client.email.trim()) next["client-email"] = "Enter the client's email.";
    else if (!EMAIL_RE.test(draft.client.email.trim())) next["client-email"] = "Enter a valid email, like name@example.com.";
    if (draft.dueDate && draft.issueDate && draft.dueDate < draft.issueDate) {
      next.due = "The due date can't be before the issue date.";
    }
    items.forEach((item, i) => {
      const used = item.description.trim() || item.rate.trim();
      if (used && !item.description.trim()) next[`desc-${i}`] = "Describe this line, or remove it.";
      if (used && !(Number(item.quantity) > 0)) next[`qty-${i}`] = "Enter a quantity above 0.";
      if (item.rate.trim() && parseDollars(item.rate) === null) next[`rate-${i}`] = "Enter an amount in dollars, like 250.";
    });
    if (!items.some((item) => item.description.trim())) next["desc-0"] ??= "Add at least one line item.";
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const problems = validate();
    setFieldErrors(problems);
    const order = ["client-name", "client-email", "due", ...items.flatMap((_, i) => [`desc-${i}`, `qty-${i}`, `rate-${i}`])];
    if (Object.keys(problems).length > 0) {
      focusFirst(order.filter((key) => problems[key]).map((key) => `${id}-${key}`));
      return;
    }
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
      <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl text-bone outline-none">
        {invoiceId ? `Edit invoice ${number ?? ""}` : "New invoice"}
      </h2>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-10" noValidate>
        <ClientFields
          idPrefix={`${id}-client`}
          errors={{ name: fieldErrors["client-name"], email: fieldErrors["client-email"] }}
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
                className={`${inputClass} ${fieldErrors.due ? invalidClass : ""}`}
                value={draft.dueDate}
                min={draft.issueDate}
                aria-invalid={fieldErrors.due ? true : undefined}
                aria-describedby={fieldErrors.due ? `${id}-due-error` : undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
              <FieldError id={`${id}-due-error`} message={fieldErrors.due} />
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
                      <span className="sr-only">, line {n}</span>
                    </label>
                    <input
                      id={`${id}-desc-${index}`}
                      className={`${inputClass} ${fieldErrors[`desc-${index}`] ? invalidClass : ""}`}
                      aria-invalid={fieldErrors[`desc-${index}`] ? true : undefined}
                      aria-describedby={fieldErrors[`desc-${index}`] ? `${id}-desc-${index}-error` : undefined}
                      value={item.description}
                      onChange={(e) => updateItem(index, { description: e.target.value })}
                    />
                    <FieldError id={`${id}-desc-${index}-error`} message={fieldErrors[`desc-${index}`]} />
                  </div>
                  <div>
                    <label htmlFor={`${id}-qty-${index}`} className={labelClass}>
                      Qty
                      <span className="sr-only">, line {n}</span>
                    </label>
                    <input
                      id={`${id}-qty-${index}`}
                      inputMode="decimal"
                      className={`${inputClass} ${fieldErrors[`qty-${index}`] ? invalidClass : ""}`}
                      aria-invalid={fieldErrors[`qty-${index}`] ? true : undefined}
                      aria-describedby={fieldErrors[`qty-${index}`] ? `${id}-qty-${index}-error` : undefined}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    />
                    <FieldError id={`${id}-qty-${index}-error`} message={fieldErrors[`qty-${index}`]} />
                  </div>
                  <div>
                    <label htmlFor={`${id}-rate-${index}`} className={labelClass}>
                      Rate (USD)
                      <span className="sr-only">, line {n}</span>
                    </label>
                    <input
                      id={`${id}-rate-${index}`}
                      inputMode="decimal"
                      className={`${inputClass} ${fieldErrors[`rate-${index}`] ? invalidClass : ""}`}
                      aria-invalid={fieldErrors[`rate-${index}`] ? true : undefined}
                      aria-describedby={fieldErrors[`rate-${index}`] ? `${id}-rate-${index}-error` : undefined}
                      value={item.rate}
                      placeholder="0.00"
                      onChange={(e) => updateItem(index, { rate: e.target.value })}
                    />
                    <FieldError id={`${id}-rate-${index}-error`} message={fieldErrors[`rate-${index}`]} />
                  </div>
                  <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end">
                    <span className="font-body text-sm tabular-nums text-bone">
                      {formatCents(lineTotal(parsedItems[index]))}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setItems((prev) => prev.filter((_, i) => i !== index));
                          // The button is about to disappear; keep focus in the list.
                          requestAnimationFrame(() =>
                            document.getElementById(`${id}-desc-${Math.max(0, index - 1)}`)?.focus(),
                          );
                        }}
                        aria-label={`Remove line ${n}`}
                        className="min-h-11 font-body text-xs uppercase tracking-widest text-danger hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
              onClick={() => {
                const next = items.length;
                setItems((prev) => [...prev, { description: "", quantity: "1", rate: "" }]);
                requestAnimationFrame(() => document.getElementById(`${id}-desc-${next}`)?.focus());
              }}
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
