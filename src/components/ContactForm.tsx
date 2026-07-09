import { useRef, useState, type FormEvent } from "react";
import { projectTypes } from "../data/content";
import { PillButton } from "./ui/PillButton";
import { SectionHeading } from "./ui/SectionHeading";

type Status = "idle" | "sending" | "success" | "error";
type Field = "name" | "email" | "projectType" | "message";

const FIELD_ORDER: Field[] = ["name", "email", "projectType", "message"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(data: Record<string, unknown>): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  const name = String(data.name ?? "").trim();
  const email = String(data.email ?? "").trim();
  const projectType = String(data.projectType ?? "").trim();
  const message = String(data.message ?? "").trim();

  if (!name) errors.name = "Please enter your name.";
  if (!email) errors.email = "Please enter your email.";
  else if (!EMAIL_RE.test(email)) errors.email = "Please enter a valid email address.";
  if (!projectType) errors.projectType = "Please select a project type.";
  if (!message) errors.message = "Please tell me a little about your project.";

  return errors;
}

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    projectType: useRef<HTMLSelectElement>(null),
    message: useRef<HTMLTextAreaElement>(null),
  };

  function clearFieldError(field: Field) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    const errors = validate(data);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus("idle");
      const firstInvalid = FIELD_ORDER.find((f) => errors[f]);
      if (firstInvalid) refs[firstInvalid].current?.focus();
      return;
    }

    setFieldErrors({});
    setStatus("sending");

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

  const inputBase =
    "w-full border bg-transparent px-4 py-3 font-body text-sm text-bone placeholder:text-bone-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-accent";
  function inputClass(field: Field) {
    return `${inputBase} ${
      fieldErrors[field]
        ? "border-red-400 focus:border-red-400"
        : "border-border-strong focus:border-accent"
    }`;
  }
  const labelClass = "mb-2 block font-body text-xs uppercase tracking-widest text-bone-muted";
  const errorClass = "mt-1.5 font-body text-xs text-red-400";

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
            className="mt-10 font-display text-2xl text-accent-light"
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
                <label htmlFor="name" className={labelClass}>
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  ref={refs.name}
                  required
                  autoComplete="name"
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  onInput={() => clearFieldError("name")}
                  className={inputClass("name")}
                />
                {fieldErrors.name && (
                  <p id="name-error" className={errorClass} role="alert">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  ref={refs.email}
                  required
                  autoComplete="email"
                  aria-invalid={fieldErrors.email ? true : undefined}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  onInput={() => clearFieldError("email")}
                  className={inputClass("email")}
                />
                {fieldErrors.email && (
                  <p id="email-error" className={errorClass} role="alert">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="projectType" className={labelClass}>
                Project type
              </label>
              <select
                id="projectType"
                name="projectType"
                ref={refs.projectType}
                required
                defaultValue=""
                aria-invalid={fieldErrors.projectType ? true : undefined}
                aria-describedby={fieldErrors.projectType ? "projectType-error" : undefined}
                onChange={() => clearFieldError("projectType")}
                className={inputClass("projectType")}
              >
                <option value="" disabled>Select a type</option>
                {projectTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {fieldErrors.projectType && (
                <p id="projectType-error" className={errorClass} role="alert">
                  {fieldErrors.projectType}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="message" className={labelClass}>
                Message
              </label>
              <textarea
                id="message"
                name="message"
                ref={refs.message}
                required
                rows={5}
                aria-invalid={fieldErrors.message ? true : undefined}
                aria-describedby={fieldErrors.message ? "message-error" : undefined}
                onInput={() => clearFieldError("message")}
                className={inputClass("message")}
              />
              {fieldErrors.message && (
                <p id="message-error" className={errorClass} role="alert">
                  {fieldErrors.message}
                </p>
              )}
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
