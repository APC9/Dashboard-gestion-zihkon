"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import { RatingStars } from "@/components/shared/rating-stars";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { ratingToNumber } from "@/lib/status";

export interface ReviewRow {
  id: number;
  reviewId: string | null;
  reviewerName: string | null;
  rating: string | null;
  reviewText: string | null;
  generatedResponse: string | null;
  status: string | null;
  reviewDate: Date | string | null;
  createdDate: Date | string | null;
  approvalSentAt?: Date | string | null;
  reminderCount?: number;
  gbpClient: { id: string; client: { clientId: string; clientName: string | null } } | null;
}

/** «Pendiente desde el dd/mm/aaaa · N recordatorios» para las que esperan la decisión del cliente. */
function PendingInfo({ row }: { row: ReviewRow }) {
  if (row.status !== "PENDING_APPROVAL" || !row.approvalSentAt) return null;
  const n = row.reminderCount ?? 0;
  return (
    <span className="text-xs whitespace-nowrap text-muted-foreground">
      desde el {formatDate(row.approvalSentAt)} · {n} recordatorio{n === 1 ? "" : "s"}
    </span>
  );
}

export function ReviewsTable({ rows }: { rows: ReviewRow[] }) {
  const router = useRouter();
  const columns: ColumnDef<ReviewRow>[] = [
    {
      id: "client",
      header: "Cliente",
      accessorFn: (r) => r.gbpClient?.client.clientName ?? "",
      cell: ({ row }) =>
        row.original.gbpClient ? (
          <Link href={`/clients/${row.original.gbpClient.client.clientId}?tab=gbp`} className="text-sm font-medium hover:underline">
            {row.original.gbpClient.client.clientName ?? "Sin nombre"}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "reviewerName",
      header: "Autor",
      cell: ({ row }) => <span className="text-sm">{row.original.reviewerName ?? "Anónimo"}</span>,
    },
    {
      id: "rating",
      header: "Rating",
      accessorFn: (r) => ratingToNumber(r.rating) ?? 0,
      cell: ({ row }) => <RatingStars rating={row.original.rating} />,
    },
    {
      accessorKey: "reviewText",
      header: "Texto",
      enableSorting: false,
      cell: ({ row }) => (
        <p className="line-clamp-2 max-w-72 text-sm text-muted-foreground">{row.original.reviewText || <em>Sin texto</em>}</p>
      ),
    },
    {
      accessorKey: "generatedResponse",
      header: "Respuesta generada",
      enableSorting: false,
      cell: ({ row }) => (
        <p className="line-clamp-2 max-w-72 text-sm">{row.original.generatedResponse || <em className="text-muted-foreground">Pendiente</em>}</p>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={row.original.status} />
          <PendingInfo row={row.original} />
        </div>
      ),
    },
    {
      id: "date",
      header: "Fecha",
      accessorFn: (r) => new Date((r.reviewDate ?? r.createdDate ?? 0) as string).getTime(),
      cell: ({ row }) => <span className="text-sm whitespace-nowrap text-muted-foreground">{formatDate(row.original.reviewDate ?? row.original.createdDate)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <Button asChild size="sm" variant="outline">
          <Link href={`/gbp/reviews/${row.original.id}`}>Revisar</Link>
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      empty="No hay reseñas con estos filtros"
      onRowClick={(r) => router.push(`/gbp/reviews/${r.id}`)}
    />
  );
}
