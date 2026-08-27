import { pruneAnalytics } from "./lib/db";
import { handleAdmin } from "./routes/admin";
import { handleCollect } from "./routes/collect";
import { handleContact } from "./routes/contact";
import { handleVitals } from "./routes/vitals";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      return handleContact(request, env);
    }

    if (url.pathname === "/api/collect") {
      return handleCollect(request, env, ctx);
    }

    if (url.pathname === "/api/vitals") {
      return handleVitals(request, env, ctx);
    }

    if (url.pathname === "/api/admin" || url.pathname.startsWith("/api/admin/")) {
      return handleAdmin(request, env, url);
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      pruneAnalytics(env)
        .then((deleted) => console.log(`Pruned ${deleted} expired analytics rows`))
        .catch((err) => console.error("Analytics prune failed:", err)),
    );
  },
} satisfies ExportedHandler<Env>;
