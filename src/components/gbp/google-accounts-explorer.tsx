"use client";

import { AlertTriangle, Check, Copy, Loader2, Plus, Search, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { GoogleAccountItem } from "@/lib/validation/gbp";

/** El servidor ya descarta las cuentas sin fichas: location_id siempre viene informado. */
type Row = GoogleAccountItem & { location_id: string; profile_id: string | null };

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; items: Row[]; fetchedAt: string };

/** Última consulta guardada en el navegador: solo se vuelve a consultar al pulsar el botón. */
const STORAGE_KEY = "zihkon:gbp-accounts";

function readCache(): { items: Row[]; fetchedAt: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return raw && Array.isArray(raw.items) && typeof raw.fetchedAt === "string" ? raw : null;
  } catch {
    return null;
  }
}

function writeCache(value: { items: Row[]; fetchedAt: string }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible: se pierde al recargar */
  }
}

/** Consulta bajo demanda (nunca al entrar en la página): el workflow tarda y llama a la API de Google.
 * Al entrar se muestra la última consulta guardada en localStorage. */
export function GoogleAccountsExplorer() {
  const [state, setState] = useState<State>({ kind: "idle" });

  // localStorage solo existe en el navegador: se lee tras hidratar para no desajustar el HTML del servidor.
  useEffect(() => {
    const cached = readCache();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con almacenamiento externo una sola vez
    if (cached) setState({ kind: "done", ...cached });
  }, []);

  const load = async () => {
    setState({ kind: "loading" });
    try {
      const res = await api<{ items: Row[] }>("/api/gbp/accounts", { method: "POST", body: {} });
      const result = { items: res.items, fetchedAt: new Date().toISOString() };
      writeCache(result);
      setState({ kind: "done", ...result });
    } catch (error) {
      setState({ kind: "error", message: error instanceof ApiError ? error.message : "No se pudo consultar Google" });
    }
  };

  const loading = state.kind === "loading";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {loading ? "Consultando…" : "Consultar en Google"}
        </Button>
        {state.kind === "done" ? (
          <span className="text-sm text-muted-foreground">Última consulta: {formatDateTime(state.fetchedAt)}</span>
        ) : null}
      </div>

      {state.kind === "idle" ? (
        <EmptyState
          icon={Store}
          title="Sin consultar"
          description="Pulsa «Consultar en Google» para ver las cuentas y fichas. La consulta puede tardar unos segundos."
        />
      ) : null}

      {state.kind === "error" ? (
        <EmptyState icon={AlertTriangle} title="No se pudieron obtener las cuentas" description={state.message} />
      ) : null}

      {state.kind === "done" && state.items.length === 0 ? (
        <EmptyState icon={Store} title="No hay fichas" description="n8n no ha devuelto ninguna cuenta con fichas." />
      ) : null}

      {state.kind === "done" && state.items.length > 0 ? <AccountsTable items={state.items} /> : null}
    </div>
  );
}

function AccountsTable({ items }: { items: Row[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Cuenta</TableHead>
              <TableHead>account_id</TableHead>
              <TableHead>Ficha</TableHead>
              <TableHead>location_id</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead className="text-right">Alta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.account_id}:${item.location_id}`}>
                <TableCell className="font-medium">{item.account_name}</TableCell>
                <TableCell>
                  <CopyableId value={item.account_id} label="account_id" />
                </TableCell>
                <TableCell>{item.title ?? "—"}</TableCell>
                <TableCell>
                  <CopyableId value={item.location_id} label="location_id" />
                </TableCell>
                <TableCell className="max-w-64 text-sm text-muted-foreground">{item.address ?? "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {item.profile_id ? (
                    <Badge asChild variant="secondary">
                      <Link href={`/gbp/profiles/${item.profile_id}`}>
                        <Check className="size-3" /> Ya dado de alta
                      </Link>
                    </Badge>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/gbp/profiles/new?${new URLSearchParams({ accountId: item.account_id, locationId: item.location_id })}`}
                      >
                        <Plus className="size-4" /> Dar de alta
                      </Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CopyableId({ value, label }: { value: string; label: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-xs">{value}</span>
      <Button type="button" size="icon-sm" variant="ghost" onClick={copy} aria-label={`Copiar ${label}`} title={`Copiar ${label}`}>
        <Copy className="size-3.5" />
      </Button>
    </span>
  );
}
