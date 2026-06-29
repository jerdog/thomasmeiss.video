import { useState, type FormEvent } from "react";
import { projectTypes } from "../data/content";
import { PillButton } from "./ui/PillButton";
import { SectionHeading } from "./ui/SectionHeading";

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Something went wrong");
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const inputClass =
    "w-full border border-border bg-transparent px-4 py-3 font-body text-sm text-bone placeholder:text-bone-muted/50 transition-colors focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember";

  return (
    <section id="contact" className="px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-2xl">
        <SectionHeading
          title="Contact"
          subtitle="Start a conversation"
          className="mb-0"
        />
        <p className="mt-4 font-body text-bone-muted">
          Tell me about your project — I'll reply within two business days.
        </p>

        {status === "success" ? (
          <p
            className="mt-10 font-display text-2xl text-ember-light"
            role="status"
            aria-live="polite"
          >
            Sent — talk soon ✓
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="relative mt-10 space-y-5" noValidate>
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <label htmlFor="bot-field">Leave blank</label>
              <input id="bot-field" name="bot-field" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-2 block font-body text-xs uppercase tracking-widest text-bone-muted">
                  Name
                </label>
                <input id="name" name="name" type="text" required autoComplete="name" className={inputClass} />
              </div>
              <div>
                <label htmlFor="email" className="mb-2 block font-body text-xs uppercase tracking-widest text-bone-muted">
                  Email
                </label>
                <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
              </div>
            </div>

            <div>
              <label htmlFor="projectType" className="mb-2 block font-body text-xs uppercase tracking-widest text-bone-muted">
                Project type
              </label>
              <select id="projectType" name="projectType" required className={inputClass} defaultValue="">
                <option value="" disabled>Select a type</option>
                {projectTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="message" className="mb-2 block font-body text-xs uppercase tracking-widest text-bone-muted">
                Message
              </label>
              <textarea id="message" name="message" required rows={5} className={inputClass} />
            </div>

            {status === "error" && (
              <p className="text-sm text-red-400" role="alert" aria-live="assertive">
                {errorMsg}
              </p>
            )}

            <PillButton
              type="submit"
              disabled={status === "sending"}
              className="disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send message"}
            </PillButton>
          </form>
        )}
      </div>
    </section>
  );
}
