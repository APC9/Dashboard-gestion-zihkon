"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No se pudo cargar esta sección</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Puede ser un problema temporal de conexión con PostgreSQL. Si persiste, revisa la página de Configuración.
        </p>
        {error.digest ? <p className="font-mono text-xs text-muted-foreground">Ref: {error.digest}</p> : null}
      </div>
      <Button onClick={reset}>
        <RotateCcw className="size-4" /> Reintentar
      </Button>
    </div>
  );
}
