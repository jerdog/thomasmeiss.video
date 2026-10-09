import { useId, useState, type FormEvent, type ReactNode } from "react";
import {
  BALANCE_TERMS,
  CANCELLATION_POLICIES,
  DELIVERABLES,
  DEPOSIT_OPTIONS,
  USAGE_RIGHTS,
  depositCents,
  normalizeAnswers,
  renderContract,
  totalCents,
  type ContractAnswers,
} from "../../../shared/contract";
import { centsToInput, formatCents, parseDollars } from "../../../shared/money";
import { projectTypes, site } from "../../data/content";
import { ContractPaper } from "../../documents/ContractPaper";
import { saveContract, UnauthorizedError } from "../api";
import { ClientFields } from "./ClientFields";
import { BackButton, Button, ErrorBanner, inputClass, labelClass, todayLocal } from "./ui";

/**
 * The contract questionnaire. Every answer maps to clause text in
 * `shared/contract.ts`; the preview beside the form is that generator's output,
 * so what is previewed here is exactly what the client is sent.
 */
export function ContractForm({
  contractId,
  initial,
  submissionId,
  onSaved,
  onCancel,
  onUnauthorized,
}: {
  contractId: number | null;
  initial: ContractAnswers;
  submissionId: number | null;
  onSaved: (id: number) => void;
  onCancel: () => void;
  onUnauthorized: () => void;
}) {
  const id = useId();
  const [answers, setAnswers] = useState<ContractAnswers>(initial);
  const [fee, setFee] = useState(initial.feeCents ? centsToInput(initial.feeCents) : "");
  const [travel, setTravel] = useState(
    initial.travelFeeCents ? centsToInput(initial.travelFeeCents) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Amount fields stay strings while typing; the answers carry cents.
  const current: ContractAnswers = {
    ...answers,
    feeCents: parseDollars(fee) ?? 0,
    travelFeeCents: parseDollars(travel) ?? 0,
  };
  const { errors } = normalizeAnswers(current);
  // Cheap enough to regenerate on every keystroke.
  const doc = renderContract(current, { providerName: site.name, date: todayLocal() });

  function update<K extends keyof ContractAnswers>(key: K, value: ContractAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDeliverable(deliverable: ContractAnswers["deliverables"][number]) {
    setAnswers((prev) => ({
      ...prev,
      deliverables: prev.deliverables.includes(deliverable)
        ? prev.deliverables.filter((d) => d !== deliverable)
        : [...prev.deliverables, deliverable],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await saveContract(contractId, current, submissionId);
      onSaved(result.id);
    } catch (err) {
      if (err instanceof UnauthorizedError) return onUnauthorized();
      setError(err instanceof Error ? err.message : "Could not save the contract.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <BackButton onClick={onCancel}>Contracts</BackButton>
      <h2 className="font-display text-2xl text-bone">
        {contractId ? "Edit contract" : "New contract"}
      </h2>

      <div className="grid gap-8 xl:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-10" noValidate>
          <ClientFields
            value={answers.client}
            onChange={(client) => update("client", client)}
            onUnauthorized={onUnauthorized}
          />

          <Fieldset legend="Project">
            <div>
              <label htmlFor={`${id}-type`} className={labelClass}>
                Project type
              </label>
              <input
                id={`${id}-type`}
                list={`${id}-types`}
                className={inputClass}
                value={answers.projectType}
                onChange={(e) => update("projectType", e.target.value)}
                placeholder="e.g. Highlight Reel"
              />
              <datalist id={`${id}-types`}>
                {projectTypes
                  .filter((type) => type !== "Other")
                  .map((type) => (
                    <option key={type} value={type} />
                  ))}
              </datalist>
            </div>
            <div>
              <label htmlFor={`${id}-description`} className={labelClass}>
                Description <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <textarea
                id={`${id}-description`}
                rows={3}
                className={inputClass}
                value={answers.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What is being filmed, for whom, and the goal of the video."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-date`} className={labelClass}>
                  Production date
                </label>
                <input
                  id={`${id}-date`}
                  type="date"
                  className={inputClass}
                  value={answers.shootDate}
                  onChange={(e) => update("shootDate", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor={`${id}-more-dates`} className={labelClass}>
                  Other dates <span className="normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  id={`${id}-more-dates`}
                  className={inputClass}
                  value={answers.additionalDates}
                  onChange={(e) => update("additionalDates", e.target.value)}
                  placeholder="e.g. all home games, Nov–Feb"
                />
              </div>
            </div>
            <div>
              <label htmlFor={`${id}-location`} className={labelClass}>
                Location
              </label>
              <input
                id={`${id}-location`}
                className={inputClass}
                value={answers.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </div>
          </Fieldset>

          <Fieldset legend="Deliverables">
            <div className="grid gap-2 sm:grid-cols-2">
              {DELIVERABLES.map((deliverable) => (
                <Check
                  key={deliverable.id}
                  checked={answers.deliverables.includes(deliverable.id)}
                  onChange={() => toggleDeliverable(deliverable.id)}
                >
                  {deliverable.label}
                </Check>
              ))}
            </div>
            <div>
              <label htmlFor={`${id}-custom`} className={labelClass}>
                Other deliverables <span className="normal-case tracking-normal">(one per line)</span>
              </label>
              <textarea
                id={`${id}-custom`}
                rows={2}
                className={inputClass}
                value={answers.customDeliverables}
                onChange={(e) => update("customDeliverables", e.target.value)}
              />
            </div>
            <Check checked={answers.rawFootage} onChange={() => update("rawFootage", !answers.rawFootage)}>
              Include raw, unedited footage
            </Check>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="First edit due (days after shoot)"
                value={answers.turnaroundDays}
                min={1}
                max={365}
                onChange={(value) => update("turnaroundDays", value)}
              />
              <NumberField
                label="Revision rounds"
                value={answers.revisionRounds}
                min={0}
                max={10}
                onChange={(value) => update("revisionRounds", value)}
              />
            </div>
          </Fieldset>

          <Fieldset legend="Payment">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-fee`} className={labelClass}>
                  Production fee (USD)
                </label>
                <input
                  id={`${id}-fee`}
                  inputMode="decimal"
                  className={inputClass}
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="0.00"
                  aria-invalid={fee !== "" && parseDollars(fee) === null ? true : undefined}
                />
              </div>
              <div>
                <label htmlFor={`${id}-travel`} className={labelClass}>
                  Travel fee <span className="normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  id={`${id}-travel`}
                  inputMode="decimal"
                  className={inputClass}
                  value={travel}
                  onChange={(e) => setTravel(e.target.value)}
                  placeholder="0.00"
                  aria-invalid={travel !== "" && parseDollars(travel) === null ? true : undefined}
                />
              </div>
            </div>

            <Radios
              legend="Deposit on signing"
              name={`${id}-deposit`}
              value={String(answers.depositPercent)}
              options={DEPOSIT_OPTIONS.map((pct) => ({
                id: String(pct),
                label: pct === 0 ? "None" : pct === 100 ? "Full payment" : `${pct}%`,
              }))}
              onChange={(value) => update("depositPercent", Number(value))}
            />

            {answers.depositPercent < 100 && (
              <div>
                <label htmlFor={`${id}-balance`} className={labelClass}>
                  Balance due
                </label>
                <select
                  id={`${id}-balance`}
                  className={inputClass}
                  value={answers.balanceTerms}
                  onChange={(e) => update("balanceTerms", e.target.value as ContractAnswers["balanceTerms"])}
                >
                  {BALANCE_TERMS.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <NumberField
              label="Late fee (% per month, 0 for none)"
              value={answers.lateFeePercent}
              min={0}
              max={10}
              step={0.5}
              onChange={(value) => update("lateFeePercent", value)}
            />

            <p className="font-body text-sm text-bone-muted">
              Total <span className="text-bone tabular-nums">{formatCents(totalCents(current))}</span>
              {current.depositPercent > 0 && current.depositPercent < 100 && (
                <>
                  {" "}· deposit{" "}
                  <span className="text-bone tabular-nums">{formatCents(depositCents(current))}</span>
                </>
              )}
            </p>
          </Fieldset>

          <Fieldset legend="Rights and policies">
            <Radios
              legend="Usage rights"
              name={`${id}-usage`}
              value={answers.usage}
              options={USAGE_RIGHTS}
              onChange={(value) => update("usage", value as ContractAnswers["usage"])}
            />
            <Check checked={answers.portfolioUse} onChange={() => update("portfolioUse", !answers.portfolioUse)}>
              I may use the work in my portfolio and social media
            </Check>
            <Radios
              legend="Cancellation policy"
              name={`${id}-cancel`}
              value={answers.cancellation}
              options={CANCELLATION_POLICIES}
              onChange={(value) => update("cancellation", value as ContractAnswers["cancellation"])}
            />
            <Check
              checked={answers.clientObtainsReleases}
              onChange={() => update("clientObtainsReleases", !answers.clientObtainsReleases)}
            >
              Client handles filming permissions and releases (incl. parental consent for minors)
            </Check>
            <div>
              <label htmlFor={`${id}-state`} className={labelClass}>
                Governing law — state <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id={`${id}-state`}
                className={inputClass}
                value={answers.governingState}
                onChange={(e) => update("governingState", e.target.value)}
                placeholder="e.g. Kansas"
              />
            </div>
            <div>
              <label htmlFor={`${id}-terms`} className={labelClass}>
                Additional terms <span className="normal-case tracking-normal">(optional; blank line between paragraphs)</span>
              </label>
              <textarea
                id={`${id}-terms`}
                rows={4}
                className={inputClass}
                value={answers.additionalTerms}
                onChange={(e) => update("additionalTerms", e.target.value)}
              />
            </div>
          </Fieldset>

          <ErrorBanner message={error} />

          {errors.length > 0 && (
            <div className="rounded border border-border p-4 font-body text-sm text-bone-muted">
              <p className="text-bone">Before this can be sent:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
              <p className="mt-2">You can still save it as a draft.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>

        <div className="xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto">
          <h3 className="mb-3 font-body text-xs uppercase tracking-widest text-bone-muted">
            Preview
          </h3>
          <ContractPaper doc={doc} preview />
        </div>
      </div>
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4 font-display text-xl text-bone">{legend}</legend>
      {children}
    </fieldset>
  );
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 font-body text-sm text-bone">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-[var(--color-accent)]"
      />
      {children}
    </label>
  );
}

function Radios({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: string;
  options: readonly { id: string; label: string; hint?: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex min-h-11 cursor-pointer items-start gap-3 py-1 font-body text-sm text-bone"
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
            />
            <span>
              {option.label}
              {option.hint && <span className="block text-xs text-bone-muted">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        className={inputClass}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? min : Number(e.target.value))}
      />
    </div>
  );
}
