import type { Metadata } from "next";
import { GbpProfileForm } from "@/components/gbp/gbp-profile-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nuevo perfil de Google Business" };

export default async function NewGbpProfilePage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader
        title="Nuevo perfil de Google Business"
        description="Registra un perfil en gbp_clients para que n8n gestione sus reseñas. Usa el mismo WhatsApp que el cliente para vincularlo automáticamente."
        back={{ href: "/gbp/profiles", label: "Perfiles" }}
      />
      <Card className="max-w-4xl">
        <CardContent>
          <GbpProfileForm />
        </CardContent>
      </Card>
    </>
  );
}
