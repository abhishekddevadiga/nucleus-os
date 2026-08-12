"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Generic create/update form used by most "+ Add X" flows. Field names with
// dots ("payment.amount") post as nested objects. Renders inline inside a
// <details> disclosure unless `alwaysOpen`.

export interface FieldSpec {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "date" | "datetime-local" | "number" | "email" | "password" | "url";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  min?: number;
  step?: number;
  hint?: string;
}

export default function QuickForm({
  endpoint,
  method = "POST",
  fields,
  submitLabel,
  title,
  alwaysOpen = false,
  redirectTemplate,
  extra,
}: {
  endpoint: string;
  method?: "POST" | "PATCH" | "PUT";
  fields: FieldSpec[];
  submitLabel: string;
  title?: string;
  alwaysOpen?: boolean;
  redirectTemplate?: string; // e.g. "/projects/{id}" — {key} filled from response
  extra?: Record<string, unknown>; // constant fields merged into the payload
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openKey, setOpenKey] = useState(0); // bump to reset <details> + form

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload: Record<string, unknown> = { ...(extra ?? {}) };
    for (const spec of fields) {
      const raw = data.get(spec.name);
      if (raw === null || raw === "") continue;
      let value: unknown = raw;
      if (spec.type === "number") value = Number(raw);
      const path = spec.name.split(".");
      let target = payload;
      for (let i = 0; i < path.length - 1; i++) {
        target[path[i]] = target[path[i]] ?? {};
        target = target[path[i]] as Record<string, unknown>;
      }
      target[path[path.length - 1]] = value;
    }
    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (redirectTemplate) {
        router.push(redirectTemplate.replace(/\{(\w+)\}/g, (_, k) => String(body[k] ?? "")));
      }
      setOpenKey((k) => k + 1);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Failed (${res.status}).`);
    }
  }

  const formBody = (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" key={openKey}>
      {fields.map((f) => (
        <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
          <label className="label">{f.label}{f.required ? " *" : ""}</label>
          {f.type === "textarea" ? (
            <textarea name={f.name} className="input min-h-20" placeholder={f.placeholder} required={f.required} defaultValue={f.defaultValue} />
          ) : f.type === "select" ? (
            <select name={f.name} className="input" required={f.required} defaultValue={f.defaultValue}>
              {!f.required && <option value="">—</option>}
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              name={f.name}
              type={f.type ?? "text"}
              className="input"
              placeholder={f.placeholder}
              required={f.required}
              defaultValue={f.defaultValue}
              min={f.min}
              step={f.step}
            />
          )}
          {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
        </div>
      ))}
      <div className="flex items-end gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </form>
  );

  if (alwaysOpen) return <div className="card p-4">{formBody}</div>;

  return (
    <details key={`d${openKey}`} className="card group">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-brand-600 hover:text-brand-700">
        + {title ?? submitLabel}
      </summary>
      <div className="border-t border-slate-100 p-4">{formBody}</div>
    </details>
  );
}
