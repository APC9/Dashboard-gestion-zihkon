/** Páginas públicas a las que vuelve el cliente desde Stripe Checkout (sin sesión del panel). */
export default function PagoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">Z</div>
        {children}
      </div>
    </div>
  );
}
