"use client";

import { Input } from "@/components/ui/input";
import { useUrlParams } from "./url-filters";

export function DateRangeFilter({ fromParam = "from", toParam = "to" }: { fromParam?: string; toParam?: string }) {
  const { params, set } = useUrlParams();
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        aria-label="Desde"
        className="w-full sm:w-40"
        value={params.get(fromParam) ?? ""}
        onChange={(e) => set({ [fromParam]: e.target.value || null })}
      />
      <span className="text-sm text-muted-foreground">—</span>
      <Input
        type="date"
        aria-label="Hasta"
        className="w-full sm:w-40"
        value={params.get(toParam) ?? ""}
        onChange={(e) => set({ [toParam]: e.target.value || null })}
      />
    </div>
  );
}
