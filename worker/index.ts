interface ContactPayload {
  name?: string;
  email?: string;
  projectType?: string;
  message?: string;
  "bot-field"?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/api/contact") {
      return new Response("Not Found", { status: 404 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405, request);
    }

    let body: ContactPayload;
    try {
      body = (await request.json()) as ContactPayload;
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400, request);
    }

    if (body["bot-field"]) {
      return json({ ok: true }, 200, request);
    }

    const name = body.name?.trim();
    const email = body.email?.trim();
    const projectType = body.projectType?.trim();
    const message = body.message?.trim();

    if (!name || !email || !projectType || !message) {
      return json({ ok: false, error: "All fields are required" }, 400, request);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "Invalid email address" }, 400, request);
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

    try {
      await env.EMAIL.send({
        to: env.CONTACT_TO,
        from: { email: env.CONTACT_FROM, name: env.CONTACT_FROM_NAME },
        replyTo: email,
        subject,
        text,
        html,
      });
      return json({ ok: true }, 200, request);
    } catch (err) {
      console.error("Email send failed:", err);
      return json({ ok: false, error: "Failed to send message" }, 500, request);
    }
  },
} satisfies ExportedHandler<Env>;

function json(data: unknown, status: number, request: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request),
    },
  });
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
