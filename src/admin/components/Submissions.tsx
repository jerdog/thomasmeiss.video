import { useCallback, useEffect, useState } from "react";
import {
  deleteSubmission,
  getSubmissions,
  setSubmissionStatus,
  UnauthorizedError,
  type Submission,
  type SubmissionStatus,
} from "../api";
import { countryName, dateTime } from "../format";

type Filter = SubmissionStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

export function Submissions({
  onUnauthorized,
  onUnreadChange,
}: {
  onUnauthorized: () => void;
  onUnreadChange: (unread: number) => void;
}) {
  const [filter, setFilter] = useState<Filter>("new");
  const [items, setItems] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Record<SubmissionStatus, number>>({
    new: 0,
    read: 0,
    archived: 0,
  });
  const [cursor, setCursor] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (next: Filter, before: number | null = null) => {
      setLoading(true);
      try {
        const page = await getSubmissions({
          status: next === "all" ? null : next,
          before,
        });
        setItems((current) => (before ? [...current, ...page.items] : page.items));
        setCounts(page.counts);
        setCursor(page.nextCursor);
        onUnreadChange(page.counts.new);
        setError("");
      } catch (err) {
        if (err instanceof UnauthorizedError) return onUnauthorized();
        setError(err instanceof Error ? err.message : "Could not load submissions.");
      } finally {
        setLoading(false);
      }
    },
    [onUnauthorized, onUnreadChange],
  );

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function changeStatus(submission: Submission, status: SubmissionStatus) {
    if (submission.status === status) return;
    const previousItems = items;
    const previousCounts = counts;

    // Optimistic, and updated in place: a row that no longer matches the active
    // filter still stays put until the filter is re-applied, so opening a new
    // inquiry (which marks it read) never yanks it out from under the reader.
    setItems((current) =>
      current.map((item) => (item.id === submission.id ? { ...item, status } : item)),
    );
    const nextCounts = { ...counts };
    nextCounts[submission.status] = Math.max(0, nextCounts[submission.status] - 1);
    nextCounts[status] += 1;
    setCounts(nextCounts);
    onUnreadChange(nextCounts.new);

    try {
      await setSubmissionStatus(submission.id, status);
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized();
      setItems(previousItems);
      setCounts(previousCounts);
      onUnreadChange(previousCounts.new);
      setError(err instanceof Error ? err.message : "Could not update the submission.");
    }
  }

  async function remove(submission: Submission) {
    if (!window.confirm(`Delete the inquiry from ${submission.name}? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteSubmission(submission.id);
      setItems((current) => current.filter((item) => item.id !== submission.id));
      const nextCounts = {
        ...counts,
        [submission.status]: Math.max(0, counts[submission.status] - 1),
      };
      setCounts(nextCounts);
      onUnreadChange(nextCounts.new);
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized();
      setError(err instanceof Error ? err.message : "Could not delete the submission.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-bone">Inquiries</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((option) => {
            const count =
              option.value === "all"
                ? counts.new + counts.read + counts.archived
                : counts[option.value];
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                aria-pressed={filter === option.value}
                className={`min-h-11 rounded-full border px-4 font-body text-xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  filter === option.value
                    ? "border-accent bg-accent/15 text-bone"
                    : "border-border text-bone-muted hover:border-border-strong hover:text-bone"
                }`}
              >
                {option.label}
                <span className="ml-2 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-400/50 bg-red-400/10 p-4 font-body text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="font-body text-sm text-bone-muted" role="status">
          {loading ? "Loading inquiries…" : "Nothing here."}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((submission) => {
            const isOpen = expanded === submission.id;
            return (
              <li
                key={submission.id}
                className="rounded border border-border bg-surface"
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(isOpen ? null : submission.id);
                    if (!isOpen && submission.status === "new") {
                      void changeStatus(submission, "read");
                    }
                  }}
                  aria-expanded={isOpen}
                  aria-controls={`submission-${submission.id}`}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {submission.status === "new" && (
                    <span className="rounded-full bg-accent/20 px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-accent-light">
                      New
                    </span>
                  )}
                  <span className="font-body text-sm font-semibold text-bone">
                    {submission.name}
                  </span>
                  <span className="font-body text-sm text-bone-muted">
                    {submission.project_type}
                  </span>
                  <span className="ml-auto font-body text-xs tabular-nums text-bone-muted">
                    {dateTime(submission.ts)}
                  </span>
                </button>

                {isOpen && (
                  <div id={`submission-${submission.id}`} className="border-t border-border p-4">
                    <dl className="grid gap-x-6 gap-y-2 font-body text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-widest text-bone-muted">Email</dt>
                        <dd>
                          <a
                            href={`mailto:${submission.email}?subject=${encodeURIComponent(
                              `Re: ${submission.project_type} inquiry`,
                            )}`}
                            className="link-underline text-accent-light"
                          >
                            {submission.email}
                          </a>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-widest text-bone-muted">From</dt>
                        <dd className="text-bone">
                          {submission.country ? countryName(submission.country) : "Unknown"}
                          {submission.referrer ? ` · ${submission.referrer}` : ""}
                        </dd>
                      </div>
                    </dl>

                    <p className="mt-4 whitespace-pre-wrap font-body text-sm leading-relaxed text-bone">
                      {submission.message}
                    </p>

                    {submission.email_status === "failed" && (
                      <p className="mt-4 rounded border border-amber-400/50 bg-amber-400/10 p-3 font-body text-xs text-amber-200">
                        ⚠ Email notification failed{submission.email_error ? `: ${submission.email_error}` : ""}.
                        The inquiry was still saved here.
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {submission.status !== "read" && (
                        <ActionButton onClick={() => changeStatus(submission, "read")}>
                          Mark as read
                        </ActionButton>
                      )}
                      {submission.status !== "new" && (
                        <ActionButton onClick={() => changeStatus(submission, "new")}>
                          Mark as new
                        </ActionButton>
                      )}
                      {submission.status !== "archived" && (
                        <ActionButton onClick={() => changeStatus(submission, "archived")}>
                          Archive
                        </ActionButton>
                      )}
                      <ActionButton onClick={() => remove(submission)} destructive>
                        Delete
                      </ActionButton>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {cursor && (
        <button
          type="button"
          onClick={() => void load(filter, cursor)}
          disabled={loading}
          className="min-h-11 rounded-full border border-border px-5 font-body text-xs uppercase tracking-widest text-bone-muted transition-colors hover:border-border-strong hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load older"}
        </button>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  destructive,
  children,
}: {
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 font-body text-xs uppercase tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        destructive
          ? "border-red-400/50 text-red-300 hover:bg-red-400/10"
          : "border-border text-bone-muted hover:border-border-strong hover:text-bone"
      }`}
    >
      {children}
    </button>
  );
}
