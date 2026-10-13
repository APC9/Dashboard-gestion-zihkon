import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pago recibido" };

export default function PagoGraciasPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">¡Gracias!</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Hemos recibido tu pago. En cuanto se confirme te escribiremos por WhatsApp con tus servicios activados y cómo usarlos.
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Si has pagado con domiciliación bancaria (SEPA), la confirmación puede tardar unos días hábiles.
      </p>
    </>
  );
}
