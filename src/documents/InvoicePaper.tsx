import {
  formatCents,
  invoiceTotals,
  lineTotal,
  longDate,
  type InvoiceItem,
} from "../../shared/money";

export interface InvoicePaperData {
  number: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  taxRate: number;
  notes: string | null;
  paymentInstructions: string | null;
  client: { name: string; email: string; company: string; address: string };
  status?: string;
}

/** Printable invoice, laid out like the emailed one. `.print-doc` survives print. */
export function InvoicePaper({
  invoice,
  providerName,
}: {
  invoice: InvoicePaperData;
  providerName: string;
}) {
  const totals = invoiceTotals(invoice.items, invoice.taxRate);
  return (
    <article
      className="print-doc mx-auto max-w-3xl bg-[#fbfaf7] px-6 py-10 font-body text-sm text-neutral-900 shadow-lg sm:px-12"
      aria-label={`Invoice ${invoice.number}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="font-display text-2xl text-neutral-950">{providerName}</p>
        </div>
        <div className="text-right">
          <h2 className="font-display text-3xl text-neutral-950">Invoice</h2>
          <p className="mt-1 tabular-nums">{invoice.number}</p>
          {invoice.status === "paid" && (
            <p className="mt-2 inline-block border-2 border-emerald-700 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-800">
              Paid
            </p>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-600">Bill to</p>
          <p className="mt-1 whitespace-pre-line">
            {[invoice.client.company, invoice.client.name, invoice.client.address, invoice.client.email]
              .filter(Boolean)
              .join("\n")}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
          <dt className="text-neutral-600">Issued</dt>
          <dd>{longDate(invoice.issueDate)}</dd>
          <dt className="text-neutral-600">Due</dt>
          <dd className="font-semibold">{longDate(invoice.dueDate)}</dd>
        </dl>
      </div>

      <table className="mt-8 w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-400 text-left text-xs uppercase tracking-widest text-neutral-600">
            <th scope="col" className="py-2 pr-2 font-normal">Description</th>
            <th scope="col" className="py-2 px-2 text-right font-normal">Qty</th>
            <th scope="col" className="py-2 px-2 text-right font-normal">Rate</th>
            <th scope="col" className="py-2 pl-2 text-right font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={i} className="border-b border-neutral-200">
              <td className="py-2 pr-2">{item.description}</td>
              <td className="py-2 px-2 text-right tabular-nums">{item.quantity}</td>
              <td className="py-2 px-2 text-right tabular-nums">{formatCents(item.unitCents)}</td>
              <td className="py-2 pl-2 text-right tabular-nums">{formatCents(lineTotal(item))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {invoice.taxRate > 0 && (
            <>
              <tr>
                <td colSpan={3} className="pt-3 text-right text-neutral-600">Subtotal</td>
                <td className="pt-3 text-right tabular-nums">{formatCents(totals.subtotalCents)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="text-right text-neutral-600">Tax ({invoice.taxRate}%)</td>
                <td className="text-right tabular-nums">{formatCents(totals.taxCents)}</td>
              </tr>
            </>
          )}
          <tr>
            <td colSpan={3} className="pt-3 text-right font-semibold">Total due</td>
            <td className="pt-3 text-right font-display text-xl tabular-nums">
              {formatCents(totals.totalCents)}
            </td>
          </tr>
        </tfoot>
      </table>

      {invoice.paymentInstructions && (
        <section className="mt-8">
          <h3 className="font-display text-lg text-neutral-950">How to pay</h3>
          <p className="mt-1 whitespace-pre-line">{invoice.paymentInstructions}</p>
        </section>
      )}
      {invoice.notes && (
        <section className="mt-6">
          <h3 className="font-display text-lg text-neutral-950">Notes</h3>
          <p className="mt-1 whitespace-pre-line">{invoice.notes}</p>
        </section>
      )}
      <p className="mt-10 text-neutral-700">Thank you!</p>
    </article>
  );
}
