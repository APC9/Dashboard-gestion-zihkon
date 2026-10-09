"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { isActivePath, NAV_MAIN, NAV_SECONDARY, type NavItem } from "./nav";

interface Props {
  badges?: Partial<Record<string, number>>;
}

export function AppSidebar({ badges = {} }: Props) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => {
    if (isMobile) setOpenMobile(false);
  };

  const renderItem = (item: NavItem) => {
    const active = isActivePath(pathname, item.href);
    const badge = badges[item.href];
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={active && !item.children} tooltip={item.title}>
          <Link href={item.children ? item.children[0].href : item.href} onClick={close}>
            <item.icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
        {badge ? <SidebarMenuBadge className="bg-primary/10 text-primary">{badge}</SidebarMenuBadge> : null}
        {item.children && active ? (
          <SidebarMenuSub>
            {item.children.map((child) => (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton asChild isActive={isActivePath(pathname, child.href)}>
                  <Link href={child.href} onClick={close}>
                    {child.title}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        ) : null}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" onClick={close}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">
                  Z
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Zihkon Admin</span>
                  <span className="truncate text-xs text-muted-foreground">Panel de gestión</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{NAV_MAIN.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>{NAV_SECONDARY.map(renderItem)}</SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
