/**
 * Modelo de identidad del panel.
 *
 * - ADMIN: personal de Zihkon. Acceso a todos los clientes.
 * - CLIENT: (FASE 2) un cliente final. Solo verá SU client_id y los perfiles
 *   GBP explícitamente vinculados. Aún no se emiten sesiones CLIENT.
 */
export const ROLES = ["ADMIN", "CLIENT"] as const;
export type Role = (typeof ROLES)[number];

export interface Actor {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Solo para CLIENT: client_id (UUID) de clients al que pertenece. */
  clientId: string | null;
  /** Solo para CLIENT: ids de gbp_clients vinculados explícitamente. */
  gbpClientIds: number[];
}
