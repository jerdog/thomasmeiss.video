/** Money helpers shared by the Worker and the admin app. Amounts are integer cents. */

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  return USD.format(cents / 100);
}

/** `"1,250.5"` → `125050`. Returns null for anything that is not a non-negative amount. */
export function parseDollars(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** `125050` → `"1250.50"` — for prefilling an amount input. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitCents: number;
}

export interface InvoiceTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export function lineTotal(item: InvoiceItem): number {
  return Math.round(item.quantity * item.unitCents);
}

/** Tax is rounded once on the subtotal, not per line, so totals reconcile. */
export function invoiceTotals(items: InvoiceItem[], taxRate: number): InvoiceTotals {
  const subtotalCents = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const taxCents = Math.round((subtotalCents * taxRate) / 100);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** `2026-10-06` → `October 6, 2026`. Parsed as UTC so the day never shifts. */
export function longDate(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
