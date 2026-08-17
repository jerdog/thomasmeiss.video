import { insertSubmission } from "../lib/db";
import { escapeHtml, json } from "../lib/http";

interface ContactPayload {
  name?: string;
  email?: string;
  projectType?: string;
  message?: string;
  "bot-field"?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_CHARS = 5000;

export async function handleContact(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405, corsHeaders(request));
  }

  let body: ContactPayload;
  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400, corsHeaders(request));
  }

  if (body["bot-field"]) {
    return json({ ok: true }, 200, corsHeaders(request));
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const projectType = body.projectType?.trim();
  const message = body.message?.trim().slice(0, MAX_MESSAGE_CHARS);

  if (!name || !email || !projectType || !message) {
    return json(
      { ok: false, error: "All fields are required" },
      400,
      corsHeaders(request),
    );
  }

  if (!EMAIL_RE.test(email)) {
    return json(
      { ok: false, error: "Invalid email address" },
      400,
      corsHeaders(request),
    );
  }

  const subject = `New inquiry: ${projectType} — ${name}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Project type: ${projectType}`,
    "",
    message,
  ].join("\n");

  const html = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Project type:</strong> ${escapeHtml(projectType)}</p>
      <hr />
      <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
    `;

  let emailStatus = "sent";
  let emailError: string | null = null;
  try {
    await env.EMAIL.send({
      to: env.CONTACT_TO,
      from: { email: env.CONTACT_FROM, name: env.CONTACT_FROM_NAME },
      replyTo: email,
      subject,
      text,
      html,
    });
  } catch (err) {
    emailStatus = "failed";
    emailError = err instanceof Error ? err.message : String(err);
    console.error("Email send failed:", err);
  }

  // The dashboard is the durable record — a submission that reaches D1 is never
  // lost even when delivery fails, so only a double failure is reported as an
  // error to the visitor.
  let stored = false;
  try {
    await insertSubmission(env.DB, {
      ts: Math.floor(Date.now() / 1000),
      name,
      email,
      project_type: projectType,
      message,
      country: request.headers.get("CF-IPCountry"),
      referrer: request.headers.get("Referer")?.slice(0, 512) ?? null,
      email_status: emailStatus,
      email_error: emailError,
    });
    stored = true;
  } catch (err) {
    console.error("Storing submission failed:", err);
  }

  if (emailStatus === "failed" && !stored) {
    return json(
      { ok: false, error: "Failed to send message" },
      500,
      corsHeaders(request),
    );
  }

  return json({ ok: true }, 200, corsHeaders(request));
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return headers;
}
