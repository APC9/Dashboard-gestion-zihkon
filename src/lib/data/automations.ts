import "server-only";
import { NotFoundError } from "@/lib/api/errors";
import { assertAdmin } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { getClient } from "./clients";

/** Automatización del catálogo con su estado para un cliente. */
export interface ClientAutomationRow {
  automationKey: string;
  name: string;
  description: string | null;
  enabled: boolean;
  updatedAt: Date | null;
}

/** Catálogo de automatizaciones (activas) con las que tiene habilitadas el cliente. */
export async function listClientAutomations(actor: Actor, clientId: string): Promise<ClientAutomationRow[]> {
  await getClient(actor, clientId);
  const catalog = await prisma.automationCatalog.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { clients: { where: { clientId } } },
  });
  return catalog.map((a) => ({
    automationKey: a.automationKey,
    name: a.name,
    description: a.description,
    enabled: a.clients[0]?.enabled === true,
    updatedAt: a.clients[0]?.updatedAt ?? null,
  }));
}

/**
 * Guarda de una vez qué automatizaciones tiene el cliente (solo administradores).
 * Devuelve las claves que se han activado y las que se han desactivado respecto a lo que había.
 */
export async function saveClientAutomations(actor: Actor, clientId: string, desired: Record<string, boolean>) {
  assertAdmin(actor);
  const client = await getClient(actor, clientId);
  const current = await listClientAutomations(actor, clientId);
  const unknown = Object.keys(desired).filter((k) => !current.some((a) => a.automationKey === k));
  if (unknown.length) throw new NotFoundError(`Automatización no encontrada: ${unknown.join(", ")}`);

  const changed = current.filter((a) => a.automationKey in desired && desired[a.automationKey] !== a.enabled);
  const activated = changed.filter((a) => desired[a.automationKey]).map((a) => a.automationKey);
  const deactivated = changed.filter((a) => !desired[a.automationKey]).map((a) => a.automationKey);

  await prisma.$transaction(
    changed.map((a) =>
      prisma.clientAutomation.upsert({
        where: { clientId_automationKey: { clientId, automationKey: a.automationKey } },
        create: { clientId, automationKey: a.automationKey, enabled: desired[a.automationKey] },
        update: { enabled: desired[a.automationKey] },
      }),
    ),
  );
  const names = (keys: string[]) => keys.map((k) => current.find((a) => a.automationKey === k)!.name);
  return { client, activated, deactivated, activatedNames: names(activated), deactivatedNames: names(deactivated) };
}

/** Habilita o deshabilita una automatización para un cliente (solo administradores). */
export async function setClientAutomation(actor: Actor, clientId: string, automationKey: string, enabled: boolean) {
  assertAdmin(actor);
  const client = await getClient(actor, clientId);
  const automation = await prisma.automationCatalog.findUnique({ where: { automationKey } });
  if (!automation || !automation.active) throw new NotFoundError("Automatización no encontrada");
  await prisma.clientAutomation.upsert({
    where: { clientId_automationKey: { clientId, automationKey } },
    create: { clientId, automationKey, enabled },
    update: { enabled },
  });
  return { client, automation };
}
