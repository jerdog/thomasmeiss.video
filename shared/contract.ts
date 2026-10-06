/**
 * Contract generator, shared by the admin app (live preview) and the Worker
 * (the text that is frozen, emailed, and signed).
 *
 * A contract is generated from a short questionnaire — `ContractAnswers` — by
 * assembling fixed clauses. Every choice maps to clause text here, so the
 * admin never edits legal prose by hand, and the same answers always produce
 * the same document. The output is plain structured text (`ContractDocument`),
 * rendered to React in the dashboard and to HTML/plain text for email.
 *
 * The clause wording is a sensible starting template for freelance video work,
 * not legal advice — have it reviewed for your state before relying on it.
 */

import { formatCents, longDate } from "./money";

export const DELIVERABLES = [
  { id: "game-coverage", label: "Full game / event coverage" },
  { id: "highlight-reel", label: "Highlight reel" },
  { id: "hype-video", label: "Hype video" },
  { id: "season-recap", label: "Season recap" },
  { id: "social-cutdowns", label: "Social media cutdowns (vertical and square)" },
  { id: "motion-graphics", label: "Motion graphics and titles" },
  { id: "color-sound", label: "Professional color grade and sound mix" },
  { id: "aerial", label: "Aerial / drone footage, where permitted by law and the venue" },
] as const;

export type DeliverableId = (typeof DELIVERABLES)[number]["id"];

export const BALANCE_TERMS = [
  { id: "before-delivery", label: "Before final files are delivered" },
  { id: "on-delivery", label: "On delivery of final files" },
  { id: "net-15", label: "Within 15 days of invoice" },
  { id: "net-30", label: "Within 30 days of invoice" },
] as const;

export type BalanceTerms = (typeof BALANCE_TERMS)[number]["id"];

export const USAGE_RIGHTS = [
  {
    id: "standard",
    label: "Standard license",
    hint: "Client's own promotion and social media; no paid ads or resale",
  },
  {
    id: "commercial",
    label: "Commercial license",
    hint: "Adds paid advertising and broadcast",
  },
  {
    id: "buyout",
    label: "Full buyout",
    hint: "Copyright in the finished videos transfers to the client",
  },
] as const;

export type UsageRights = (typeof USAGE_RIGHTS)[number]["id"];

export const CANCELLATION_POLICIES = [
  { id: "flexible", label: "Flexible", hint: "Full refund up to 7 days out" },
  { id: "standard", label: "Standard", hint: "Deposit kept; 50% due inside 14 days" },
  { id: "strict", label: "Strict", hint: "Non-refundable; full fee due inside 30 days" },
] as const;

export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number]["id"];

export const DEPOSIT_OPTIONS = [0, 25, 50, 100] as const;

export interface ContractClient {
  name: string;
  email: string;
  company: string;
  phone: string;
  address: string;
}

export interface ContractAnswers {
  client: ContractClient;
  projectType: string;
  description: string;
  /** YYYY-MM-DD, or "" when the date is not set yet. */
  shootDate: string;
  additionalDates: string;
  location: string;
  deliverables: DeliverableId[];
  customDeliverables: string;
  turnaroundDays: number;
  revisionRounds: number;
  feeCents: number;
  travelFeeCents: number;
  depositPercent: number;
  balanceTerms: BalanceTerms;
  /** Monthly late fee, percent. 0 means none. */
  lateFeePercent: number;
  usage: UsageRights;
  portfolioUse: boolean;
  rawFootage: boolean;
  clientObtainsReleases: boolean;
  cancellation: CancellationPolicy;
  governingState: string;
  additionalTerms: string;
}

export type ContractBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] };

export interface ContractSection {
  heading: string;
  blocks: ContractBlock[];
}

export interface ContractDocument {
  title: string;
  /** The date the agreement is dated — the day it was first sent. */
  date: string;
  intro: string;
  sections: ContractSection[];
  providerName: string;
  clientName: string;
}

export function emptyAnswers(): ContractAnswers {
  return {
    client: { name: "", email: "", company: "", phone: "", address: "" },
    projectType: "",
    description: "",
    shootDate: "",
    additionalDates: "",
    location: "",
    deliverables: [],
    customDeliverables: "",
    turnaroundDays: 14,
    revisionRounds: 2,
    feeCents: 0,
    travelFeeCents: 0,
    depositPercent: 50,
    balanceTerms: "before-delivery",
    lateFeePercent: 0,
    usage: "standard",
    portfolioUse: true,
    rawFootage: false,
    clientObtainsReleases: true,
    cancellation: "standard",
    governingState: "",
    additionalTerms: "",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Coerce untrusted JSON into answers: unknown keys dropped, every field typed
 * and bounded. Returns the cleaned answers plus human-readable problems.
 */
export function normalizeAnswers(input: unknown): {
  answers: ContractAnswers;
  errors: string[];
} {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const rawClient = (raw.client && typeof raw.client === "object" ? raw.client : {}) as Record<
    string,
    unknown
  >;
  const defaults = emptyAnswers();

  const answers: ContractAnswers = {
    client: {
      name: text(rawClient.name, 120),
      email: text(rawClient.email, 254).toLowerCase(),
      company: text(rawClient.company, 160),
      phone: text(rawClient.phone, 40),
      address: text(rawClient.address, 300),
    },
    projectType: text(raw.projectType, 80),
    description: text(raw.description, 4000),
    shootDate: DATE_RE.test(String(raw.shootDate ?? "")) ? String(raw.shootDate) : "",
    additionalDates: text(raw.additionalDates, 300),
    location: text(raw.location, 300),
    deliverables: Array.isArray(raw.deliverables)
      ? DELIVERABLES.map((d) => d.id).filter((id) => (raw.deliverables as unknown[]).includes(id))
      : [],
    customDeliverables: text(raw.customDeliverables, 2000),
    turnaroundDays: int(raw.turnaroundDays, 1, 365, defaults.turnaroundDays),
    revisionRounds: int(raw.revisionRounds, 0, 10, defaults.revisionRounds),
    feeCents: int(raw.feeCents, 0, 100_000_000, 0),
    travelFeeCents: int(raw.travelFeeCents, 0, 100_000_000, 0),
    depositPercent: (DEPOSIT_OPTIONS as readonly number[]).includes(Number(raw.depositPercent))
      ? Number(raw.depositPercent)
      : defaults.depositPercent,
    balanceTerms: oneOf(raw.balanceTerms, BALANCE_TERMS, defaults.balanceTerms),
    lateFeePercent: Math.min(10, Math.max(0, Number(raw.lateFeePercent) || 0)),
    usage: oneOf(raw.usage, USAGE_RIGHTS, defaults.usage),
    portfolioUse: raw.portfolioUse === undefined ? defaults.portfolioUse : Boolean(raw.portfolioUse),
    rawFootage: Boolean(raw.rawFootage),
    clientObtainsReleases:
      raw.clientObtainsReleases === undefined
        ? defaults.clientObtainsReleases
        : Boolean(raw.clientObtainsReleases),
    cancellation: oneOf(raw.cancellation, CANCELLATION_POLICIES, defaults.cancellation),
    governingState: text(raw.governingState, 60),
    additionalTerms: text(raw.additionalTerms, 6000),
  };

  const errors: string[] = [];
  if (!answers.client.name) errors.push("Client name is required.");
  if (!EMAIL_RE.test(answers.client.email)) errors.push("A valid client email is required.");
  if (!answers.projectType) errors.push("Project type is required.");
  if (answers.deliverables.length === 0 && !answers.customDeliverables) {
    errors.push("Choose at least one deliverable.");
  }
  if (answers.feeCents <= 0) errors.push("Enter the project fee.");

  return { answers, errors };
}

export function contractTitle(answers: ContractAnswers): string {
  const who = answers.client.company || answers.client.name || "New client";
  return `${answers.projectType || "Video production"} — ${who}`;
}

export function depositCents(answers: ContractAnswers): number {
  return Math.round((answers.feeCents * answers.depositPercent) / 100);
}

export function totalCents(answers: ContractAnswers): number {
  return answers.feeCents + answers.travelFeeCents;
}

/** Assemble the agreement. Pure: same answers, provider and date → same text. */
export function renderContract(
  answers: ContractAnswers,
  options: { providerName: string; date: string },
): ContractDocument {
  const { client } = answers;
  const provider = options.providerName;
  const clientName = client.company ? `${client.company} (represented by ${client.name})` : client.name;
  const sections: ContractSection[] = [];

  // 1. Project
  const when = [
    answers.shootDate ? longDate(answers.shootDate) : "",
    answers.additionalDates,
  ]
    .filter(Boolean)
    .join("; ");
  sections.push({
    heading: "Project",
    blocks: [
      p(`Producer will provide video production services to Client for the following project: ${answers.projectType}.`),
      ...(answers.description ? [p(answers.description)] : []),
      p(`Production date(s): ${when || "to be agreed in writing"}.`),
      p(`Location: ${answers.location || "to be agreed in writing"}.`),
    ],
  });

  // 2. Deliverables
  const deliverables = [
    ...DELIVERABLES.filter((d) => answers.deliverables.includes(d.id)).map((d) => d.label),
    ...answers.customDeliverables
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean),
  ];
  sections.push({
    heading: "Deliverables",
    blocks: [
      p("Producer will deliver the following:"),
      { kind: "list", items: deliverables },
      p("Finished videos are delivered digitally, by download link, in a standard web-ready format."),
      p(
        answers.rawFootage
          ? "Raw, unedited footage is included and will be delivered alongside the finished videos."
          : "Raw, unedited footage is not included. It remains with Producer and may be purchased separately.",
      ),
    ],
  });

  // 3. Schedule and revisions
  const rounds = answers.revisionRounds;
  sections.push({
    heading: "Schedule and Revisions",
    blocks: [
      p(`Producer will deliver the first edit within ${plural(answers.turnaroundDays, "day")} of the final production date.`),
      p(
        rounds > 0
          ? `Client may request up to ${plural(rounds, "round")} of revisions, each submitted as one consolidated list of changes. Further revisions, or changes to the scope above, are billed at Producer's then-current rate with Client's prior approval.`
          : "The fee does not include revisions. Any revision, or change to the scope above, is billed at Producer's then-current rate with Client's prior approval.",
      ),
      p("If Client does not respond within 14 days of receiving an edit, that edit is considered approved."),
    ],
  });

  // 4. Fees and payment
  const total = totalCents(answers);
  const deposit = depositCents(answers);
  const balance = total - deposit;
  const feeBlocks: ContractBlock[] = [
    p(
      answers.travelFeeCents > 0
        ? `The total fee is ${formatCents(total)}: ${formatCents(answers.feeCents)} for production and ${formatCents(answers.travelFeeCents)} for travel.`
        : `The total fee is ${formatCents(total)}.`,
    ),
  ];
  if (answers.depositPercent >= 100) {
    feeBlocks.push(p(`Full payment of ${formatCents(total)} is due on signing and reserves the production date(s).`));
  } else {
    if (deposit > 0) {
      feeBlocks.push(p(`A deposit of ${answers.depositPercent}% of the production fee (${formatCents(deposit)}) is due on signing and reserves the production date(s). The date is not held until the deposit is received.`));
    }
    feeBlocks.push(p(`The ${deposit > 0 ? "remaining balance" : "full fee"} of ${formatCents(balance)} is due ${balanceDue(answers.balanceTerms)}.`));
  }
  if (answers.balanceTerms === "before-delivery" && answers.depositPercent < 100) {
    feeBlocks.push(p("Final, unwatermarked files are released once payment is received in full."));
  }
  if (answers.lateFeePercent > 0) {
    feeBlocks.push(p(`Amounts unpaid after their due date accrue a late fee of ${answers.lateFeePercent}% per month.`));
  }
  sections.push({ heading: "Fees and Payment", blocks: feeBlocks });

  // 5. Cancellation and rescheduling
  sections.push({
    heading: "Cancellation and Rescheduling",
    blocks: [
      p(cancellationText(answers.cancellation)),
      p("If the event is postponed for weather, a schedule change, or another reason outside Client's control, payments already made are applied to the rescheduled date, subject to Producer's availability."),
      p("If Producer cannot attend because of illness, emergency, or circumstances beyond Producer's control, Producer will try to arrange a qualified replacement. If none is available, Producer will refund all payments made for the affected work, and that refund is the full extent of Producer's liability."),
    ],
  });

  // 6. Usage rights and ownership
  const usageBlocks = [p(usageText(answers.usage))];
  usageBlocks.push(
    p(
      answers.portfolioUse
        ? "Producer may use the finished videos, and stills from them, in Producer's portfolio, website, showreel, and social media."
        : "Producer will not publicly display the finished videos without Client's written permission.",
    ),
  );
  usageBlocks.push(p("Licensed music and stock media are used under the terms of their licenses, which may limit where the finished videos can be published."));
  sections.push({ heading: "Usage Rights and Ownership", blocks: usageBlocks });

  // 7. Client responsibilities
  sections.push({
    heading: "Client Responsibilities",
    blocks: [
      p("Client will provide timely access to the venue, any credentials or passes needed, and a point of contact on the production date(s)."),
      p(
        answers.clientObtainsReleases
          ? "Client is responsible for obtaining any permissions, releases, and venue approvals required for filming, including consent from a parent or guardian for any minor who is filmed."
          : "Producer will obtain on-camera releases from featured individuals. Client is responsible for venue access and any venue approvals required for filming.",
      ),
    ],
  });

  // 8. Liability
  sections.push({
    heading: "Limitation of Liability",
    blocks: [
      p("Producer will perform the work with professional care, but is not liable for footage that cannot be captured because of venue restrictions, weather, equipment failure, or other circumstances beyond Producer's control. Producer's total liability under this Agreement is limited to the fees Client has paid."),
      p("Producer will keep project files for at least 90 days after delivery. After that they may be archived or deleted."),
    ],
  });

  if (answers.additionalTerms) {
    sections.push({
      heading: "Additional Terms",
      blocks: answers.additionalTerms
        .split(/\n\s*\n/)
        .map((para) => para.trim())
        .filter(Boolean)
        .map(p),
    });
  }

  sections.push({
    heading: "General",
    blocks: [
      p("This Agreement is the entire agreement between the parties about this project. Changes must be agreed in writing; email is sufficient."),
      ...(answers.governingState
        ? [p(`This Agreement is governed by the laws of the State of ${answers.governingState}.`)]
        : []),
      p("Each party agrees that an electronic signature on this Agreement is as valid as a handwritten one."),
    ],
  });

  // Number the sections once, after optional ones are in.
  sections.forEach((section, i) => {
    section.heading = `${i + 1}. ${section.heading}`;
  });

  return {
    title: "Video Production Agreement",
    date: options.date,
    intro: `This Video Production Agreement ("Agreement") is made on ${longDate(options.date)} between ${provider} ("Producer") and ${clientName} ("Client").`,
    sections,
    providerName: provider,
    clientName,
  };
}

/** Plain-text rendering, for the text/plain part of emails. */
export function contractToText(doc: ContractDocument): string {
  const lines = [doc.title.toUpperCase(), "", doc.intro, ""];
  for (const section of doc.sections) {
    lines.push(section.heading, "");
    for (const block of section.blocks) {
      if (block.kind === "p") lines.push(block.text, "");
      else lines.push(...block.items.map((item) => `  • ${item}`), "");
    }
  }
  return lines.join("\n");
}

function balanceDue(terms: BalanceTerms): string {
  switch (terms) {
    case "before-delivery":
      return "before final files are delivered";
    case "on-delivery":
      return "on delivery of the final files";
    case "net-15":
      return "within 15 days of the invoice date";
    case "net-30":
      return "within 30 days of the invoice date";
  }
}

function cancellationText(policy: CancellationPolicy): string {
  switch (policy) {
    case "flexible":
      return "Client may cancel up to 7 days before the first production date for a full refund of any payments made. Cancellation within 7 days forfeits the deposit.";
    case "standard":
      return "The deposit is non-refundable. If Client cancels within 14 days of the first production date, 50% of the total fee is due, less any deposit already paid.";
    case "strict":
      return "Payments are non-refundable once this Agreement is signed. If Client cancels within 30 days of the first production date, the full fee is due.";
  }
}

function usageText(usage: UsageRights): string {
  switch (usage) {
    case "standard":
      return "Producer keeps the copyright in all footage and finished videos. Once paid in full, Client receives a perpetual, non-exclusive license to use the finished videos for Client's own promotion, website, and social media. Paid advertising, broadcast, and resale require a separate license.";
    case "commercial":
      return "Producer keeps the copyright in all footage and finished videos. Once paid in full, Client receives a perpetual, non-exclusive license to use the finished videos for any commercial purpose, including paid advertising and broadcast. Client may not resell or sublicense the videos as standalone works.";
    case "buyout":
      return "Once paid in full, Producer assigns to Client all copyright in the finished videos. Producer keeps the copyright in raw footage that is not delivered.";
  }
}

function p(text: string): ContractBlock {
  return { kind: "p", text };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && value !== "" && value !== null ? Math.min(max, Math.max(min, n)) : fallback;
}

function oneOf<T extends string>(
  value: unknown,
  options: readonly { id: T }[],
  fallback: T,
): T {
  return options.some((option) => option.id === value) ? (value as T) : fallback;
}
