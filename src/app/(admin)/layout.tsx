import { cookies } from "next/headers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAdminPage } from "@/lib/auth/session";
import { getNotifications } from "@/lib/data/dashboard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAdminPage();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const notifications = await getNotifications(actor).catch(() => ({
    pendingReviews: 0,
    errors24h: 0,
    readyContent: 0,
  }));

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar badges={{ "/gbp": notifications.pendingReviews || undefined }} />
      <SidebarInset className="min-w-0">
        <SiteHeader user={{ name: actor.name, email: actor.email, role: actor.role }} notifications={notifications} />
        <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
