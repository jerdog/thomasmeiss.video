/** Typed client for `/api/admin/*`. Every call rides the Cloudflare Access session. */

import type { ContractAnswers, ContractClient, ContractDocument } from "../../shared/contract";
import type { InvoiceItem, InvoiceTotals } from "../../shared/money";

export interface SeriesPoint {
  day: string;
  views: number;
  visitors: number;
  submissions: number;
  /**
   * Pre-launch daily views imported from Cloudflare Web Analytics.
   * `null` means Cloudflare had no record for that day — not a day of zero.
   */
  importedViews: number | null;
}

/** Coverage of the imported history, or null when none has been imported. */
export interface ImportedSummary {
  firstDay: string;
  lastDay: string;
  views: number;
  viewsInRange: number;
}

export interface Bucket {
  key: string;
  count: number;
}

/** p75 and sample count per Web Vitals metric; `p75` is null with no samples. */
export type VitalsSummary = Record<string, { p75: number | null; samples: number }>;

export interface Overview {
  range: { days: number; from: number; to: number };
  totals: {
    views: number;
    visitors: number;
    submissions: number;
    conversionRate: number;
    unread: number;
    allTimeSubmissions: number;
  };
  previous: { views: number; visitors: number; submissions: number };
  series: SeriesPoint[];
  breakdowns: {
    paths: Bucket[];
    referrers: Bucket[];
    countries: Bucket[];
    devices: Bucket[];
    /** How this range's inquiries heard about the site (contact-form answer). */
    heardAbout: Bucket[];
  };
  vitals: VitalsSummary;
  imported: ImportedSummary | null;
  /** First day this site tracked itself; before it, zeroes are not measurements. */
  trackingStartDay: string | null;
}

export type SubmissionStatus = "new" | "read" | "archived";

export interface Submission {
  id: number;
  ts: number;
  name: string;
  email: string;
  project_type: string;
  message: string;
  heard_about: string | null;
  heard_about_detail: string | null;
  country: string | null;
  referrer: string | null;
  email_status: string;
  email_error: string | null;
  status: SubmissionStatus;
}

export interface SubmissionsPage {
  items: Submission[];
  counts: Record<SubmissionStatus, number>;
  nextCursor: number | null;
}

/** Thrown on 401 so the UI can prompt for a fresh Access sign-in. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Your session has expired.");
    this.name = "UnauthorizedError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (res.status === 401) throw new UnauthorizedError();

  const body = (await res.json().catch(() => null)) as
    | ({ ok: boolean; error?: string } & T)
    | null;

  if (!res.ok || !body?.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body;
}

export function getSession() {
  return request<{ email: string }>("session");
}

export function getOverview(days: number) {
  return request<Overview>(`overview?days=${days}`);
}

export function getSubmissions(options: {
  status?: SubmissionStatus | null;
  before?: number | null;
}) {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.before) params.set("before", String(options.before));
  const query = params.toString();
  return request<SubmissionsPage>(`submissions${query ? `?${query}` : ""}`);
}

export function setSubmissionStatus(id: number, status: SubmissionStatus) {
  return request<{ id: number; status: SubmissionStatus }>(`submissions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteSubmission(id: number) {
  return request<{ id: number }>(`submissions/${id}`, { method: "DELETE" });
}

// --- Clients, contracts, invoices -------------------------------------------


export interface Client extends ContractClient {
  id: number;
}

export function getClients() {
  return request<{ items: (Omit<Client, "company" | "phone" | "address"> & {
    company: string | null;
    phone: string | null;
    address: string | null;
  })[] }>("clients");
}

export type ContractStatus = "draft" | "sent" | "signed" | "void";

export interface ContractSummary {
  id: number;
  title: string;
  status: ContractStatus;
  fee_cents: number;
  created_at: number;
  updated_at: number;
  sent_at: number | null;
  signed_at: number | null;
  signer_name: string | null;
  email_error: string | null;
  client_name: string;
  client_email: string;
}

export interface Contract {
  id: number;
  clientId: number;
  submissionId: number | null;
  title: string;
  status: ContractStatus;
  answers: ContractAnswers;
  /** Frozen text once sent; null for drafts, which preview live from `answers`. */
  document: ContractDocument | null;
  feeCents: number;
  signUrl: string | null;
  signerName: string | null;
  createdAt: number;
  updatedAt: number;
  sentAt: number | null;
  signedAt: number | null;
  emailError: string | null;
}

export interface LinkedInvoice {
  id: number;
  number: string;
  status: InvoiceStatus;
  total_cents: number;
  due_date: string;
}

export function getContracts(status: ContractStatus | null) {
  return request<{ items: ContractSummary[]; counts: Record<ContractStatus, number> }>(
    `contracts${status ? `?status=${status}` : ""}`,
  );
}

export function getContract(id: number) {
  return request<{ contract: Contract; invoices: LinkedInvoice[] }>(`contracts/${id}`);
}

export function saveContract(
  id: number | null,
  answers: ContractAnswers,
  submissionId: number | null = null,
) {
  return request<{ id: number; problems: string[] }>(id ? `contracts/${id}` : "contracts", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify({ answers, submissionId }),
  });
}

export function contractAction(id: number, action: "send" | "void") {
  return request<{ id: number; signUrl?: string }>(`contracts/${id}/${action}`, {
    method: "POST",
  });
}

export function deleteContract(id: number) {
  return request<{ id: number }>(`contracts/${id}`, { method: "DELETE" });
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type InvoiceFilter = InvoiceStatus | "overdue";

export interface InvoiceSummary {
  id: number;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  total_cents: number;
  sent_at: number | null;
  paid_at: number | null;
  email_error: string | null;
  client_name: string;
  client_company: string | null;
}

export interface InvoicesPage {
  items: InvoiceSummary[];
  counts: Record<InvoiceFilter, number>;
  summary: { outstandingCents: number; overdueCents: number; paidThisYearCents: number };
  defaults: { paymentInstructions: string };
}

export interface Invoice {
  id: number;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  taxRate: number;
  totals: InvoiceTotals;
  notes: string | null;
  paymentInstructions: string | null;
  client: ContractClient;
  contractId: number | null;
  contractTitle: string | null;
  createdAt: number;
  sentAt: number | null;
  lastReminderAt: number | null;
  paidAt: number | null;
  emailError: string | null;
}

export interface InvoiceDraft {
  client: ContractClient;
  contractId: number | null;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  taxRate: number;
  notes: string;
  paymentInstructions: string;
}

export function getInvoices(status: InvoiceFilter | null) {
  return request<InvoicesPage>(`invoices${status ? `?status=${status}` : ""}`);
}

export function getInvoice(id: number) {
  return request<{ invoice: Invoice }>(`invoices/${id}`);
}

export function saveInvoice(id: number | null, draft: InvoiceDraft) {
  return request<{ id: number; number?: string }>(id ? `invoices/${id}` : "invoices", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(draft),
  });
}

export function invoiceAction(
  id: number,
  action: "send" | "remind" | "paid" | "unpaid" | "void",
) {
  return request<{ id: number }>(`invoices/${id}/${action}`, { method: "POST" });
}

export function deleteInvoice(id: number) {
  return request<{ id: number }>(`invoices/${id}`, { method: "DELETE" });
}
