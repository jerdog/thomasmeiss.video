/** Small form and action primitives shared by the contract and invoice views. */

import type { ReactNode } from "react";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const inputClass =
  "w-full rounded-none border border-border-strong bg-transparent px-3 py-2.5 font-body text-sm text-bone placeholder:text-bone-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent";

export const labelClass = "mb-1.5 block font-body text-xs uppercase tracking-widest text-bone-muted";

export function Button({
  onClick,
  type = "button",
  variant = "default",
  disabled,
  children,
}: {
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "default" | "primary" | "destructive";
  disabled?: boolean;
  children: ReactNode;
}) {
  const styles = {
    default: "border-border text-bone-muted hover:border-border-strong hover:text-bone",
    primary: "border-accent bg-accent/15 text-bone hover:bg-accent/25",
    destructive: "border-red-400/50 text-red-300 hover:bg-red-400/10",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-full border px-4 font-body text-xs uppercase tracking-widest transition-colors disabled:opacity-50 ${FOCUS} ${styles}`}
    >
      {children}
    </button>
  );
}

export function FilterButtons<T extends string>({
  label,
  options,
  value,
  counts,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  counts?: Partial<Record<T, number>>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`min-h-11 rounded-full border px-4 font-body text-xs uppercase tracking-widest transition-colors ${FOCUS} ${
            value === option.value
              ? "border-accent bg-accent/15 text-bone"
              : "border-border text-bone-muted hover:border-border-strong hover:text-bone"
          }`}
        >
          {option.label}
          {counts?.[option.value] !== undefined && (
            <span className="ml-2 tabular-nums">{counts[option.value]}</span>
          )}
        </button>
      ))}
    </div>
  );
}

const BADGE_STYLES: Record<string, string> = {
  draft: "bg-bone/10 text-bone-muted",
  sent: "bg-accent/20 text-accent-light",
  signed: "bg-emerald-400/15 text-emerald-200",
  paid: "bg-emerald-400/15 text-emerald-200",
  overdue: "bg-amber-400/15 text-amber-200",
  void: "bg-red-400/10 text-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-body text-[10px] uppercase tracking-widest ${
        BADGE_STYLES[status] ?? BADGE_STYLES.draft
      }`}
    >
      {status}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      className="rounded border border-red-400/50 bg-red-400/10 p-4 font-body text-sm text-red-200"
      role="alert"
    >
      {message}
    </p>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      className="rounded border border-accent/40 bg-accent/10 p-4 font-body text-sm text-bone"
      role="status"
    >
      {children}
    </p>
  );
}

export function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 font-body text-xs uppercase tracking-widest text-bone-muted hover:text-bone ${FOCUS}`}
    >
      ← {children}
    </button>
  );
}

/** Message for a failed send: explains the one configuration gap that causes most failures. */
export function emailFailureHint(error: string): string {
  return /verified|destination/i.test(error)
    ? `${error} — Cloudflare can only email verified addresses until thomasmeiss.video is onboarded for Email Sending (see README → Contracts and invoices).`
    : error;
}

export function todayLocal(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
