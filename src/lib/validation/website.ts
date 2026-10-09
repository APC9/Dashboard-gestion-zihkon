import { z } from "zod";
import { optionalPattern, optionalText, optionalUrl } from "./common";

export const websiteFormSchema = z.object({
  githubOwner: optionalPattern(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/, "Usuario u organización de GitHub no válido", 39),
  githubRepository: optionalPattern(/^[A-Za-z0-9._-]{1,100}$/, "Nombre de repositorio no válido", 100),
  defaultBranch: optionalPattern(/^[A-Za-z0-9._\/-]{1,100}$/, "Nombre de rama no válido", 100),
  netlifySiteId: optionalText(100),
  websiteUrl: optionalUrl,
  previewModeEnabled: z.boolean(),
  active: z.boolean(),
});
export type WebsiteFormValues = z.input<typeof websiteFormSchema>;

/** PATCH /api/clients/[id]/website: si websiteId falta se crea una web nueva para el cliente. */
export const websiteUpsertSchema = websiteFormSchema.extend({
  websiteId: z.string().uuid().optional(),
});

export const websiteActionSchema = z.object({
  websiteId: z.string().uuid(),
  action: z.enum(["change", "preview", "publish"]),
  instructions: z.string().trim().max(4000).optional(),
});
