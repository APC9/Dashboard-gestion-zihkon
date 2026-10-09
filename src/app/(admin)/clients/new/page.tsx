import type { Metadata } from "next";
import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NewClientPage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader
        title="Nuevo cliente"
        description="Crea el cliente en PostgreSQL. Después podrás añadir su web y configurar Google Business."
        back={{ href: "/clients", label: "Clientes" }}
      />
      <Card className="max-w-4xl">
        <CardContent>
          <ClientForm />
        </CardContent>
      </Card>
    </>
  );
}
