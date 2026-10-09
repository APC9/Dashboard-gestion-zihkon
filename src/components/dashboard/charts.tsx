"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export interface DashboardChartsData {
  newClients: { label: string; clientes: number }[];
  content: { label: string; recibidos: number; procesados: number }[];
  reviews: { label: string; reseñas: number }[];
  automations: { label: string; ejecuciones: number; errores: number }[];
}

const monthFmt = new Intl.DateTimeFormat("es-ES", { month: "short" });
const dayFmt = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" });

const fmtMonth = (v: string) => monthFmt.format(new Date(`${v}-01T12:00:00`));
const fmtDay = (v: string) => dayFmt.format(new Date(`${v}T12:00:00`));

const clientsConfig = { clientes: { label: "Clientes nuevos", color: "var(--chart-1)" } } satisfies ChartConfig;
const contentConfig = {
  recibidos: { label: "Recibidos", color: "var(--chart-1)" },
  procesados: { label: "Procesados", color: "var(--chart-2)" },
} satisfies ChartConfig;
const reviewsConfig = { reseñas: { label: "Reseñas", color: "var(--chart-3)" } } satisfies ChartConfig;
const automationsConfig = {
  ejecuciones: { label: "Mensajes procesados", color: "var(--chart-2)" },
  errores: { label: "Errores", color: "var(--chart-4)" },
} satisfies ChartConfig;

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DashboardCharts({ data }: { data: DashboardChartsData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Automatizaciones y errores" description="Mensajes procesados por n8n y errores · últimos 14 días">
        <ChartContainer config={automationsConfig} className="h-56 w-full">
          <AreaChart data={data.automations} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickFormatter={fmtDay} minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtDay(String(v))} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area dataKey="ejecuciones" type="monotone" fill="var(--color-ejecuciones)" fillOpacity={0.2} stroke="var(--color-ejecuciones)" strokeWidth={2} />
            <Area dataKey="errores" type="monotone" fill="var(--color-errores)" fillOpacity={0.25} stroke="var(--color-errores)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Contenido" description="Contenido recibido y procesado · últimas 8 semanas">
        <ChartContainer config={contentConfig} className="h-56 w-full">
          <BarChart data={data.content} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickFormatter={fmtDay} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => `Semana del ${fmtDay(String(v))}`} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="recibidos" fill="var(--color-recibidos)" radius={4} />
            <Bar dataKey="procesados" fill="var(--color-procesados)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Reseñas recibidas" description="Reseñas de Google Business · últimas 8 semanas">
        <ChartContainer config={reviewsConfig} className="h-56 w-full">
          <BarChart data={data.reviews} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickFormatter={fmtDay} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => `Semana del ${fmtDay(String(v))}`} />} />
            <Bar dataKey="reseñas" fill="var(--color-reseñas)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Clientes nuevos" description="Altas por mes · últimos 6 meses">
        <ChartContainer config={clientsConfig} className="h-56 w-full">
          <BarChart data={data.newClients} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickFormatter={fmtMonth} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtMonth(String(v))} />} />
            <Bar dataKey="clientes" fill="var(--color-clientes)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
