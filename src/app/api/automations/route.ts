import { route } from "@/lib/api/handler";
import { requireAdmin } from "@/lib/auth/session";
import { isN8nApiConfigured, listN8nExecutions } from "@/lib/n8n/api";
import { isN8nConfigured } from "@/lib/n8n/client";
import { publicWorkflowList } from "@/lib/n8n/workflows";

export const GET = route(async () => {
  await requireAdmin();
  let executions: Awaited<ReturnType<typeof listN8nExecutions>> = [];
  let executionsError: string | null = null;
  if (isN8nApiConfigured()) {
    try {
      executions = await listN8nExecutions(50);
    } catch (e) {
      executionsError = e instanceof Error ? e.message : "No se pudo leer n8n";
    }
  }
  return {
    webhooksConfigured: isN8nConfigured(),
    apiConfigured: isN8nApiConfigured(),
    workflows: publicWorkflowList(),
    executions,
    executionsError,
  };
});
