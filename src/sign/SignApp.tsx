import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { ContractDocument } from "../../shared/contract";
import { site } from "../data/content";
import { ContractPaper } from "../documents/ContractPaper";

interface SignableContract {
  title: string;
  status: "sent" | "signed" | "void";
  document: ContractDocument;
  signerName: string | null;
  signedAt: number | null;
}

type Load =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "ready"; contract: SignableContract };

/**
 * Public `/sign/:token` page — the client reviews the contract and signs by
 * typing their name. The token in the URL is the only credential; the Worker
 * serves just the frozen text of that one contract.
 */
export default function SignApp() {
  const token = window.location.pathname.replace(/^\/sign\/?/, "").replace(/\/+$/, "");
  const id = useId();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const [justSigned, setJustSigned] = useState(false);

  useEffect(() => {
    document.title = `Contract — ${site.name}`;
    // A signing link is private: keep it out of search indexes.
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);

    fetch(`/api/sign/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { ok: boolean; contract?: SignableContract }
          | null;
        setLoad(res.ok && body?.contract ? { state: "ready", contract: body.contract } : { state: "missing" });
      })
      .catch(() => setLoad({ state: "missing" }));
  }, [token]);

  useEffect(() => {
    if (justSigned) confirmationRef.current?.focus();
  }, [justSigned]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (load.state !== "ready") return;
    setError("");
    if (!name.trim()) return setError("Type your full name to sign.");
    if (!agree) return setError("Please confirm you agree to the terms.");

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), agree }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; signerName?: string; signedAt?: number }
        | null;
      if (!res.ok || !body?.ok) throw new Error(body?.error ?? "Could not sign — please try again.");
      setLoad({
        state: "ready",
        contract: {
          ...load.contract,
          status: "signed",
          signerName: body.signerName ?? name.trim(),
          signedAt: body.signedAt ?? Math.floor(Date.now() / 1000),
        },
      });
      setJustSigned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-ground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <p className="font-display text-xl text-bone">{site.name}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {load.state === "loading" && (
          <p className="font-body text-sm text-bone-muted" role="status">
            Loading contract…
          </p>
        )}

        {load.state === "missing" && (
          <div>
            <h1 className="font-display text-3xl text-bone">Contract not found</h1>
            <p className="mt-4 font-body text-bone-muted">
              This link is incomplete or no longer valid. Please check the email you received, or
              reply to it for a new link.
            </p>
          </div>
        )}

        {load.state === "ready" && (
          <Contract
            contract={load.contract}
            justSigned={justSigned}
            confirmationRef={confirmationRef}
          >
            {load.contract.status === "sent" && (
              <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
                <h2 className="font-display text-2xl text-bone">Sign</h2>
                <div>
                  <label
                    htmlFor={`${id}-name`}
                    className="mb-2 block font-body text-xs uppercase tracking-widest text-bone-muted"
                  >
                    Your full name
                  </label>
                  <input
                    id={`${id}-name`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    maxLength={120}
                    className="w-full border border-border-strong bg-transparent px-4 py-3 font-display text-xl italic text-bone focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 font-body text-sm text-bone">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                  />
                  I have read this agreement and agree to its terms on behalf of{" "}
                  {load.contract.document.clientName}. Typing my name above is my electronic
                  signature.
                </label>
                {error && (
                  <p className="font-body text-sm text-red-400" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 rounded-full border border-accent bg-accent/15 px-6 font-body text-xs uppercase tracking-widest text-bone transition-colors hover:bg-accent/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                >
                  {submitting ? "Signing…" : "Sign agreement"}
                </button>
              </form>
            )}
          </Contract>
        )}
      </main>
    </div>
  );
}

function Contract({
  contract,
  justSigned,
  confirmationRef,
  children,
}: {
  contract: SignableContract;
  justSigned: boolean;
  confirmationRef: React.RefObject<HTMLHeadingElement | null>;
  children: React.ReactNode;
}) {
  const signature =
    contract.signerName && contract.signedAt
      ? { name: contract.signerName, signedAt: contract.signedAt }
      : null;

  return (
    <>
      <h1 className="font-display text-3xl text-bone">{contract.title}</h1>

      <div className="mt-4 font-body text-sm text-bone-muted" role="status" aria-live="polite">
        {contract.status === "sent" && (
          <p>Please read the agreement below, then sign at the bottom of the page.</p>
        )}
        {contract.status === "signed" && (
          <h2
            ref={confirmationRef}
            tabIndex={-1}
            className="font-display text-xl text-accent-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {justSigned ? "Signed — thank you. A copy is on its way to your inbox." : "This agreement has been signed."}
          </h2>
        )}
        {contract.status === "void" && (
          <p className="text-amber-200">This agreement has been withdrawn and can no longer be signed.</p>
        )}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-11 rounded-full border border-border px-4 font-body text-xs uppercase tracking-widest text-bone-muted hover:border-border-strong hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Print / save PDF
        </button>
      </div>

      <div className="mt-6">
        <ContractPaper
          doc={contract.document}
          signature={signature}
          signHint={contract.status === "sent" ? "Sign using the form below this agreement" : undefined}
        />
      </div>

      {children}
    </>
  );
}
