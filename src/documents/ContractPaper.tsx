import type { ContractDocument } from "../../shared/contract";

/**
 * A contract rendered as a printable page — light paper on the dark UI, so it
 * reads (and prints) as the document the client receives. Shared by the
 * dashboard and the public signing page. `.print-doc` is what survives print.
 */
export function ContractPaper({
  doc,
  signature,
  preview = false,
  signHint,
}: {
  doc: ContractDocument;
  signature?: { name: string; signedAt: number } | null;
  /** Marks a live draft preview so it is never mistaken for the sent text. */
  preview?: boolean;
  /** Shown on the client's empty signature line, e.g. where to sign online. */
  signHint?: string;
}) {
  return (
    <article
      className="print-doc contract-paper mx-auto max-w-3xl bg-[#fbfaf7] px-6 py-10 font-body text-[15px] leading-relaxed text-neutral-900 shadow-lg ring-1 ring-black/10 sm:px-12"
      aria-label={doc.title}
    >
      {preview && (
        <p className="mb-6 border border-dashed border-neutral-400 px-3 py-2 text-center text-xs uppercase tracking-widest text-neutral-600">
          Draft preview — dated the day it is sent
        </p>
      )}
      <h2 className="font-display text-3xl text-neutral-950">{doc.title}</h2>
      <p className="mt-4">{doc.intro}</p>

      {/* Two columns in print, so a contract fits on one page (see index.css). */}
      <div className="contract-body">
        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-5">
            <h3 className="font-display text-lg text-neutral-950">{section.heading}</h3>
            {section.blocks.map((block, i) =>
              block.kind === "p" ? (
                <p key={i} className="mt-1.5 whitespace-pre-line">
                  {block.text}
                </p>
              ) : (
                // Lists only appear in contracts frozen before the compact wording.
                <ul key={i} className="mt-1.5 list-disc space-y-1 pl-6">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </div>

      <section
        className="contract-signatures mt-10 border-t-2 border-neutral-800 pt-5"
        aria-labelledby="contract-signatures-heading"
      >
        <h3 id="contract-signatures-heading" className="font-display text-xl text-neutral-950">
          Signatures
        </h3>
        <p className="mt-1 text-sm text-neutral-700">
          By signing below, each party agrees to the terms of this Agreement.
        </p>
        <div className="contract-signature-grid mt-4 grid gap-6 sm:grid-cols-2">
          <SignatureBlock role="Producer" party={doc.providerName} signature={null} />
          <SignatureBlock
            role="Client"
            party={doc.clientName}
            signature={signature ?? null}
            hint={signHint}
          />
        </div>
      </section>
    </article>
  );
}

/**
 * One party's signature area: a ruled signature line plus printed name and
 * date lines, so it is obvious where each party signs — on screen and on a
 * printed copy signed by hand. An electronic signature fills the lines in.
 */
function SignatureBlock({
  role,
  party,
  signature,
  hint,
}: {
  role: string;
  party: string;
  signature: { name: string; signedAt: number } | null;
  hint?: string;
}) {
  const signedOn = signature
    ? new Date(signature.signedAt * 1000).toLocaleDateString(undefined, { dateStyle: "long" })
    : "";

  return (
    <div className="contract-signature rounded border border-neutral-400 p-4">
      <p className="sig-role text-xs font-semibold uppercase tracking-widest text-neutral-700">{role}</p>
      <p className="sig-party mt-0.5 text-sm text-neutral-900">{party}</p>

      <div className="contract-signature-line mt-4 flex h-14 items-end border-b-2 border-neutral-800 pb-1">
        {signature ? (
          <span className="font-display text-2xl italic leading-none text-neutral-950">{signature.name}</span>
        ) : (
          hint && <span className="text-xs italic text-neutral-500 print:hidden">{hint}</span>
        )}
      </div>
      <p className="sig-caption mt-1 text-xs text-neutral-600">
        Signature{signature ? " (signed electronically)" : ""}
      </p>

      <div className="sig-fields mt-4 grid grid-cols-[1fr_auto] gap-4">
        <div>
          <p className="min-h-6 border-b border-neutral-500 pb-0.5 text-sm text-neutral-900">
            {signature?.name ?? ""}
          </p>
          <p className="mt-1 text-xs text-neutral-600">Printed name</p>
        </div>
        <div className="w-36">
          <p className="min-h-6 border-b border-neutral-500 pb-0.5 text-sm text-neutral-900">{signedOn}</p>
          <p className="mt-1 text-xs text-neutral-600">Date</p>
        </div>
      </div>
      {signature && (
        <p className="sig-stamp mt-2 text-xs text-neutral-600">
          Signed{" "}
          {new Date(signature.signedAt * 1000).toLocaleString(undefined, {
            dateStyle: "long",
            timeStyle: "short",
          })}
        </p>
      )}
    </div>
  );
}
