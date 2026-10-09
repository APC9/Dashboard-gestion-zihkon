import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold">No encontrado</h1>
      <p className="max-w-sm text-sm text-muted-foreground">El recurso no existe o no tienes acceso a él.</p>
      <Button asChild>
        <Link href="/">Volver al dashboard</Link>
      </Button>
    </div>
  );
}
