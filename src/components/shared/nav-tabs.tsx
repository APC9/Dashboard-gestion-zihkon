import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Pestañas basadas en URL (?tab=...). Solo se renderiza en servidor la
 * pestaña activa, así cada pestaña consulta únicamente sus datos.
 */
export function NavTabs({
  tabs,
  active,
  basePath,
  param = "tab",
}: {
  tabs: { value: string; label: string; count?: number }[];
  active: string;
  basePath: string;
  param?: string;
}) {
  return (
    <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Secciones">
      <div className="inline-flex min-w-full gap-1 border-b">
        {tabs.map((t) => {
          const isActive = t.value === active;
          return (
            <Link
              key={t.value}
              href={`${basePath}?${param}=${t.value}`}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {t.label}
              {t.count ? (
                <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">{t.count}</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
