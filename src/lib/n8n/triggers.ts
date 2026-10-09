import "server-only";
import { z } from "zod";
import { getRequestIp, logActivity } from "@/lib/activity-log";
import { AppError, NotFoundError, UpstreamError } from "@/lib/api/errors";
import { ValidationError } from "@/lib/api/handler";
import { assertAdmin, assertClientAccess, assertGbpAccess } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { callN8nWebhook, type N8nEnvelope } from "./client";
import { findWorkflow, WORKFLOWS, type WorkflowDefinition } from "./workflows";

/**
 * Servicios de alto nivel para lanzar workflows. Cada llamada:
 *  1. se autentica (el actor viene de la sesión del servidor),
 *  2. valida los datos con Zod,
 *  3. verifica que el recurso existe y que el actor tiene permiso,
 *  4. envía client_id + id del recurso a n8n,
 *  5. registra la acción,
 *  6. devuelve el resultado,
 *  7. normaliza los errores.
 * Los IDs del navegador nunca se usan sin comprobarlos en la base de datos.
 */

export interface TriggerResult {
  ok: boolean;
  workflowId: string;
  requestId: string;
  status: number;
  durationMs: number;
  message: string;
  response: unknown;
}

interface ResolvedTarget {
  clientSystem: N8nEnvelope["client_system"];
  clientId: string | number | null;
  clientLabel: string | null;
  resourceType: string;
  resourceId: string | number | null;
  context: Record<string, unknown>;
}

const uuid = z.string().uuid("ID no válido");
const intId = z.coerce.number().int().positive("ID no válido");

async function resolveTarget(actor: Actor, workflow: WorkflowDefinition, resourceId: unknown): Promise<ResolvedTarget> {
  switch (workflow.resource) {
    case "client": {
      const id = uuid.parse(resourceId);
      const client = await prisma.client.findUnique({ where: { clientId: id } });
      if (!client) throw new NotFoundError("Cliente no encontrado");
      assertClientAccess(actor, client.clientId);
      return {
        clientSystem: "clients",
        clientId: client.clientId,
        clientLabel: client.clientName,
        resourceType: "client",
        resourceId: client.clientId,
        context: { client_name: client.clientName, whatsapp_e164: client.whatsappE164, drive_folder_id: client.driveFolderId },
      };
    }
    case "website": {
      const id = uuid.parse(resourceId);
      const site = await prisma.clientWebsite.findUnique({ where: { websiteId: id }, include: { client: true } });
      if (!site) throw new NotFoundError("Web no encontrada");
      assertClientAccess(actor, site.clientId);
      return {
        clientSystem: "clients",
        clientId: site.clientId,
        clientLabel: site.client?.clientName ?? null,
        resourceType: "website",
        resourceId: site.websiteId,
        context: {
          github_owner: site.githubOwner,
          github_repository: site.githubRepository,
          default_branch: site.defaultBranch,
          netlify_site_id: site.netlifySiteId,
          website_url: site.websiteUrl,
        },
      };
    }
    case "content": {
      const id = uuid.parse(resourceId);
      const intake = await prisma.contentIntake.findUnique({ where: { intakeId: id }, include: { client: true } });
      if (!intake) throw new NotFoundError("Contenido no encontrado");
      assertClientAccess(actor, intake.clientId);
      return {
        clientSystem: "clients",
        clientId: intake.clientId,
        clientLabel: intake.client?.clientName ?? null,
        resourceType: "content_intake",
        resourceId: intake.intakeId,
        context: { description: intake.description, status: intake.status },
      };
    }
    case "review": {
      const id = intId.parse(resourceId);
      const review = await prisma.gbpReviewActivity.findUnique({ where: { id }, include: { gbpClient: true } });
      if (!review) throw new NotFoundError("Reseña no encontrada");
      assertGbpAccess(actor, review.clientId);
      return {
        clientSystem: "gbp_clients",
        clientId: review.clientId,
        clientLabel: review.gbpClient?.businessName ?? null,
        resourceType: "gbp_review",
        resourceId: review.id,
        context: {
          review_id: review.reviewId,
          location_id: review.gbpClient?.locationId,
          account_id: review.gbpClient?.accountId,
        },
      };
    }
    case "gbp_profile": {
      const id = intId.parse(resourceId);
      const profile = await prisma.gbpClient.findUnique({ where: { id } });
      if (!profile) throw new NotFoundError("Perfil de Google Business no encontrado");
      assertGbpAccess(actor, profile.id);
      return {
        clientSystem: "gbp_clients",
        clientId: profile.id,
        clientLabel: profile.businessName,
        resourceType: "gbp_profile",
        resourceId: profile.id,
        context: { location_id: profile.locationId, account_id: profile.accountId },
      };
    }
    case "audit": {
      assertAdmin(actor);
      const id = z.coerce.bigint().parse(resourceId);
      const audit = await prisma.auditoriaLocal.findUnique({ where: { id } });
      if (!audit) throw new NotFoundError("Auditoría no encontrada");
      return {
        clientSystem: null,
        clientId: null,
        clientLabel: audit.nombreNegocio,
        resourceType: "audit",
        resourceId: audit.id.toString(),
        context: {},
      };
    }
    case "none":
      assertAdmin(actor);
      return { clientSystem: null, clientId: null, clientLabel: null, resourceType: "global", resourceId: null, context: {} };
  }
}

export async function triggerWorkflow(
  actor: Actor,
  workflowId: string,
  input: { resourceId?: unknown; data?: unknown },
  req?: Request,
): Promise<TriggerResult> {
  const workflow = findWorkflow(workflowId);
  if (!workflow) throw new NotFoundError("Workflow no encontrado");

  const parsedData = (workflow.data as z.ZodType<Record<string, unknown>>).safeParse(input.data ?? {});
  if (!parsedData.success) {
    throw new ValidationError(z.flattenError(parsedData.error).fieldErrors as Record<string, string[]>);
  }

  let target: ResolvedTarget;
  try {
    target = await resolveTarget(actor, workflow, input.resourceId);
  } catch (error) {
    if (error instanceof z.ZodError) throw new ValidationError({ resourceId: ["ID de recurso no válido"] });
    throw error;
  }

  const base = {
    action: `n8n:${workflow.id}`,
    clientId: target.clientId != null ? String(target.clientId) : null,
    clientLabel: target.clientLabel,
    resourceType: target.resourceType,
    resourceId: target.resourceId != null ? String(target.resourceId) : null,
    ip: req ? getRequestIp(req) : null,
  };

  try {
    const result = await callN8nWebhook(workflow, {
      event: workflow.id,
      requested_by: { id: actor.id, email: actor.email, role: actor.role },
      client_system: target.clientSystem,
      client_id: target.clientId,
      resource: { type: target.resourceType, id: target.resourceId },
      data: { ...target.context, ...(parsedData.data as Record<string, unknown>) },
    });

    const message = result.ok
      ? `${workflow.name}: solicitud enviada a n8n`
      : `${workflow.name}: n8n respondió con estado ${result.status}`;
    await logActivity(actor, { ...base, result: result.ok ? "SUCCESS" : "ERROR", message, durationMs: result.durationMs });

    return {
      ok: result.ok,
      workflowId: workflow.id,
      requestId: result.requestId,
      status: result.status,
      durationMs: result.durationMs,
      message,
      response: result.data,
    };
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Error desconocido al llamar a n8n";
    await logActivity(actor, { ...base, result: "ERROR", message });
    if (error instanceof AppError) throw error;
    throw new UpstreamError(message);
  }
}

// ---------------------------------------------------------------------------
// Atajos tipados usados por las rutas de la API.
// ---------------------------------------------------------------------------

export const triggerContentGeneration = (
  actor: Actor,
  intakeId: string,
  data: z.input<typeof WORKFLOWS.contentGeneration.data>,
  req?: Request,
) => triggerWorkflow(actor, WORKFLOWS.contentGeneration.id, { resourceId: intakeId, data }, req);

export const triggerWebsiteChange = (actor: Actor, websiteId: string, instructions: string, req?: Request) =>
  triggerWorkflow(actor, WORKFLOWS.websiteChange.id, { resourceId: websiteId, data: { instructions } }, req);

export const triggerWebsitePreview = (actor: Actor, websiteId: string, req?: Request) =>
  triggerWorkflow(actor, WORKFLOWS.websitePreview.id, { resourceId: websiteId }, req);

export const triggerWebsitePublish = (actor: Actor, websiteId: string, req?: Request) =>
  triggerWorkflow(actor, WORKFLOWS.websitePublish.id, { resourceId: websiteId }, req);

export const triggerGbpReviewApproval = (
  actor: Actor,
  reviewDbId: number,
  scheduledPublishDate: string | null,
  req?: Request,
) =>
  triggerWorkflow(
    actor,
    WORKFLOWS.gbpReviewApproval.id,
    { resourceId: reviewDbId, data: { scheduled_publish_date: scheduledPublishDate } },
    req,
  );

export const triggerGbpReviewPublication = (actor: Actor, reviewDbId: number, req?: Request) =>
  triggerWorkflow(actor, WORKFLOWS.gbpReviewPublication.id, { resourceId: reviewDbId }, req);

export const triggerGbpReviewRegeneration = (actor: Actor, reviewDbId: number, instructions?: string, req?: Request) =>
  triggerWorkflow(actor, WORKFLOWS.gbpReviewRegenerate.id, { resourceId: reviewDbId, data: { instructions } }, req);

export const triggerAuditGeneration = (
  actor: Actor,
  data: z.input<typeof WORKFLOWS.auditGeneration.data>,
  req?: Request,
) => triggerWorkflow(actor, WORKFLOWS.auditGeneration.id, { data }, req);
