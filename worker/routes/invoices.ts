import type { ContractClient } from "../../shared/contract";
import { invoiceTotals, type InvoiceItem } from "../../shared/money";
import {
  INVOICE_PREFIX,
  INVOICE_STATUSES,
  PROVIDER_NAME,
  nowSeconds,
  parseJson,
  readJson,
  sendClientEmail,
  isDraft,
  todayUtc,
  upsertClient,
  type InvoiceStatus,
} from "../lib/billing";
import { invoiceEmail } from "../lib/documents";
import { json } from "../lib/http";

const PAGE_SIZE = 100;
const MAX_ITEMS = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface InvoiceRow {
  id: number;
  number: string;
  client_id: number;
  contract_id: number | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  items: string;
  tax_rate: number;
  total_cents: number;
  notes: string | null;
  payment_instructions: string | null;
  created_at: number;
  updated_at: number;
  sent_at: number | null;
  last_reminder_at: number | null;
  paid_at: number | null;
  email_error: string | null;
  client_name: string;
  client_email: string;
  client_company: string | null;
  client_phone: string | null;
  client_address: string | null;
  contract_title: string | null;
}

interface InvoiceInput {
  client: ContractClient;
  contractId: number | null;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  taxRate: number;
  notes: string;
  paymentInstructions: string;
}

const SELECT_INVOICE = `
  SELECT i.*, cl.name AS client_name, cl.email AS client_email, cl.company AS client_company,
         cl.phone AS client_phone, cl.address AS client_address, c.title AS contract_title
    FROM invoices i
    JOIN clients cl ON cl.id = i.client_id
    LEFT JOIN contracts c ON c.id = i.contract_id`;

/**
 * `/api/admin/invoices*` — already authenticated and origin-checked by
 * `handleAdmin`. `route` is the path after `/api/admin/`.
 */
export async function handleInvoices(
  request: Request,
  env: Env,
  url: URL,
  route: string,
): Promise<Response> {
  if (route === "invoices") {
    if (request.method === "GET") return listInvoices(env, url);
    if (request.method === "POST") return createInvoice(request, env);
    return methodNotAllowed("GET, POST");
  }

  const match = /^invoices\/(\d+)(?:\/(send|remind|paid|unpaid|void))?$/.exec(route);
  if (!match) return json({ ok: false, error: "Not found" }, 404);
  const id = Number(match[1]);
  const action = match[2];

  if (action) {
    if (request.method !== "POST") return methodNotAllowed("POST");
    switch (action) {
      case "send":
        return emailInvoice(env, id, "invoice");
      case "remind":
        return emailInvoice(env, id, "reminder");
      case "paid":
        return transition(env, id, `status = 'paid', paid_at = ?1`, ["draft", "sent"]);
      case "unpaid":
        return transition(
          env,
          id,
          `status = CASE WHEN sent_at IS NULL THEN 'draft' ELSE 'sent' END, paid_at = NULL`,
          ["paid"],
        );
      default:
        return transition(env, id, `status = 'void'`, ["draft", "sent"]);
    }
  }

  if (request.method === "GET") return getInvoice(env, id);
  if (request.method === "PUT") return updateInvoice(request, env, id);
  if (request.method === "DELETE") return deleteInvoice(env, id);
  return methodNotAllowed("GET, PUT, DELETE");
}

async function listInvoices(env: Env, url: URL): Promise<Response> {
  const filter = url.searchParams.get("status");
  const today = todayUtc();
  const yearStart = Math.floor(Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000);

  // "overdue" is a view over `sent`, not a stored status.
  let where = "";
  const binds: (string | number)[] = [];
  if (filter === "overdue") {
    where = "WHERE i.status = 'sent' AND i.due_date < ?";
    binds.push(today);
  } else if (INVOICE_STATUSES.includes(filter as InvoiceStatus)) {
    where = "WHERE i.status = ?";
    binds.push(filter as string);
  }

  const [page, counts, summary, lastInstructions] = await env.DB.batch([
    env.DB.prepare(
      `SELECT i.id, i.number, i.status, i.issue_date, i.due_date, i.total_cents, i.sent_at,
              i.paid_at, i.email_error, cl.name AS client_name, cl.company AS client_company
         FROM invoices i JOIN clients cl ON cl.id = i.client_id
         ${where}
        ORDER BY i.id DESC LIMIT ${PAGE_SIZE}`,
    ).bind(...binds),
    env.DB.prepare(`SELECT status, COUNT(*) AS count FROM invoices GROUP BY status`),
    env.DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'sent' THEN total_cents END), 0) AS outstanding,
         COALESCE(SUM(CASE WHEN status = 'sent' AND due_date < ?1 THEN total_cents END), 0) AS overdue,
         SUM(CASE WHEN status = 'sent' AND due_date < ?1 THEN 1 ELSE 0 END) AS overdue_count,
         COALESCE(SUM(CASE WHEN status = 'paid' AND paid_at >= ?2 THEN total_cents END), 0) AS paid_this_year
       FROM invoices`,
    ).bind(today, yearStart),
    // Payment instructions rarely change, so a new invoice starts from the last one's.
    env.DB.prepare(
      `SELECT payment_instructions FROM invoices
        WHERE payment_instructions IS NOT NULL AND payment_instructions != ''
        ORDER BY id DESC LIMIT 1`,
    ),
  ]);

  const byStatus: Record<string, number> = { draft: 0, sent: 0, paid: 0, void: 0 };
  for (const row of counts.results as { status: string; count: number }[]) {
    byStatus[row.status] = Number(row.count);
  }
  const totals = summary.results[0] as Record<string, number> | undefined;

  return json({
    ok: true,
    items: page.results,
    counts: { ...byStatus, overdue: Number(totals?.overdue_count ?? 0) },
    summary: {
      outstandingCents: Number(totals?.outstanding ?? 0),
      overdueCents: Number(totals?.overdue ?? 0),
      paidThisYearCents: Number(totals?.paid_this_year ?? 0),
    },
    defaults: {
      paymentInstructions:
        (lastInstructions.results[0] as { payment_instructions?: string } | undefined)
          ?.payment_instructions ?? "",
    },
  });
}

async function getInvoice(env: Env, id: number): Promise<Response> {
  const row = await env.DB.prepare(`${SELECT_INVOICE} WHERE i.id = ?`)
    .bind(id)
    .first<InvoiceRow>();
  if (!row) return json({ ok: false, error: "Not found" }, 404);
  return json({ ok: true, invoice: toInvoice(row) });
}

async function createInvoice(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "Invalid JSON" }, 400);
  const { input, error } = normalizeInvoice(body);
  if (error) return json({ ok: false, error }, 400);

  const clientId = await upsertClient(env.DB, input.client);
  const contractId = await existingContract(env, input.contractId);
  const now = nowSeconds();
  const { totalCents } = invoiceTotals(input.items, input.taxRate);

  // Numbers run per year: TMV-2026-0001, TMV-2026-0002, … One admin means a
  // collision is near-impossible, but the UNIQUE index makes one fail loudly
  // instead of duplicating, and a single retry picks the next number.
  for (let attempt = 0; attempt < 2; attempt++) {
    const number = await nextInvoiceNumber(env, input.issueDate);
    try {
      const row = await env.DB.prepare(
        `INSERT INTO invoices
           (number, client_id, contract_id, status, issue_date, due_date, items, tax_rate,
            total_cents, notes, payment_instructions, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
      )
        .bind(
          number,
          clientId,
          contractId,
          input.issueDate,
          input.dueDate,
          JSON.stringify(input.items),
          input.taxRate,
          totalCents,
          input.notes || null,
          input.paymentInstructions || null,
          now,
          now,
        )
        .first<{ id: number }>();
      return json({ ok: true, id: row?.id ?? null, number }, 201);
    } catch (err) {
      if (attempt === 1 || !/UNIQUE/i.test(String(err))) throw err;
    }
  }
  return json({ ok: false, error: "Could not allocate an invoice number" }, 500);
}

async function updateInvoice(request: Request, env: Env, id: number): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "Invalid JSON" }, 400);
  const { input, error } = normalizeInvoice(body);
  if (error) return json({ ok: false, error }, 400);

  // Sent invoices are what the client received; only drafts change. Checked
  // before the client upsert so a rejected edit cannot rewrite client details.
  if (!(await isDraft(env, "invoices", id))) {
    return json({ ok: false, error: "Only draft invoices can be edited" }, 409);
  }

  const clientId = await upsertClient(env.DB, input.client);
  const contractId = await existingContract(env, input.contractId);
  const { totalCents } = invoiceTotals(input.items, input.taxRate);

  const result = await env.DB.prepare(
    `UPDATE invoices
        SET client_id = ?, contract_id = ?, issue_date = ?, due_date = ?, items = ?,
            tax_rate = ?, total_cents = ?, notes = ?, payment_instructions = ?, updated_at = ?
      WHERE id = ? AND status = 'draft'`,
  )
    .bind(
      clientId,
      contractId,
      input.issueDate,
      input.dueDate,
      JSON.stringify(input.items),
      input.taxRate,
      totalCents,
      input.notes || null,
      input.paymentInstructions || null,
      nowSeconds(),
      id,
    )
    .run();

  if (!result.meta.changes) {
    return json({ ok: false, error: "Only draft invoices can be edited" }, 409);
  }
  return json({ ok: true, id });
}

/**
 * Send (draft → sent) or remind (sent stays sent). A failed first send leaves
 * the invoice a draft, so "sent" always means the client was emailed it.
 */
async function emailInvoice(
  env: Env,
  id: number,
  kind: "invoice" | "reminder",
): Promise<Response> {
  const row = await env.DB.prepare(`${SELECT_INVOICE} WHERE i.id = ?`)
    .bind(id)
    .first<InvoiceRow>();
  if (!row) return json({ ok: false, error: "Not found" }, 404);

  const allowed: InvoiceStatus[] = kind === "invoice" ? ["draft", "sent"] : ["sent"];
  if (!allowed.includes(row.status)) {
    return json({ ok: false, error: `A ${row.status} invoice cannot be ${kind === "invoice" ? "sent" : "reminded"}` }, 409);
  }

  const invoice = toInvoice(row);
  const emailError = await sendClientEmail(
    env,
    { email: row.client_email, name: row.client_name },
    invoiceEmail(
      {
        number: invoice.number,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        items: invoice.items,
        taxRate: invoice.taxRate,
        notes: invoice.notes,
        paymentInstructions: invoice.paymentInstructions,
        client: {
          name: row.client_name,
          company: row.client_company,
          address: row.client_address,
        },
        providerName: PROVIDER_NAME,
      },
      kind,
    ),
  );

  const now = nowSeconds();
  if (emailError) {
    await env.DB.prepare(`UPDATE invoices SET email_error = ?, updated_at = ? WHERE id = ?`)
      .bind(emailError, now, id)
      .run();
    return json({ ok: false, error: `Email failed: ${emailError}` }, 502);
  }

  await env.DB.prepare(
    kind === "invoice"
      ? `UPDATE invoices SET status = 'sent', sent_at = ?1, email_error = NULL, updated_at = ?1 WHERE id = ?2`
      : `UPDATE invoices SET last_reminder_at = ?1, email_error = NULL, updated_at = ?1 WHERE id = ?2`,
  )
    .bind(now, id)
    .run();

  return json({ ok: true, id });
}

/** A status change guarded by the statuses it may start from. `?1` binds now. */
async function transition(
  env: Env,
  id: number,
  set: string,
  from: InvoiceStatus[],
): Promise<Response> {
  const result = await env.DB.prepare(
    `UPDATE invoices SET ${set}, updated_at = ?1
      WHERE id = ?2 AND status IN (${from.map((s) => `'${s}'`).join(", ")})`,
  )
    .bind(nowSeconds(), id)
    .run();
  if (!result.meta.changes) {
    return json({ ok: false, error: "Not found, or not allowed from its current status" }, 409);
  }
  return json({ ok: true, id });
}

async function deleteInvoice(env: Env, id: number): Promise<Response> {
  const result = await env.DB.prepare(
    `DELETE FROM invoices WHERE id = ? AND status IN ('draft', 'void')`,
  )
    .bind(id)
    .run();
  if (!result.meta.changes) {
    return json({ ok: false, error: "Only draft or void invoices can be deleted" }, 409);
  }
  return json({ ok: true, id });
}

async function nextInvoiceNumber(env: Env, issueDate: string): Promise<string> {
  const prefix = `${INVOICE_PREFIX}-${issueDate.slice(0, 4)}-`;
  const row = await env.DB.prepare(
    `SELECT MAX(CAST(substr(number, ?1) AS INTEGER)) AS seq FROM invoices WHERE number LIKE ?2`,
  )
    .bind(prefix.length + 1, `${prefix}%`)
    .first<{ seq: number | null }>();
  return `${prefix}${String((row?.seq ?? 0) + 1).padStart(4, "0")}`;
}

async function existingContract(env: Env, id: number | null): Promise<number | null> {
  if (!id) return null;
  const row = await env.DB.prepare(`SELECT id FROM contracts WHERE id = ?`).bind(id).first();
  return row ? id : null;
}

function normalizeInvoice(body: Record<string, unknown>): {
  input: InvoiceInput;
  error: string | null;
} {
  const rawClient = (body.client && typeof body.client === "object" ? body.client : {}) as Record<
    string,
    unknown
  >;
  const client: ContractClient = {
    name: text(rawClient.name, 120),
    email: text(rawClient.email, 254).toLowerCase(),
    company: text(rawClient.company, 160),
    phone: text(rawClient.phone, 40),
    address: text(rawClient.address, 300),
  };

  const items: InvoiceItem[] = (Array.isArray(body.items) ? body.items : [])
    .slice(0, MAX_ITEMS)
    .map((raw) => {
      const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        description: text(item.description, 300),
        quantity: Math.min(10_000, Math.max(0, Number(item.quantity) || 0)),
        unitCents: Math.min(100_000_000, Math.max(0, Math.round(Number(item.unitCents) || 0))),
      };
    })
    .filter((item) => item.description);

  const today = todayUtc();
  const issueDate = DATE_RE.test(String(body.issueDate)) ? String(body.issueDate) : today;
  const dueDate = DATE_RE.test(String(body.dueDate)) ? String(body.dueDate) : issueDate;

  const input: InvoiceInput = {
    client,
    contractId: Number(body.contractId) || null,
    issueDate,
    dueDate,
    items,
    taxRate: Math.min(30, Math.max(0, Number(body.taxRate) || 0)),
    notes: text(body.notes, 2000),
    paymentInstructions: text(body.paymentInstructions, 2000),
  };

  let error: string | null = null;
  if (!client.name) error = "Client name is required.";
  else if (!EMAIL_RE.test(client.email)) error = "A valid client email is required.";
  else if (items.length === 0) error = "Add at least one line item.";
  else if (dueDate < issueDate) error = "The due date cannot be before the issue date.";

  return { input, error };
}

function toInvoice(row: InvoiceRow) {
  const items = parseJson<InvoiceItem[]>(row.items, []);
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    items,
    taxRate: row.tax_rate,
    totals: invoiceTotals(items, row.tax_rate),
    notes: row.notes,
    paymentInstructions: row.payment_instructions,
    client: {
      name: row.client_name,
      email: row.client_email,
      company: row.client_company ?? "",
      phone: row.client_phone ?? "",
      address: row.client_address ?? "",
    },
    contractId: row.contract_id,
    contractTitle: row.contract_title,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    lastReminderAt: row.last_reminder_at,
    paidAt: row.paid_at,
    emailError: row.email_error,
  };
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function methodNotAllowed(allow: string): Response {
  return json({ ok: false, error: "Method not allowed" }, 405, { Allow: allow });
}
