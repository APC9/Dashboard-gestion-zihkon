"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ActiveBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, toastError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

interface Admin {
  phoneE164: string;
  active: boolean | null;
  createdAt: Date | string | null;
}

export function AutomationAdmins({ admins }: { admins: Admin[] }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const add = async () => {
    setAdding(true);
    try {
      await api("/api/admin/automation-admins", { method: "POST", body: { phoneE164: phone, active: true } });
      toast.success("Teléfono añadido");
      setPhone("");
      router.refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (a: Admin, active: boolean) => {
    if (!active && !window.confirm(`¿Seguro que quieres desactivar ${a.phoneE164}? Dejará de poder dar órdenes a las automatizaciones.`)) return;
    setBusy(a.phoneE164);
    try {
      await api(`/api/admin/automation-admins/${encodeURIComponent(a.phoneE164)}`, { method: "PATCH", body: { active } });
      toast.success(active ? "Activado" : "Desactivado");
      router.refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34600111222" inputMode="tel" className="sm:w-64" aria-label="Teléfono" />
        <Button type="submit" disabled={adding || phone.trim().length < 7}>
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Añadir
        </Button>
      </form>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Alta</TableHead>
              <TableHead className="text-right">Activo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  No hay teléfonos registrados
                </TableCell>
              </TableRow>
            ) : (
              admins.map((a) => (
                <TableRow key={a.phoneE164}>
                  <TableCell className="font-mono text-sm">{a.phoneE164}</TableCell>
                  <TableCell>
                    <ActiveBadge active={a.active} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(a.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={a.active === true}
                      disabled={busy === a.phoneE164}
                      onCheckedChange={(v) => void toggle(a, v)}
                      aria-label={`Activar ${a.phoneE164}`}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
