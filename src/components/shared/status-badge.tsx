import { Badge } from "@/components/ui/badge";
import { statusLabel, statusTone, type StatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  neutral: "bg-muted text-muted-foreground border-border",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
  danger: "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/20",
  info: "bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/20",
  accent: "bg-violet-500/12 text-violet-700 dark:text-violet-400 border-violet-500/20",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  neutral: "bg-muted-foreground/60",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  accent: "bg-violet-500",
};

export function StatusBadge({
  status,
  label,
  tone,
  className,
}: {
  status?: string | null;
  label?: string;
  tone?: StatusTone;
  className?: string;
}) {
  const t = tone ?? statusTone(status);
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", TONE_CLASSES[t], className)}>
      <span className={cn("size-1.5 rounded-full", DOT_CLASSES[t])} aria-hidden />
      {label ?? statusLabel(status)}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean | null | undefined }) {
  return <StatusBadge status={active ? "ACTIVE" : "INACTIVE"} />;
}
