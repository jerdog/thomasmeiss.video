import type { ContractDocument } from "../../shared/contract";
import {
  nowSeconds,
  parseJson,
  readJson,
  sendClientEmail,
  sendOwnerEmail,
} from "../lib/billing";
import { contractSignedEmail } from "../lib/documents";
import { isSameOrigin, json } from "../lib/http";

const TOKEN_RE = /^[0-9a-f]{64}$/;
const MAX_NAME_CHARS = 120;

interface SignRow {
  id: number;
  title: string;
  status: string;
  rendered: string | null;
  signer_name: string | null;
  signed_at: number | null;
  client_name: string;
  client_email: string;
}

/**
 * Public `GET|POST /api/sign/:token` — the client's side of a contract.
 *
 * Unauthenticated by design: the 256-bit token in the emailed link is the
 * credential, and it only ever exposes the one contract it was minted for.
 * Only the frozen text of a sent contract is served — never a draft, never
 * the questionnaire behind it.
 */
export async function handleSign(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
): Promise<Response> {
  const token = url.pathname.replace(/^\/api\/sign\/?/, "");
  if (!TOKEN_RE.test(token)) return json({ ok: false, error: "Not found" }, 404);

  const row = await env.DB.prepare(
    `SELECT c.id, c.title, c.status, c.rendered, c.signer_name, c.signed_at,
            cl.name AS client_name, cl.email AS client_email
       FROM contracts c JOIN clients cl ON cl.id = c.client_id
      WHERE c.sign_token = ?`,
  )
    .bind(token)
    .first<SignRow>();

  if (!row || !row.rendered || row.status === "draft") {
    return json({ ok: false, error: "Not found" }, 404);
  }
  const doc = parseJson<ContractDocument | null>(row.rendered, null);
  if (!doc) return json({ ok: false, error: "Not found" }, 404);

  if (request.method === "GET") {
    return json({
      ok: true,
      contract: {
        title: row.title,
        status: row.status,
        document: doc,
        signerName: row.signer_name,
        signedAt: row.signed_at,
      },
    });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405, { Allow: "GET, POST" });
  }
  if (!isSameOrigin(request)) {
    return json({ ok: false, error: "Cross-origin request rejected" }, 403);
  }

  const body = await readJson(request);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, MAX_NAME_CHARS) : "";
  if (!name) return json({ ok: false, error: "Type your full name to sign." }, 400);
  if (body?.agree !== true) {
    return json({ ok: false, error: "Please confirm you agree to the terms." }, 400);
  }

  const signedAt = nowSeconds();
  // The status guard makes signing one-shot: a second submit, or a contract
  // voided while the page was open, changes nothing.
  const result = await env.DB.prepare(
    `UPDATE contracts SET status = 'signed', signer_name = ?, signed_at = ?, updated_at = ?
      WHERE id = ? AND status = 'sent'`,
  )
    .bind(name, signedAt, signedAt, row.id)
    .run();

  if (!result.meta.changes) {
    return json(
      {
        ok: false,
        error:
          row.status === "signed"
            ? "This contract has already been signed."
            : "This contract is no longer open for signing.",
      },
      409,
    );
  }

  const signature = { name, signedAt };
  const viewUrl = `${url.origin}/sign/${token}`;
  ctx.waitUntil(
    Promise.all([
      sendOwnerEmail(
        env,
        contractSignedEmail({ doc, title: row.title, signature, forClient: false, viewUrl }),
      ),
      sendClientEmail(
        env,
        { email: row.client_email, name: row.client_name },
        contractSignedEmail({ doc, title: row.title, signature, forClient: true, viewUrl }),
        // The owner already gets its own "signed" notification above.
        { copyOwner: false },
      ),
    ]),
  );

  return json({ ok: true, signerName: name, signedAt });
}
