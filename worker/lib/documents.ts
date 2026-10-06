/**
 * Client-facing email bodies for contracts and invoices.
 *
 * Email clients ignore stylesheets and dark-mode tokens, so these are plain
 * light-on-white HTML with inline styles — the one place in the project that
 * does not use the Noir palette. Every interpolated value is escaped.
 */

import { contractToText, type ContractDocument } from "../../shared/contract";
import {
  formatCents,
  invoiceTotals,
  lineTotal,
  longDate,
  type InvoiceItem,
} from "../../shared/money";
import { escapeHtml } from "./http";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface Signature {
  name: string;
  /** unix seconds */
  signedAt: number;
}

const FONT = "font-family:Georgia,'Times New Roman',serif;";
const SANS = "font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;";

function layout(body: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f1ea;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;padding:32px;color:#1d1d1f;${SANS}font-size:15px;line-height:1.6;">
${body}
</div></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:28px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#23282e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;${SANS}font-size:14px;">${escapeHtml(label)}</a></p>`;
}

function paragraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function contractHtml(doc: ContractDocument, signature: Signature | null): string {
  const sections = doc.sections
    .map((section) => {
      const blocks = section.blocks
        .map((block) =>
          block.kind === "p"
            ? `<p>${escapeHtml(block.text)}</p>`
            : `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`,
        )
        .join("");
      return `<h3 style="${FONT}font-size:17px;margin:24px 0 8px;">${escapeHtml(section.heading)}</h3>${blocks}`;
    })
    .join("");

  const signed = signature
    ? `<hr style="border:none;border-top:1px solid #ddd;margin:28px 0;" />
<p><strong>Signed electronically by ${escapeHtml(signature.name)}</strong> for ${escapeHtml(doc.clientName)}<br />
${escapeHtml(new Date(signature.signedAt * 1000).toUTCString())}</p>`
    : "";

  return `<h2 style="${FONT}font-size:24px;margin:0 0 16px;">${escapeHtml(doc.title)}</h2>
<p>${escapeHtml(doc.intro)}</p>${sections}${signed}`;
}

export function contractInviteEmail(options: {
  doc: ContractDocument;
  title: string;
  clientName: string;
  signUrl: string;
  totalCents: number;
}): EmailContent {
  const { doc, title, clientName, signUrl, totalCents } = options;
  const subject = `Contract to review and sign: ${title}`;
  const html = layout(`<p>Hi ${escapeHtml(firstName(clientName))},</p>
<p>Here is the agreement for <strong>${escapeHtml(title)}</strong> (total ${escapeHtml(formatCents(totalCents))}). Please read it through and sign online — it takes about a minute.</p>
${button(signUrl, "Review and sign")}
<p style="font-size:13px;color:#555;">Questions or changes? Just reply to this email before signing.</p>
<p>— ${escapeHtml(doc.providerName)}</p>`);
  const text = [
    `Hi ${firstName(clientName)},`,
    "",
    `Here is the agreement for ${title} (total ${formatCents(totalCents)}). Please read it through and sign online:`,
    "",
    signUrl,
    "",
    "Questions or changes? Just reply to this email before signing.",
    "",
    `— ${doc.providerName}`,
  ].join("\n");
  return { subject, html, text };
}

export function contractSignedEmail(options: {
  doc: ContractDocument;
  title: string;
  signature: Signature;
  forClient: boolean;
  viewUrl: string;
}): EmailContent {
  const { doc, title, signature, forClient, viewUrl } = options;
  const subject = forClient ? `Signed: ${title}` : `Contract signed: ${title} — ${signature.name}`;
  const lead = forClient
    ? `<p>Thanks, ${escapeHtml(firstName(signature.name))} — the agreement is signed. A copy is below for your records, and stays available at the link.</p>`
    : `<p><strong>${escapeHtml(signature.name)}</strong> signed <strong>${escapeHtml(title)}</strong>.</p>`;
  const html = layout(`${lead}${button(viewUrl, "View signed contract")}
<hr style="border:none;border-top:1px solid #ddd;margin:28px 0;" />
${contractHtml(doc, signature)}`);
  const text = [
    forClient
      ? `Thanks — the agreement "${title}" is signed. A copy is below and at ${viewUrl}`
      : `${signature.name} signed "${title}". ${viewUrl}`,
    "",
    contractToText(doc),
    `Signed electronically by ${signature.name} — ${new Date(signature.signedAt * 1000).toUTCString()}`,
  ].join("\n");
  return { subject, html, text };
}

export interface InvoiceForEmail {
  number: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  taxRate: number;
  notes: string | null;
  paymentInstructions: string | null;
  client: { name: string; company: string | null; address: string | null };
  providerName: string;
}

export function invoiceEmail(invoice: InvoiceForEmail, kind: "invoice" | "reminder"): EmailContent {
  const totals = invoiceTotals(invoice.items, invoice.taxRate);
  const total = formatCents(totals.totalCents);
  const due = longDate(invoice.dueDate);
  const overdue = invoice.dueDate < new Date().toISOString().slice(0, 10);

  const subject =
    kind === "reminder"
      ? `Reminder: invoice ${invoice.number} (${total}) ${overdue ? "was due" : "is due"} ${due}`
      : `Invoice ${invoice.number} from ${invoice.providerName} — ${total}`;

  const lead =
    kind === "reminder"
      ? `<p>Hi ${escapeHtml(firstName(invoice.client.name))},</p><p>A friendly reminder that invoice <strong>${escapeHtml(invoice.number)}</strong> for <strong>${escapeHtml(total)}</strong> ${overdue ? "was" : "is"} due on <strong>${escapeHtml(due)}</strong>. If you've already paid, thank you — please ignore this.</p>`
      : `<p>Hi ${escapeHtml(firstName(invoice.client.name))},</p><p>Please find invoice <strong>${escapeHtml(invoice.number)}</strong> below. The total of <strong>${escapeHtml(total)}</strong> is due by <strong>${escapeHtml(due)}</strong>.</p>`;

  const cell = "padding:8px 6px;border-bottom:1px solid #eee;";
  const rows = invoice.items
    .map(
      (item) => `<tr>
<td style="${cell}">${escapeHtml(item.description)}</td>
<td style="${cell}text-align:right;">${item.quantity}</td>
<td style="${cell}text-align:right;">${escapeHtml(formatCents(item.unitCents))}</td>
<td style="${cell}text-align:right;">${escapeHtml(formatCents(lineTotal(item)))}</td>
</tr>`,
    )
    .join("");

  const summaryRow = (label: string, value: string, strong = false) =>
    `<tr><td colspan="3" style="padding:6px;text-align:right;${strong ? "font-weight:bold;" : ""}">${label}</td><td style="padding:6px;text-align:right;${strong ? "font-weight:bold;" : ""}">${escapeHtml(value)}</td></tr>`;

  const billTo = [invoice.client.company, invoice.client.name, invoice.client.address]
    .filter(Boolean)
    .map((line) => escapeHtml(String(line)).replace(/\n/g, "<br />"))
    .join("<br />");

  const html = layout(`${lead}
<h2 style="${FONT}font-size:22px;margin:28px 0 4px;">Invoice ${escapeHtml(invoice.number)}</h2>
<p style="margin:0;color:#555;font-size:13px;">Issued ${escapeHtml(longDate(invoice.issueDate))} · Due ${escapeHtml(due)}</p>
<p style="margin:16px 0;"><span style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#777;">Bill to</span><br />${billTo}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;">
<thead><tr style="text-align:left;color:#777;font-size:12px;text-transform:uppercase;">
<th style="padding:6px;">Description</th><th style="padding:6px;text-align:right;">Qty</th><th style="padding:6px;text-align:right;">Rate</th><th style="padding:6px;text-align:right;">Amount</th>
</tr></thead>
<tbody>${rows}</tbody>
<tfoot>
${invoice.taxRate > 0 ? summaryRow("Subtotal", formatCents(totals.subtotalCents)) + summaryRow(`Tax (${invoice.taxRate}%)`, formatCents(totals.taxCents)) : ""}
${summaryRow("Total due", total, true)}
</tfoot>
</table>
${invoice.paymentInstructions ? `<h3 style="${FONT}font-size:16px;margin:28px 0 4px;">How to pay</h3>${paragraphs(invoice.paymentInstructions)}` : ""}
${invoice.notes ? `<h3 style="${FONT}font-size:16px;margin:28px 0 4px;">Notes</h3>${paragraphs(invoice.notes)}` : ""}
<p style="margin-top:28px;">Thank you!<br />— ${escapeHtml(invoice.providerName)}</p>
<p style="font-size:13px;color:#555;">Questions about this invoice? Just reply to this email.</p>`);

  const text = [
    kind === "reminder"
      ? `Reminder: invoice ${invoice.number} for ${total} ${overdue ? "was" : "is"} due on ${due}. If you've already paid, thank you — please ignore this.`
      : `Invoice ${invoice.number} — ${total} due by ${due}.`,
    "",
    `Issued: ${longDate(invoice.issueDate)}`,
    `Bill to: ${[invoice.client.company, invoice.client.name].filter(Boolean).join(", ")}`,
    "",
    ...invoice.items.map(
      (item) =>
        `${item.description} — ${item.quantity} × ${formatCents(item.unitCents)} = ${formatCents(lineTotal(item))}`,
    ),
    "",
    ...(invoice.taxRate > 0
      ? [
          `Subtotal: ${formatCents(totals.subtotalCents)}`,
          `Tax (${invoice.taxRate}%): ${formatCents(totals.taxCents)}`,
        ]
      : []),
    `Total due: ${total}`,
    ...(invoice.paymentInstructions ? ["", "How to pay:", invoice.paymentInstructions] : []),
    ...(invoice.notes ? ["", "Notes:", invoice.notes] : []),
    "",
    `Thank you! — ${invoice.providerName}`,
  ].join("\n");

  return { subject, html, text };
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}
