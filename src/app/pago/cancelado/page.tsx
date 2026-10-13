import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pago no completado" };

export default function PagoCanceladoPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">No se ha completado el pago</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        No te hemos cobrado nada. Puedes volver a abrir el enlace de pago que te enviamos o escribirnos por WhatsApp si necesitas ayuda.
      </p>
    </>
  );
}
