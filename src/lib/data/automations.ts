import "server-only";
import { AppError, NotFoundError } from "@/lib/api/errors";
import { assertAdmin } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { getClient } from "./clients";

/** Automatizaciones que no pueden estar activas a la vez (el pack de Google va incluido en el multicanal). */
export const EXCLUSIVE_AUTOMATIONS = ["publicaciones", "publicaciones_gbp"] as const;

function assertNotBothPublications(enabled: (key: string) => boolean) {
  if (EXCLUSIVE_AUTOMATIONS.every(enabled)) {
    throw new AppError(
      "«Publicaciones multicanal» y «Publicaciones en Google (GBP)» no pueden estar activas a la vez: activa solo una.",
      400,
      "AUTOMATIONS_EXCLUSIVE",
    );
  }
}

/** Automatización del catálogo con su estado para un cliente. */
export interface ClientAutomationRow {
  automationKey: string;
  name: string;
  description: string | null;
  enabled: boolean;
  updatedAt: Date | null;
  /** Está en prueba gratuita (aún no ha terminado). */
  inTrial: boolean;
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
    inTrial: a.clients[0]?.trialStartedAt != null && a.clients[0]?.trialFinishedAt == null,
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
  assertNotBothPublications((k) => desired[k] ?? current.find((a) => a.automationKey === k)?.enabled === true);

  const changed = current.filter((a) => a.automationKey in desired && desired[a.automationKey] !== a.enabled);
  const activated = changed.filter((a) => desired[a.automationKey]).map((a) => a.automationKey);
  const deactivated = changed.filter((a) => !desired[a.automationKey]).map((a) => a.automationKey);

  await prisma.$transaction(
    changed.map((a) =>
      prisma.clientAutomation.upsert({
        where: { clientId_automationKey: { clientId, automationKey: a.automationKey } },
        create: { clientId, automationKey: a.automationKey, enabled: desired[a.automationKey] },
        // Si se apaga a mano durante la prueba, la prueba termina (no se puede repetir).
        update: { enabled: desired[a.automationKey], ...(a.inTrial && !desired[a.automationKey] ? { trialFinishedAt: new Date() } : {}) },
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
  if (enabled && EXCLUSIVE_AUTOMATIONS.some((k) => k === automationKey)) {
    const current = await listClientAutomations(actor, clientId);
    assertNotBothPublications((k) => (k === automationKey ? true : current.find((a) => a.automationKey === k)?.enabled === true));
  }
  await prisma.clientAutomation.upsert({
    where: { clientId_automationKey: { clientId, automationKey } },
    create: { clientId, automationKey, enabled },
    update: { enabled },
  });
  return { client, automation };
}

// ---------------------------------------------------------------------------
// Prueba gratuita de publicaciones (7 días, máximo 4 publicaciones, una por cliente).
// El recordatorio y el fin de la prueba los gestiona n8n («Zihkon · Pruebas gratuitas»).
// ---------------------------------------------------------------------------

export const TRIAL_DAYS = 7;
export const TRIAL_POSTS_LIMIT = 4;
export type TrialAutomationKey = (typeof EXCLUSIVE_AUTOMATIONS)[number];

export interface ClientTrial {
  automationKey: string;
  name: string;
  startedAt: Date;
  endsAt: Date;
  postsLimit: number;
  postsUsed: number;
  reminderSentAt: Date | null;
  finishedAt: Date | null;
  /** En curso: no ha terminado (aunque ya haya vencido, hasta que n8n la cierre). */
  active: boolean;
  /** Días que faltan (redondeado hacia arriba); 0 si ya ha vencido. */
  daysLeft: number;
}

/** La prueba del cliente (en curso o ya terminada), o null si nunca ha tenido. */
export async function getClientTrial(actor: Actor, clientId: string): Promise<ClientTrial | null> {
  await getClient(actor, clientId);
  const row = await prisma.clientAutomation.findFirst({
    where: { clientId, trialStartedAt: { not: null } },
    include: { automation: { select: { name: true } } },
  });
  if (!row?.trialStartedAt || !row.trialEndsAt) return null;
  const msLeft = row.trialEndsAt.getTime() - Date.now();
  return {
    automationKey: row.automationKey,
    name: row.automation.name,
    startedAt: row.trialStartedAt,
    endsAt: row.trialEndsAt,
    postsLimit: row.trialPostsLimit,
    postsUsed: row.trialPostsUsed,
    reminderSentAt: row.trialReminderSentAt,
    finishedAt: row.trialFinishedAt,
    active: row.trialFinishedAt == null,
    daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
  };
}

/** Activa la prueba gratuita de 7 días (solo administradores, una vez por cliente). */
export async function startClientTrial(actor: Actor, clientId: string, automationKey: TrialAutomationKey) {
  assertAdmin(actor);
  const client = await getClient(actor, clientId);
  const automation = await prisma.automationCatalog.findUnique({ where: { automationKey } });
  if (!automation || !automation.active) throw new NotFoundError("Automatización no encontrada");
  if (await prisma.clientAutomation.findFirst({ where: { clientId, trialStartedAt: { not: null } } })) {
    throw new AppError("Este cliente ya ha tenido su prueba gratuita: solo se puede activar una vez.", 409, "TRIAL_ALREADY_USED");
  }
  const enabledPublications = await prisma.clientAutomation.count({
    where: { clientId, enabled: true, automationKey: { in: [...EXCLUSIVE_AUTOMATIONS] } },
  });
  if (enabledPublications) {
    throw new AppError("El cliente ya tiene activas las publicaciones: no necesita prueba.", 400, "TRIAL_NOT_NEEDED");
  }

  const startedAt = new Date();
  const trial = {
    enabled: true,
    trialStartedAt: startedAt,
    trialEndsAt: new Date(startedAt.getTime() + TRIAL_DAYS * 86_400_000),
    trialPostsLimit: TRIAL_POSTS_LIMIT,
    trialPostsUsed: 0,
    trialReminderSentAt: null,
    trialFinishedAt: null,
  };
  try {
    await prisma.clientAutomation.upsert({
      where: { clientId_automationKey: { clientId, automationKey } },
      create: { clientId, automationKey, ...trial },
      update: trial,
    });
  } catch (error) {
    // Índice único «una prueba por cliente»: dos clics a la vez.
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError("Este cliente ya ha tenido su prueba gratuita: solo se puede activar una vez.", 409, "TRIAL_ALREADY_USED");
    }
    throw error;
  }
  return { client, automation };
}

/** El cliente contrata durante la prueba: la automatización sigue activa y deja de contar como prueba. */
export async function convertClientTrial(actor: Actor, clientId: string) {
  assertAdmin(actor);
  const client = await getClient(actor, clientId);
  const { count } = await prisma.clientAutomation.updateMany({
    where: { clientId, trialStartedAt: { not: null }, trialFinishedAt: null },
    data: { trialFinishedAt: new Date() },
  });
  if (!count) throw new AppError("El cliente no tiene ninguna prueba en curso.", 400, "TRIAL_NOT_ACTIVE");
  return { client };
}
