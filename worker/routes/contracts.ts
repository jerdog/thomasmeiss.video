import {
  contractTitle,
  normalizeAnswers,
  renderContract,
  totalCents,
  type ContractAnswers,
  type ContractDocument,
} from "../../shared/contract";
import {
  CONTRACT_STATUSES,
  PROVIDER_NAME,
  isDraft,
  nowSeconds,
  parseJson,
  randomToken,
  readJson,
  sendClientEmail,
  todayUtc,
  upsertClient,
  type ContractStatus,
} from "../lib/billing";
import { contractInviteEmail } from "../lib/documents";
import { json } from "../lib/http";

const PAGE_SIZE = 100;

interface ContractRow {
  id: number;
  client_id: number;
  submission_id: number | null;
  title: string;
  status: ContractStatus;
  answers: string;
  rendered: string | null;
  fee_cents: number;
  sign_token: string | null;
  signer_name: string | null;
  created_at: number;
  updated_at: number;
  sent_at: number | null;
  signed_at: number | null;
  email_error: string | null;
}

/**
 * `/api/admin/contracts*` — already authenticated and origin-checked by
 * `handleAdmin`. `route` is the path after `/api/admin/`.
 */
export async function handleContracts(
  request: Request,
  env: Env,
  url: URL,
  route: string,
): Promise<Response> {
  if (route === "contracts") {
    if (request.method === "GET") return listContracts(env, url);
    if (request.method === "POST") return createContract(request, env);
    return methodNotAllowed("GET, POST");
  }

  const match = /^contracts\/(\d+)(?:\/(send|void))?$/.exec(route);
  if (!match) return json({ ok: false, error: "Not found" }, 404);
  const id = Number(match[1]);
  const action = match[2];

  if (action) {
    if (request.method !== "POST") return methodNotAllowed("POST");
    return action === "send" ? sendContract(env, url, id) : voidContract(env, id);
  }

  if (request.method === "GET") return getContract(env, url, id);
  if (request.method === "PUT") return updateContract(request, env, id);
  if (request.method === "DELETE") return deleteContract(env, id);
  return methodNotAllowed("GET, PUT, DELETE");
}

async function listContracts(env: Env, url: URL): Promise<Response> {
  const statusParam = url.searchParams.get("status");
  const status = CONTRACT_STATUSES.includes(statusParam as ContractStatus) ? statusParam : null;

  const [page, counts] = await env.DB.batch([
    env.DB.prepare(
      `SELECT c.id, c.title, c.status, c.fee_cents, c.created_at, c.updated_at, c.sent_at,
              c.signed_at, c.signer_name, c.email_error,
              cl.name AS client_name, cl.email AS client_email
         FROM contracts c JOIN clients cl ON cl.id = c.client_id
        ${status ? "WHERE c.status = ?" : ""}
        ORDER BY c.id DESC LIMIT ${PAGE_SIZE}`,
    ).bind(...(status ? [status] : [])),
    env.DB.prepare(`SELECT status, COUNT(*) AS count FROM contracts GROUP BY status`),
  ]);

  const byStatus: Record<string, number> = { draft: 0, sent: 0, signed: 0, void: 0 };
  for (const row of counts.results as { status: string; count: number }[]) {
    byStatus[row.status] = Number(row.count);
  }

  return json({ ok: true, items: page.results, counts: byStatus });
}

async function getContract(env: Env, url: URL, id: number): Promise<Response> {
  const row = await env.DB.prepare(`SELECT * FROM contracts WHERE id = ?`)
    .bind(id)
    .first<ContractRow>();
  if (!row) return json({ ok: false, error: "Not found" }, 404);

  const { results: invoices } = await env.DB.prepare(
    `SELECT id, number, status, total_cents, due_date FROM invoices
      WHERE contract_id = ? ORDER BY id`,
  )
    .bind(id)
    .all();

  return json({
    ok: true,
    contract: toContract(row, url),
    invoices,
  });
}

async function createContract(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "Invalid JSON" }, 400);

  const { answers, errors } = normalizeAnswers(body.answers);
  const clientError = clientProblem(errors);
  if (clientError) return json({ ok: false, error: clientError }, 400);

  const clientId = await upsertClient(env.DB, answers.client);
  const now = nowSeconds();
  const submissionId = Number(body.submissionId) || null;

  const row = await env.DB.prepare(
    `INSERT INTO contracts
       (client_id, submission_id, title, status, answers, fee_cents, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)
     RETURNING id`,
  )
    .bind(
      clientId,
      submissionId,
      contractTitle(answers),
      JSON.stringify(answers),
      totalCents(answers),
      now,
      now,
    )
    .first<{ id: number }>();

  return json({ ok: true, id: row?.id ?? null, problems: errors }, 201);
}

async function updateContract(request: Request, env: Env, id: number): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "Invalid JSON" }, 400);

  const { answers, errors } = normalizeAnswers(body.answers);
  const clientError = clientProblem(errors);
  if (clientError) return json({ ok: false, error: clientError }, 400);

  // Only drafts are editable: a sent contract's text is what the client is
  // reading (or has signed), so it must never change underneath them. Checked
  // before the client upsert so a rejected edit cannot rewrite client details.
  if (!(await isDraft(env, "contracts", id))) {
    return json({ ok: false, error: "Only draft contracts can be edited" }, 409);
  }

  const clientId = await upsertClient(env.DB, answers.client);
  // The status guard stays as a backstop against a send landing in between.
  const result = await env.DB.prepare(
    `UPDATE contracts
        SET client_id = ?, title = ?, answers = ?, fee_cents = ?, updated_at = ?
      WHERE id = ? AND status = 'draft'`,
  )
    .bind(clientId, contractTitle(answers), JSON.stringify(answers), totalCents(answers), nowSeconds(), id)
    .run();

  if (!result.meta.changes) {
    return json({ ok: false, error: "Only draft contracts can be edited" }, 409);
  }
  return json({ ok: true, id, problems: errors });
}

/**
 * Email the client a signing link. The first send freezes the generated text
 * (dated today) and mints the token; a resend reuses both. If delivery fails a
 * draft stays a draft, so nothing is marked sent that the client never got.
 */
async function sendContract(env: Env, url: URL, id: number): Promise<Response> {
  const row = await env.DB.prepare(`SELECT * FROM contracts WHERE id = ?`)
    .bind(id)
    .first<ContractRow>();
  if (!row) return json({ ok: false, error: "Not found" }, 404);
  if (row.status !== "draft" && row.status !== "sent") {
    return json({ ok: false, error: `A ${row.status} contract cannot be sent` }, 409);
  }

  const { answers, errors } = normalizeAnswers(parseJson(row.answers, {}));
  if (errors.length) return json({ ok: false, error: errors.join(" ") }, 400);

  const doc =
    row.rendered && row.status === "sent"
      ? parseJson<ContractDocument>(row.rendered, render(answers))
      : render(answers);
  const token = row.sign_token ?? randomToken();
  const signUrl = `${url.origin}/sign/${token}`;

  const emailError = await sendClientEmail(
    env,
    { email: answers.client.email, name: answers.client.name },
    contractInviteEmail({
      doc,
      title: row.title,
      clientName: answers.client.name,
      signUrl,
      totalCents: totalCents(answers),
    }),
  );

  if (emailError) {
    await env.DB.prepare(`UPDATE contracts SET email_error = ?, updated_at = ? WHERE id = ?`)
      .bind(emailError, nowSeconds(), id)
      .run();
    return json({ ok: false, error: `Email failed: ${emailError}` }, 502);
  }

  const now = nowSeconds();
  await env.DB.prepare(
    `UPDATE contracts
        SET status = 'sent', rendered = ?, sign_token = ?, email_error = NULL,
            sent_at = ?, updated_at = ?
      WHERE id = ? AND status IN ('draft', 'sent')`,
  )
    .bind(JSON.stringify(doc), token, now, now, id)
    .run();

  return json({ ok: true, id, signUrl });
}

async function voidContract(env: Env, id: number): Promise<Response> {
  const result = await env.DB.prepare(
    `UPDATE contracts SET status = 'void', updated_at = ? WHERE id = ? AND status != 'void'`,
  )
    .bind(nowSeconds(), id)
    .run();
  if (!result.meta.changes) return json({ ok: false, error: "Not found or already void" }, 404);
  return json({ ok: true, id });
}

async function deleteContract(env: Env, id: number): Promise<Response> {
  const row = await env.DB.prepare(`SELECT status FROM contracts WHERE id = ?`)
    .bind(id)
    .first<{ status: ContractStatus }>();
  if (!row) return json({ ok: false, error: "Not found" }, 404);
  // Sent and signed contracts are records of what the client saw — void them instead.
  if (row.status !== "draft" && row.status !== "void") {
    return json({ ok: false, error: "Void the contract before deleting it" }, 409);
  }

  await env.DB.batch([
    env.DB.prepare(`UPDATE invoices SET contract_id = NULL WHERE contract_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM contracts WHERE id = ?`).bind(id),
  ]);
  return json({ ok: true, id });
}

function render(answers: ContractAnswers): ContractDocument {
  return renderContract(answers, { providerName: PROVIDER_NAME, date: todayUtc() });
}

function toContract(row: ContractRow, url: URL) {
  const { answers } = normalizeAnswers(parseJson(row.answers, {}));
  return {
    id: row.id,
    clientId: row.client_id,
    submissionId: row.submission_id,
    title: row.title,
    status: row.status,
    answers,
    // The frozen text once sent; until then, null — the dashboard previews
    // drafts live from `answers` with the same generator.
    document: row.rendered ? parseJson<ContractDocument | null>(row.rendered, null) : null,
    feeCents: row.fee_cents,
    signUrl: row.sign_token ? `${url.origin}/sign/${row.sign_token}` : null,
    signerName: row.signer_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
    signedAt: row.signed_at,
    emailError: row.email_error,
  };
}

/** Drafts may be incomplete, but must name a reachable client. */
function clientProblem(errors: string[]): string | null {
  return errors.find((error) => error.startsWith("Client name") || error.includes("client email")) ?? null;
}

function methodNotAllowed(allow: string): Response {
  return json({ ok: false, error: "Method not allowed" }, 405, { Allow: allow });
}
