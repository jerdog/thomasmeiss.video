import { useEffect, useId, useState } from "react";
import type { ContractClient } from "../../../shared/contract";
import { getClients, UnauthorizedError } from "../api";
import { FieldError, inputClass, invalidClass, labelClass } from "./ui";

type ClientOption = Awaited<ReturnType<typeof getClients>>["items"][number];

/**
 * Client contact fields, with a picker that fills them from a saved client.
 * The server finds-or-creates the client by email on save, so there is no
 * separate "clients" screen to keep in sync.
 */
export function ClientFields({
  value,
  onChange,
  onUnauthorized,
  idPrefix,
  errors = {},
}: {
  value: ContractClient;
  onChange: (client: ContractClient) => void;
  onUnauthorized: () => void;
  /** Field ids are `${idPrefix}-name`, `${idPrefix}-email`, … so a form can focus them. */
  idPrefix?: string;
  errors?: { name?: string; email?: string };
}) {
  const generated = useId();
  const id = idPrefix ?? generated;
  const [clients, setClients] = useState<ClientOption[]>([]);

  useEffect(() => {
    getClients()
      .then((page) => setClients(page.items))
      .catch((err) => {
        if (err instanceof UnauthorizedError) onUnauthorized();
      });
  }, [onUnauthorized]);

  const set = (key: keyof ContractClient) => (e: { target: { value: string } }) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <fieldset className="space-y-4">
      <legend className="font-display text-xl text-bone">Client</legend>

      {clients.length > 0 && (
        <div>
          <label htmlFor={`${id}-existing`} className={labelClass}>
            Fill from a saved client
          </label>
          <select
            id={`${id}-existing`}
            className={inputClass}
            value=""
            onChange={(e) => {
              const client = clients.find((c) => String(c.id) === e.target.value);
              if (!client) return;
              onChange({
                name: client.name,
                email: client.email,
                company: client.company ?? "",
                phone: client.phone ?? "",
                address: client.address ?? "",
              });
            }}
          >
            <option value="">Choose…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.company ? ` — ${client.company}` : ""} ({client.email})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={labelClass}>
            Name
          </label>
          <input
            id={`${id}-name`}
            className={`${inputClass} ${errors.name ? invalidClass : ""}`}
            value={value.name}
            onChange={set("name")}
            required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
            autoComplete="off"
          />
          <FieldError id={`${id}-name-error`} message={errors.name} />
        </div>
        <div>
          <label htmlFor={`${id}-email`} className={labelClass}>
            Email
          </label>
          <input
            id={`${id}-email`}
            type="email"
            className={`${inputClass} ${errors.email ? invalidClass : ""}`}
            value={value.email}
            onChange={set("email")}
            required
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${id}-email-error` : undefined}
            autoComplete="off"
          />
          <FieldError id={`${id}-email-error`} message={errors.email} />
        </div>
        <div>
          <label htmlFor={`${id}-company`} className={labelClass}>
            Organization / team <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <input id={`${id}-company`} className={inputClass} value={value.company} onChange={set("company")} autoComplete="off" />
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className={labelClass}>
            Phone <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <input id={`${id}-phone`} type="tel" className={inputClass} value={value.phone} onChange={set("phone")} autoComplete="off" />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-address`} className={labelClass}>
          Billing address <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <textarea id={`${id}-address`} rows={2} className={inputClass} value={value.address} onChange={set("address")} />
      </div>
    </fieldset>
  );
}
