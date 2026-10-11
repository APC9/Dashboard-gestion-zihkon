import Link from "next/link";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/gbp/profiles", label: "Perfiles", key: "profiles" },
  { href: "/gbp/reviews", label: "Reseñas", key: "reviews" },
  { href: "/gbp/accounts", label: "Cuentas de Google", key: "accounts" },
  { href: "/gbp/errors", label: "Errores", key: "errors" },
] as const;

export function GbpNav({ active }: { active: (typeof ITEMS)[number]["key"] }) {
  return (
    <nav className="flex w-fit gap-1 rounded-lg bg-muted p-1" aria-label="Google Business">
      {ITEMS.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === i.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
