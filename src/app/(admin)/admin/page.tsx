import type { Metadata } from "next";
import { AutomationAdmins } from "@/components/admin/automation-admins";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { recentActivity } from "@/lib/activity-log";
import { requireAdminPage } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  const actor = await requireAdminPage();
  const admins = await prisma.automationAdmin.findMany({ orderBy: [{ createdAt: { sort: "desc", nulls: "last" } }] });
  const activity = recentActivity(100);

  return (
    <>
      <PageHeader title="Administración" description="Usuarios, permisos y registro de acciones del panel." />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Administradores de automatizaciones</CardTitle>
            <CardDescription>
              Teléfonos (tabla automation_admins) autorizados a dar órdenes a n8n por WhatsApp. No se eliminan: se desactivan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AutomationAdmins admins={admins} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usuarios y roles del panel</CardTitle>
            <CardDescription>FASE 1: un administrador definido por variables de entorno.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{actor.name}</p>
                <p className="text-muted-foreground">{actor.email}</p>
              </div>
              <StatusBadge tone="info" label="ADMIN" />
            </div>
            <dl className="grid gap-3">
              <div>
                <dt className="font-medium">ADMIN</dt>
                <dd className="text-muted-foreground">Acceso completo a todos los clientes. Activo.</dd>
              </div>
              <div>
                <dt className="font-medium">CLIENT</dt>
                <dd className="text-muted-foreground">
                  Preparado (FASE 2): solo su client_id y perfiles GBP vinculados explícitamente. Todas las consultas ya aplican el
                  ámbito por cliente en servidor. Requiere la migración 003 (usuarios) y la 002 (vínculo GBP).
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registro de acciones</CardTitle>
          <CardDescription>
            Últimas acciones desde el arranque del servidor. También se escriben en los logs del contenedor (type: admin_activity).
            Para un histórico permanente, aplica la migración propuesta 001_admin_activity_log.sql.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {activity.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">Sin acciones registradas todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="pl-6">Fecha</TableHead>
                    <TableHead>Administrador</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="pr-6">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-6 text-sm whitespace-nowrap text-muted-foreground">{formatDateTime(a.at)}</TableCell>
                      <TableCell className="text-sm">{a.actorEmail}</TableCell>
                      <TableCell className="text-sm">{a.message ?? a.action}</TableCell>
                      <TableCell className="text-sm">{a.clientLabel ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {a.resourceType}
                        {a.resourceId ? `: ${a.resourceId}` : ""}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.ip ?? "—"}</TableCell>
                      <TableCell className="pr-6">
                        <StatusBadge status={a.result} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
