import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/lib/api/errors";
import { authOptions } from "./options";
import type { Actor } from "./types";

/** Devuelve el actor autenticado o null. Única fuente de identidad en servidor. */
export async function getActor(): Promise<Actor | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.user.role) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? session.user.email,
    role: session.user.role,
    clientId: session.user.clientId ?? null,
    gbpClientIds: session.user.gbpClientIds ?? [],
  };
}

/** Para Route Handlers: lanza 401/403. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new UnauthorizedError();
  return actor;
}

export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor();
  if (actor.role !== "ADMIN") throw new ForbiddenError();
  return actor;
}

/** Para páginas del panel: redirige al login o fuera del panel. */
export async function requireAdminPage(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.role !== "ADMIN") redirect("/login?error=forbidden");
  return actor;
}
