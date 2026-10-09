"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUrlParams } from "./url-filters";

export function PaginationBar({ page, pageCount, total, label = "registros" }: { page: number; pageCount: number; total: number; label?: string }) {
  const { set, pending } = useUrlParams();
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {total} {label}
      </span>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            Página {page} de {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page <= 1 || pending}
            onClick={() => set({ page: String(page - 1) }, false)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page >= pageCount || pending}
            onClick={() => set({ page: String(page + 1) }, false)}
            aria-label="Página siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
