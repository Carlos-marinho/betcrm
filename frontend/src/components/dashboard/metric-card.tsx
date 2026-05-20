import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  loading?: boolean;
  accent?: "gold" | "teal" | "red" | "default";
}

export function MetricCard({ title, value, description, icon, trend, loading, accent = "default" }: MetricCardProps) {
  const accentBorder = {
    gold: "hover:border-gold/25",
    teal: "hover:border-teal/25",
    red: "hover:border-destructive/25",
    default: "hover:border-white/10",
  }[accent];

  const accentIcon = {
    gold: "text-gold bg-gold/10",
    teal: "text-teal bg-teal/10",
    red: "text-destructive bg-destructive/10",
    default: "text-muted-foreground bg-white/5",
  }[accent];

  if (loading) {
    return (
      <div className="card-vault p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 w-24 shimmer-bg rounded" />
          <div className="h-8 w-8 shimmer-bg rounded-md" />
        </div>
        <div className="h-8 w-20 shimmer-bg rounded mb-2" />
        <div className="h-3 w-32 shimmer-bg rounded" />
      </div>
    );
  }

  return (
    <div className={cn("card-vault p-5 transition-all duration-200", accentBorder)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
        {icon && (
          <div className={cn("w-8 h-8 rounded-md flex items-center justify-center", accentIcon)}>
            <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>
          </div>
        )}
      </div>

      <div className="font-data text-3xl font-semibold text-foreground tracking-tight">
        {value}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-data font-medium",
              trend.positive ? "text-teal" : "text-destructive"
            )}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}%
          </span>
        )}
      </div>
    </div>
  );
}
