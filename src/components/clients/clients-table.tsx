"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Eye, MoreHorizontal, Pencil, Power, PowerOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { ActiveBadge, StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, toastError } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export interface ClientTableRow {
  clientId: string;
  clientName: string | null;
  whatsappE164: string | null;
  active: boolean;
  createdAt: Date | string | null;
  websiteUrl: string | null;
  websiteCount: number;
  gbp: { gbpClientId: string; locationId: string; active: boolean | null }[];
  contentCount: number;
  pendingContent: number;
}

export function ClientsTable({ rows }: { rows: ClientTableRow[] }) {
  const router = useRouter();
  const [toggle, setToggle] = useState<ClientTableRow | null>(null);

  const columns: ColumnDef<ClientTableRow>[] = [
    {
      accessorKey: "clientName",
      header: "Cliente",
      cell: ({ row }) => (
        <Link href={`/clients/${row.original.clientId}`} className="font-medium hover:underline">
          {row.original.clientName ?? "Sin nombre"}
        </Link>
      ),
    },
    {
      accessorKey: "whatsappE164",
      header: "WhatsApp",
      enableSorting: false,
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string | null) ?? "—"}</span>,
    },
    {
      id: "web",
      header: "Web",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.websiteUrl ? (
          <a
            href={row.original.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-48 items-center gap-1 truncate text-sm text-primary hover:underline"
          >
            <span className="truncate">{row.original.websiteUrl.replace(/^https?:\/\//, "")}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : row.original.websiteCount ? (
          <StatusBadge tone="neutral" label="Sin URL" />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "gbp",
      header: "GBP",
      enableSorting: false,
      cell: ({ row }) => {
        const links = row.original.gbp;
        if (!links.length) return <span className="text-sm text-muted-foreground">—</span>;
        const active = links.some((l) => l.active !== false);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={`/clients/${row.original.clientId}?tab=gbp`}>
                <StatusBadge tone={active ? "success" : "warning"} label={links.length > 1 ? `${links.length} perfiles` : active ? "Activo" : "Inactivo"} />
              </Link>
            </TooltipTrigger>
            <TooltipContent>{links.map((l) => l.locationId).join(", ")}</TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "contentCount",
      header: "Contenido",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.contentCount}
          {row.original.pendingContent ? (
            <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">({row.original.pendingContent} pend.)</span>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: "active",
      header: "Estado",
      cell: ({ row }) => <ActiveBadge active={row.original.active} />,
    },
    {
      accessorKey: "createdAt",
      header: "Fecha de alta",
      sortingFn: "datetime",
      cell: ({ row }) => <span className="text-sm whitespace-nowrap text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Acciones">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/clients/${row.original.clientId}`}>
                <Eye className="size-4" /> Ver
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/clients/${row.original.clientId}?tab=general`}>
                <Pencil className="size-4" /> Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant={row.original.active ? "destructive" : "default"} onSelect={() => setToggle(row.original)}>
              {row.original.active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
              {row.original.active ? "Desactivar" : "Activar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const confirmToggle = async () => {
    if (!toggle) return;
    try {
      await api(`/api/clients/${toggle.clientId}`, { method: "PATCH", body: { active: !toggle.active } });
      toast.success(toggle.active ? "Cliente desactivado" : "Cliente activado");
      setToggle(null);
      router.refresh();
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        empty="No hay clientes con estos filtros"
        onRowClick={(r) => router.push(`/clients/${r.clientId}`)}
      />
      <AlertDialog open={!!toggle} onOpenChange={(o) => !o && setToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggle?.active ? "¿Seguro que quieres desactivar este cliente?" : "¿Activar este cliente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggle?.active
                ? `"${toggle?.clientName}" dejará de recibir automatizaciones. Sus datos se conservan.`
                : `"${toggle?.clientName}" volverá a recibir automatizaciones.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={toggle?.active ? buttonVariants({ variant: "destructive" }) : undefined}
              onClick={(e) => {
                e.preventDefault();
                void confirmToggle();
              }}
            >
              {toggle?.active ? "Desactivar" : "Activar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
