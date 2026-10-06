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
}: {
  doc: ContractDocument;
  signature?: { name: string; signedAt: number } | null;
  /** Marks a live draft preview so it is never mistaken for the sent text. */
  preview?: boolean;
}) {
  return (
    <article
      className="print-doc mx-auto max-w-3xl bg-[#fbfaf7] px-6 py-10 font-body text-[15px] leading-relaxed text-neutral-900 shadow-lg sm:px-12"
      aria-label={doc.title}
    >
      {preview && (
        <p className="mb-6 border border-dashed border-neutral-400 px-3 py-2 text-center text-xs uppercase tracking-widest text-neutral-600">
          Draft preview — dated the day it is sent
        </p>
      )}
      <h2 className="font-display text-3xl text-neutral-950">{doc.title}</h2>
      <p className="mt-4">{doc.intro}</p>

      {doc.sections.map((section) => (
        <section key={section.heading} className="mt-6">
          <h3 className="font-display text-xl text-neutral-950">{section.heading}</h3>
          {section.blocks.map((block, i) =>
            block.kind === "p" ? (
              <p key={i} className="mt-2 whitespace-pre-line">
                {block.text}
              </p>
            ) : (
              <ul key={i} className="mt-2 list-disc space-y-1 pl-6">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}

      <section className="mt-10 grid gap-8 border-t border-neutral-300 pt-6 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-600">Producer</p>
          <p className="mt-2 font-display text-lg">{doc.providerName}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-600">Client</p>
          {signature ? (
            <>
              <p className="mt-2 font-display text-2xl italic">{signature.name}</p>
              <p className="text-sm text-neutral-700">
                Signed electronically for {doc.clientName}
                <br />
                {new Date(signature.signedAt * 1000).toLocaleString(undefined, {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-neutral-600">{doc.clientName} — not yet signed</p>
          )}
        </div>
      </section>
    </article>
  );
}
