import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ContractDocument } from "../../shared/contract";

type Layout = "page" | "reading";

/**
 * A contract as a document, shared by the dashboard and the public signing
 * page. `.print-doc` is what survives print.
 *
 * Two layouts:
 * - `page` — a US Letter sheet at 0.5in margins in the exact print layout
 *   (index.css `page-layout` variant), scaled to fit. What you see is what
 *   prints, and it warns when the contract would run past one page.
 * - `reading` — larger single-column type for reading on any screen. It still
 *   prints in the page layout.
 */
export function ContractPaper({
  doc,
  signature,
  preview = false,
  signHint,
  layout: initialLayout = "reading",
  layoutToggle = false,
}: {
  doc: ContractDocument;
  signature?: { name: string; signedAt: number } | null;
  /** Marks a live draft preview so it is never mistaken for the sent text. */
  preview?: boolean;
  /** Shown on the client's empty signature line, e.g. where to sign online. */
  signHint?: string;
  layout?: Layout;
  /** Offer a Page / Reading switch — the scaled page can be too small to read. */
  layoutToggle?: boolean;
}) {
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const page = layout === "page";

  const article = (
    <article
      data-layout={layout}
      className={`print-doc contract-paper text-neutral-900 ${
        page
          ? ""
          : "mx-auto max-w-3xl bg-[#fbfaf7] px-6 py-10 font-body text-[15px] leading-relaxed shadow-lg ring-1 ring-black/10 sm:px-12"
      }`}
      aria-label={doc.title}
    >
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

  return (
    <div className="space-y-3">
      {(layoutToggle || preview) && (
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {layoutToggle && (
            <div className="flex gap-1" role="group" aria-label="Contract view">
              {(["page", "reading"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLayout(option)}
                  aria-pressed={layout === option}
                  className={`min-h-11 rounded-full border px-4 font-body text-xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    layout === option
                      ? "border-accent bg-accent/15 text-bone"
                      : "border-border text-bone-muted hover:border-border-strong hover:text-bone"
                  }`}
                >
                  {option === "page" ? "Page (as printed)" : "Reading view"}
                </button>
              ))}
            </div>
          )}
          {preview && (
            <p className="border border-dashed border-border-strong px-3 py-2 font-body text-xs uppercase tracking-widest text-bone-muted">
              Draft preview — dated the day it is sent
            </p>
          )}
        </div>
      )}
      {page ? <PageSheet>{article}</PageSheet> : article}
    </div>
  );
}

/** US Letter at 96 CSS px per inch, with 0.5in margins — the print geometry. */
const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;
const PAGE_MARGIN = 48;
const PRINTABLE_HEIGHT = PAGE_HEIGHT - 2 * PAGE_MARGIN;

/**
 * Draws the sheet at true size and scales it down to fit its column, so the
 * line breaks and column split are the ones the printer will produce.
 */
function PageSheet({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const measure = () => {
      setScale(Math.min(1, frame.clientWidth / PAGE_WIDTH));
      setContentHeight(content.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const pages = Math.max(1, Math.ceil(contentHeight / PRINTABLE_HEIGHT));
  const sheetHeight = pages * PAGE_HEIGHT;

  return (
    <div className="space-y-2">
      {pages > 1 && (
        <p
          className="rounded border border-warning/50 bg-warning/10 p-3 font-body text-sm text-warning print:hidden"
          role="status"
        >
          This contract prints on {pages} pages. Shorten the description, deliverables, or
          additional terms to fit it on one.
        </p>
      )}
      <div ref={frameRef} className="w-full" style={{ height: sheetHeight * scale }}>
        <div
          className="origin-top-left bg-[#fbfaf7] shadow-lg ring-1 ring-black/10"
          style={{
            width: PAGE_WIDTH,
            height: sheetHeight,
            padding: PAGE_MARGIN,
            transform: `scale(${scale})`,
            // Faint rule where page 1 ends, when there is a page 2.
            backgroundImage:
              pages > 1
                ? `repeating-linear-gradient(to bottom, transparent 0, transparent ${PAGE_HEIGHT - 1}px, rgb(0 0 0 / 0.25) ${PAGE_HEIGHT - 1}px, rgb(0 0 0 / 0.25) ${PAGE_HEIGHT}px)`
                : undefined,
          }}
        >
          <div ref={contentRef}>{children}</div>
        </div>
      </div>
    </div>
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
