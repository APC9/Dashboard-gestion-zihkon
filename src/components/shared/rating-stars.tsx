import { Star } from "lucide-react";
import { ratingToNumber } from "@/lib/status";
import { cn } from "@/lib/utils";

export function RatingStars({ rating, className }: { rating: string | number | null | undefined; className?: string }) {
  const n = typeof rating === "number" ? rating : ratingToNumber(rating);
  if (!n) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${n} de 5 estrellas`} title={`${n}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn("size-3.5", i < n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
        />
      ))}
    </span>
  );
}
