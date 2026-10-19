import "server-only";
import { AppError, NotFoundError } from "@/lib/api/errors";
import { assertAdmin } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { getClient } from "./clients";

/**
 * Programa de referidos. Cada cliente tiene un código único (lo genera la BD).
 * Cuando un cliente nuevo se da de alta con ese código y paga su 2.º mes, el dueño del código gana
 * 1 mes gratis del plan que esté usando. Zihkon marca el 2.º pago y la aplicación del mes gratis en el panel.
 */
export const REFERRAL_STATUSES = ["PENDING", "EARNED", "APPLIED", "CANCELLED"] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
export const REFERRAL_ACTIONS = ["second_payment", "applied", "cancel"] as const;
export type ReferralAction = (typeof REFERRAL_ACTIONS)[number];

export interface ReferralRow {
  referralId: string;
  referredClientId: string;
  referredName: string | null;
  status: ReferralStatus;
  rewardMonths: number;
  rewardPlan: string[];
  createdAt: Date;
  secondPaymentAt: Date | null;
  appliedAt: Date | null;
}

export interface ClientReferralInfo {
  referralCode: string;
  referredBy: { clientId: string; clientName: string | null; status: ReferralStatus } | null;
  referrals: ReferralRow[];
  /** Meses gratis ganados y aún sin aplicar. */
  pendingFreeMonths: number;
}

export async function getClientReferrals(actor: Actor, clientId: string): Promise<ClientReferralInfo> {
  const client = await getClient(actor, clientId);
  const [made, received] = await Promise.all([
    prisma.clientReferral.findMany({
      where: { referrerClientId: clientId },
      include: { referred: { select: { clientName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientReferral.findUnique({ where: { referredClientId: clientId }, include: { referrer: { select: { clientName: true } } } }),
  ]);
  return {
    referralCode: client.referralCode,
    referredBy: received
      ? { clientId: received.referrerClientId, clientName: received.referrer.clientName, status: received.status as ReferralStatus }
      : null,
    referrals: made.map((r) => ({
      referralId: r.referralId.toString(),
      referredClientId: r.referredClientId,
      referredName: r.referred.clientName,
      status: r.status as ReferralStatus,
      rewardMonths: r.rewardMonths,
      rewardPlan: r.rewardPlan,
      createdAt: r.createdAt,
      secondPaymentAt: r.secondPaymentAt,
      appliedAt: r.appliedAt,
    })),
    pendingFreeMonths: made.filter((r) => r.status === "EARNED").reduce((a, r) => a + r.rewardMonths, 0),
  };
}

/** Plan actual del dueño del código (automatizaciones activas), para saber de qué es el mes gratis. */
async function currentPlan(clientId: string) {
  const rows = await prisma.clientAutomation.findMany({ where: { clientId, enabled: true }, select: { automationKey: true }, orderBy: { automationKey: "asc" } });
  return rows.map((r) => r.automationKey);
}

const TRANSITIONS: Record<ReferralAction, { from: ReferralStatus[]; to: ReferralStatus; error: string }> = {
  second_payment: { from: ["PENDING"], to: "EARNED", error: "Solo se puede marcar el 2.º pago de un referido pendiente." },
  applied: { from: ["EARNED"], to: "APPLIED", error: "Solo se puede aplicar un mes gratis ya ganado." },
  cancel: { from: ["PENDING", "EARNED"], to: "CANCELLED", error: "Este referido ya está aplicado o cancelado." },
};

/** Avanza un referido del cliente (dueño del código). Solo administradores. Seguro ante dos clics a la vez. */
export async function updateReferral(actor: Actor, clientId: string, referralId: bigint, action: ReferralAction) {
  assertAdmin(actor);
  const referral = await prisma.clientReferral.findFirst({ where: { referralId, referrerClientId: clientId } });
  if (!referral) throw new NotFoundError("Referido no encontrado");
  const t = TRANSITIONS[action];
  const now = new Date();
  const data =
    action === "second_payment"
      ? { status: t.to, secondPaymentAt: now, rewardPlan: await currentPlan(clientId) }
      : action === "applied"
        ? { status: t.to, appliedAt: now }
        : { status: t.to };
  // Escritura condicional: si otro clic ya cambió el estado, no se aplica dos veces.
  const { count } = await prisma.clientReferral.updateMany({ where: { referralId, status: { in: t.from } }, data });
  if (!count) throw new AppError(t.error, 409, "REFERRAL_INVALID_STATE");
  return prisma.clientReferral.findUniqueOrThrow({ where: { referralId }, include: { referred: { select: { clientName: true } } } });
}
