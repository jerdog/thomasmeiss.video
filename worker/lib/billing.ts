/**
 * Shared plumbing for the contract and invoice routes: client records, tokens,
 * and outbound client email.
 */

import type { ContractClient } from "../../shared/contract";
import { site } from "../../src/data/content";
import type { EmailContent } from "./documents";

/** Business name printed on contracts and invoices — the same one the site shows. */
export const PROVIDER_NAME: string = site.name;

export const INVOICE_PREFIX = "TMV";

export type ContractStatus = "draft" | "sent" | "signed" | "void";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export const CONTRACT_STATUSES: readonly ContractStatus[] = ["draft", "sent", "signed", "void"];
export const INVOICE_STATUSES: readonly InvoiceStatus[] = ["draft", "sent", "paid", "void"];

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Find-or-create by email, refreshing the contact details to the latest ones
 * entered — the same person on a second contract stays one client.
 */
export async function upsertClient(db: D1Database, client: ContractClient): Promise<number> {
  const now = nowSeconds();
  const row = await db
    .prepare(
      `INSERT INTO clients (name, email, company, phone, address, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
       ON CONFLICT (email) DO UPDATE SET
         name = excluded.name,
         company = excluded.company,
         phone = excluded.phone,
         address = excluded.address,
         updated_at = excluded.updated_at
       RETURNING id`,
    )
    .bind(
      client.name,
      client.email.toLowerCase(),
      client.company || null,
      client.phone || null,
      client.address || null,
      now,
    )
    .first<{ id: number }>();
  if (!row) throw new Error("Could not save the client");
  return row.id;
}

/** `table` is one of two fixed names, never request input. */
export async function isDraft(
  env: Env,
  table: "contracts" | "invoices",
  id: number,
): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT status FROM ${table} WHERE id = ?`)
    .bind(id)
    .first<{ status: string }>();
  return row?.status === "draft";
}

/** 256 bits of randomness, hex — the only credential a signing link carries. */
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Send to a client. Replies go to the business inbox, and that inbox gets a
 * blind copy so every document sent is on record there too.
 *
 * Note: until the domain is onboarded for Cloudflare Email Sending, the
 * `send_email` binding can only reach verified Destination Addresses, so a
 * real client address fails here — the error is returned for the UI to show.
 */
export async function sendClientEmail(
  env: Env,
  to: { email: string; name: string },
  content: EmailContent,
  options: { copyOwner?: boolean } = {},
): Promise<string | null> {
  const copyOwner =
    (options.copyOwner ?? true) && to.email.toLowerCase() !== env.CONTACT_TO?.toLowerCase();
  try {
    await env.EMAIL.send({
      to: { email: to.email, name: to.name },
      from: { email: env.CONTACT_FROM, name: env.CONTACT_FROM_NAME || PROVIDER_NAME },
      replyTo: env.CONTACT_TO,
      bcc: copyOwner ? env.CONTACT_TO : undefined,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return null;
  } catch (err) {
    console.error("Client email failed:", err);
    return err instanceof Error ? err.message : String(err);
  }
}

/** Notify the business inbox (a verified destination, so this always works). */
export async function sendOwnerEmail(env: Env, content: EmailContent): Promise<void> {
  try {
    await env.EMAIL.send({
      to: env.CONTACT_TO,
      from: { email: env.CONTACT_FROM, name: env.CONTACT_FROM_NAME || PROVIDER_NAME },
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  } catch (err) {
    console.error("Owner notification failed:", err);
  }
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
