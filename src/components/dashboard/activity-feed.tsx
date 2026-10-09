import { AlertTriangle, CheckCircle2, ClipboardCheck, Images, MousePointerClick, Star } from "lucide-react";
import Link from "next/link";
import type { ActivityItem, ActivityKind } from "@/lib/data/dashboard";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<ActivityKind, { icon: typeof Star; className: string }> = {
  review: { icon: Star, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  content: { icon: Images, className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  session: { icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  audit: { icon: ClipboardCheck, className: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  error: { icon: AlertTriangle, className: "bg-red-500/15 text-red-600 dark:text-red-400" },
  panel: { icon: MousePointerClick, className: "bg-primary/10 text-primary" },
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <p className="py-8 text-center text-sm text-muted-foreground">Sin actividad reciente</p>;
  return (
    <ol className="flex flex-col">
      {items.map((item) => {
        const { icon: Icon, className } = ICONS[item.kind];
        const content = (
          <div className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
            <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", className)}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{item.title}</p>
              <p className="text-xs text-muted-foreground">{formatRelative(item.at)}</p>
            </div>
          </div>
        );
        return <li key={item.id}>{item.href ? <Link href={item.href}>{content}</Link> : content}</li>;
      })}
    </ol>
  );
}
