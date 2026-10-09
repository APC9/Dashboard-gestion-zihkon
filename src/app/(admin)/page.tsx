import { AlertTriangle, Building2, ClipboardCheck, Globe, Images, MessageSquareText, Star, Users } from "lucide-react";
import type { Metadata } from "next";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardCharts } from "@/components/dashboard/charts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth/session";
import { getDashboardCharts, getDashboardStats, getRecentActivity } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const actor = await requireAdminPage();
  const [stats, charts, activity] = await Promise.all([
    getDashboardStats(actor),
    getDashboardCharts(actor),
    getRecentActivity(actor, 15),
  ]);

  return (
    <>
      <PageHeader title={`Hola, ${actor.name.split(" ")[0]}`} description="Resumen de clientes, servicios y automatizaciones de Zihkon." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clientes activos" value={stats.activeClients} hint={`${stats.totalClients} clientes totales`} icon={Building2} href="/clients?status=active" tone="success" />
        <StatCard label="Clientes totales" value={stats.totalClients} icon={Users} href="/clients" />
        <StatCard label="Webs activas" value={stats.activeWebsites} icon={Globe} href="/websites" />
        <StatCard label="Perfiles GBP activos" value={stats.activeGbp} icon={Star} href="/gbp/profiles" />
        <StatCard
          label="Reseñas pendientes"
          value={stats.pendingReviews}
          hint="Nuevas, borradores y pendientes de aprobación"
          icon={MessageSquareText}
          href="/gbp/reviews?status=pending"
          tone={stats.pendingReviews ? "warning" : "default"}
        />
        <StatCard
          label="Contenidos pendientes"
          value={stats.pendingContent}
          icon={Images}
          href="/content?status=pending"
          tone={stats.pendingContent ? "warning" : "default"}
        />
        <StatCard label="Auditorías recientes" value={stats.recentAudits} hint="Últimos 30 días" icon={ClipboardCheck} href="/audits" />
        <StatCard
          label="Errores de automatización"
          value={stats.automationErrors}
          hint="Últimos 7 días"
          icon={AlertTriangle}
          href="/automations"
          tone={stats.automationErrors ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <DashboardCharts data={charts} />
        <Card className="gap-2 self-start">
          <CardHeader>
            <CardTitle className="text-base">Actividad reciente</CardTitle>
            <CardDescription>Reseñas, contenido, auditorías y errores</CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            <ActivityFeed items={activity} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
