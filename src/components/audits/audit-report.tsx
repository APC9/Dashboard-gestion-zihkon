import { CheckCircle2, Lightbulb, MapPin, Phone, Star, Globe, AlertCircle } from "lucide-react";
import { JsonView, Score } from "@/components/shared/json-view";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { humanizeKey } from "@/lib/format";

/**
 * Presentación legible del informe JSONB. Reconoce las claves más habituales
 * (puntuación, resumen, secciones con hallazgos/recomendaciones) y deja el
 * resto en una vista estructurada genérica. Nunca muestra JSON crudo por defecto.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const SCORE_KEYS = ["puntuacion_global", "puntuacion", "score", "overall_score", "nota", "nota_global", "total_score"];
const SUMMARY_KEYS = ["resumen", "summary", "resumen_ejecutivo", "conclusion", "conclusiones", "diagnostico"];
const SECTION_KEYS = ["secciones", "sections", "apartados", "categorias", "categories", "areas"];
const FINDINGS_KEYS = ["hallazgos", "findings", "problemas", "issues", "puntos_debiles", "debilidades"];
const RECS_KEYS = ["recomendaciones", "recommendations", "acciones", "mejoras", "next_steps"];
const TITLE_KEYS = ["titulo", "title", "nombre", "name", "categoria", "area"];

function pick(obj: Obj, keys: string[]) {
  for (const k of keys) if (k in obj && obj[k] != null) return { key: k, value: obj[k] };
  return null;
}

function asStrings(v: unknown): string[] | null {
  if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) return v.map(String);
  if (typeof v === "string") return [v];
  return null;
}

export function AuditReport({ informe }: { informe: unknown }) {
  if (informe == null) return <p className="text-sm text-muted-foreground">Esta auditoría no tiene informe.</p>;
  const data = typeof informe === "string" ? safeParse(informe) : informe;
  if (!isObj(data)) return <JsonView data={data} />;

  const score = pick(data, SCORE_KEYS);
  const summary = pick(data, SUMMARY_KEYS);
  const sections = pick(data, SECTION_KEYS);
  const used = new Set([score?.key, summary?.key, sections?.key].filter(Boolean) as string[]);
  const rest = Object.fromEntries(Object.entries(data).filter(([k]) => !used.has(k)));

  return (
    <div className="flex flex-col gap-4">
      {score || summary ? (
        <Card>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-start">
            {score && typeof score.value === "number" ? (
              <div className="flex shrink-0 flex-col gap-2 md:w-56">
                <span className="text-sm text-muted-foreground">Puntuación global</span>
                <span className="text-4xl font-semibold tabular-nums">{score.value}</span>
                <Score value={score.value} />
              </div>
            ) : null}
            {summary ? (
              <div className="min-w-0 flex-1 space-y-1">
                <span className="text-sm text-muted-foreground">{humanizeKey(summary.key)}</span>
                {typeof summary.value === "string" ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary.value}</p>
                ) : (
                  <JsonView data={summary.value} />
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {sections && Array.isArray(sections.value) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.value.map((s, i) => (
            <SectionCard key={i} section={s} index={i} />
          ))}
        </div>
      ) : sections && isObj(sections.value) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(sections.value).map(([k, v], i) => (
            <SectionCard key={k} section={isObj(v) ? { titulo: humanizeKey(k), ...v } : { titulo: humanizeKey(k), detalle: v }} index={i} />
          ))}
        </div>
      ) : null}

      {Object.keys(rest).length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalles del informe</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonView data={rest} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SectionCard({ section, index }: { section: unknown; index: number }) {
  if (!isObj(section)) {
    return (
      <Card>
        <CardContent>
          <JsonView data={section} />
        </CardContent>
      </Card>
    );
  }
  const title = pick(section, TITLE_KEYS);
  const score = pick(section, SCORE_KEYS);
  const findings = pick(section, FINDINGS_KEYS);
  const recs = pick(section, RECS_KEYS);
  const used = new Set([title?.key, score?.key, findings?.key, recs?.key].filter(Boolean) as string[]);
  const rest = Object.fromEntries(Object.entries(section).filter(([k]) => !used.has(k)));
  const findingList = findings ? asStrings(findings.value) : null;
  const recList = recs ? asStrings(recs.value) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span>{title ? String(title.value) : `Sección ${index + 1}`}</span>
          {score && typeof score.value === "number" ? <Score value={score.value} /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {findings ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <AlertCircle className="size-4 text-amber-500" /> {humanizeKey(findings.key)}
            </p>
            {findingList ? (
              <ul className="space-y-1.5 text-sm">
                {findingList.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <JsonView data={findings.value} />
            )}
          </div>
        ) : null}
        {recs ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Lightbulb className="size-4 text-emerald-500" /> {humanizeKey(recs.key)}
            </p>
            {recList ? (
              <ul className="space-y-1.5 text-sm">
                {recList.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <JsonView data={recs.value} />
            )}
          </div>
        ) : null}
        {Object.keys(rest).length ? <JsonView data={rest} depth={1} /> : null}
      </CardContent>
    </Card>
  );
}

/** Ficha resumida de Google Places con los campos habituales de la API. */
export function GooglePlacesCard({ data }: { data: unknown }) {
  const places = typeof data === "string" ? safeParse(data) : data;
  if (!isObj(places)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Places</CardTitle>
          <CardDescription>Sin datos de Google Places.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const rating = (places.rating ?? places.puntuacion) as number | undefined;
  const total = (places.user_ratings_total ?? places.userRatingCount ?? places.total_resenas) as number | undefined;
  const phone = (places.formatted_phone_number ?? places.nationalPhoneNumber ?? places.international_phone_number) as string | undefined;
  const website = (places.website ?? places.websiteUri) as string | undefined;
  const address = (places.formatted_address ?? places.formattedAddress) as string | undefined;
  const types = Array.isArray(places.types) ? (places.types as string[]) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google Places</CardTitle>
        <CardDescription>Datos públicos del negocio en Google en el momento de la auditoría.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {rating != null ? (
            <Info icon={<Star className="size-4 fill-amber-400 text-amber-400" />} label="Valoración" value={`${rating} (${total ?? "?"} reseñas)`} />
          ) : null}
          {phone ? <Info icon={<Phone className="size-4" />} label="Teléfono" value={phone} /> : null}
          {address ? <Info icon={<MapPin className="size-4" />} label="Dirección" value={address} /> : null}
          {website ? (
            <Info
              icon={<Globe className="size-4" />}
              label="Web"
              value={
                <a href={website} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
                  {website}
                </a>
              }
            />
          ) : null}
        </div>
        {types.length ? (
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {humanizeKey(t)}
              </span>
            ))}
          </div>
        ) : null}
        <details className="group rounded-lg border">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground select-none hover:text-foreground">
            Ver todos los datos de Google Places
          </summary>
          <div className="border-t p-3">
            <JsonView data={places} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  );
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
