import {
  Bot,
  Building2,
  ClipboardCheck,
  Globe,
  Images,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  children?: { title: string; href: string }[];
}

export const NAV_MAIN: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Clientes", href: "/clients", icon: Building2 },
  { title: "Webs", href: "/websites", icon: Globe },
  {
    title: "Google Business",
    href: "/gbp",
    icon: Star,
    children: [
      { title: "Perfiles", href: "/gbp/profiles" },
      { title: "Reseñas", href: "/gbp/reviews" },
      { title: "Errores", href: "/gbp/errors" },
    ],
  },
  { title: "Contenido", href: "/content", icon: Images },
  { title: "Auditorías", href: "/audits", icon: ClipboardCheck },
  { title: "Automatizaciones", href: "/automations", icon: Bot },
];

export const NAV_SECONDARY: NavItem[] = [
  { title: "Administración", href: "/admin", icon: ShieldCheck },
  { title: "Configuración", href: "/settings", icon: Settings },
];

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
