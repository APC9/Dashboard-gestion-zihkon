"use client";

import { AlertTriangle, Bell, Images, LogOut, Moon, Star, Sun, User } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalSearch } from "./global-search";

interface Props {
  user: { name: string; email: string; role: string };
  notifications: { pendingReviews: number; errors24h: number; readyContent: number };
}

export function SiteHeader({ user, notifications }: Props) {
  const total = notifications.pendingReviews + notifications.errors24h + notifications.readyContent;
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:rounded-t-xl md:px-4">
      <SidebarTrigger className="-ml-1" aria-label="Abrir menú" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <div className="min-w-0 flex-1">
        <GlobalSearch />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
            <Bell className="size-5" />
            {total > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                {total > 99 ? "99+" : total}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="border-b px-4 py-3 text-sm font-medium">Notificaciones</div>
          <div className="flex flex-col p-1">
            <NotificationLink
              href="/gbp/reviews?status=pending"
              icon={<Star className="size-4 text-amber-500" />}
              label="Reseñas pendientes de revisar"
              count={notifications.pendingReviews}
            />
            <NotificationLink
              href="/content?status=ready"
              icon={<Images className="size-4 text-sky-500" />}
              label="Contenidos listos"
              count={notifications.readyContent}
            />
            <NotificationLink
              href="/automations"
              icon={<AlertTriangle className="size-4 text-destructive" />}
              label="Errores de automatización (24 h)"
              count={notifications.errors24h}
            />
            {total === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">Todo al día ✨</p> : null}
          </div>
        </PopoverContent>
      </Popover>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Menú de usuario">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/10 text-xs text-primary">{initials || <User className="size-4" />}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium lg:inline">{user.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              <span className="mt-1 text-[10px] font-semibold tracking-wide text-primary uppercase">{user.role}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">Configuración</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="size-4" /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="hidden sm:inline-flex"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="size-5" />
      </Button>
    </header>
  );
}

function NotificationLink({ href, icon, label, count }: { href: string; icon: React.ReactNode; label: string; count: number }) {
  if (count === 0) return null;
  return (
    <Link href={href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted">
      {icon}
      <span className="flex-1">{label}</span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{count}</span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cambiar tema"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-5 dark:hidden" />
      <Moon className="hidden size-5 dark:block" />
    </Button>
  );
}
