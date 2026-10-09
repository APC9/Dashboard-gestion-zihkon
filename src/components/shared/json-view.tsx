import { ExternalLink } from "lucide-react";
import { humanizeKey } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Representación legible de un JSON arbitrario (JSONB): objetos como fichas
 * de clave/valor, arrays de texto como listas, puntuaciones como barras.
 * No muestra JSON crudo salvo que se pida explícitamente.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const SCORE_KEY = /(score|puntuaci|nota|rating|calificaci)/i;

function isPlainObject(v: unknown): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isUrl(v: string) {
  return /^https?:\/\/\S+$/i.test(v);
}

function Primitive({ value, keyName }: { value: Json; keyName?: string }) {
  if (value === null || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return <span>{value ? "Sí" : "No"}</span>;
  if (typeof value === "number" && keyName && SCORE_KEY.test(keyName)) return <Score value={value} />;
  if (typeof value === "string" && isUrl(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-primary hover:underline">
        {value} <ExternalLink className="size-3 shrink-0" />
      </a>
    );
  }
  return <span className="break-words whitespace-pre-wrap">{String(value)}</span>;
}

export function Score({ value, max }: { value: number; max?: number }) {
  const scale = max ?? (value <= 5 ? 5 : value <= 10 ? 10 : 100);
  const pct = Math.max(0, Math.min(100, (value / scale) * 100));
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-sm font-medium tabular-nums">
        {value}
        <span className="text-muted-foreground">/{scale}</span>
      </span>
    </span>
  );
}

export function JsonView({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const value = data as Json;

  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-muted-foreground">Sin elementos</span>;
    if (value.every((v) => !isPlainObject(v) && !Array.isArray(v))) {
      return (
        <ul className="list-disc space-y-1 pl-5">
          {value.map((v, i) => (
            <li key={i}>
              <Primitive value={v} />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <div className="grid gap-3">
        {value.map((v, i) => (
          <div key={i} className="rounded-lg border bg-muted/20 p-3">
            <JsonView data={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (!entries.length) return <span className="text-muted-foreground">Sin datos</span>;
    return (
      <dl className={cn("grid gap-x-6 gap-y-3", depth === 0 ? "sm:grid-cols-[minmax(140px,220px)_1fr]" : "sm:grid-cols-[minmax(120px,180px)_1fr]")}>
        {entries.map(([k, v]) => {
          const complex = isPlainObject(v) || (Array.isArray(v) && v.some((x) => isPlainObject(x) || Array.isArray(x)));
          return (
            <div key={k} className={cn("contents")}>
              <dt className="text-sm font-medium text-muted-foreground">{humanizeKey(k)}</dt>
              <dd className={cn("min-w-0 text-sm", complex && "sm:col-span-1")}>
                {isPlainObject(v) || Array.isArray(v) ? <JsonView data={v} depth={depth + 1} /> : <Primitive value={v} keyName={k} />}
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }

  return <Primitive value={value} />;
}

export function RawJson({ data }: { data: unknown }) {
  return (
    <pre className="max-h-[480px] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
