import { LEVEL_LABELS } from "@shared/schema";

interface MaturityBadgeProps {
  level: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getLevelColor(level: number): string {
  if (level <= 2) return "bg-red-500/15 text-red-400 border-red-500/20";
  if (level <= 4) return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  if (level <= 6) return "bg-primary/15 text-primary border-primary/20";
  if (level <= 8) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
}

export function MaturityBadge({ level, size = "md", showLabel = true }: MaturityBadgeProps) {
  const colorClass = getLevelColor(level);
  const sizeClass = size === "sm" ? "text-sm px-2 py-0.5" : size === "lg" ? "text-sm px-3 py-1.5" : "text-sm px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-mono font-semibold ${colorClass} ${sizeClass}`}
      data-testid={`badge-maturity-${level}`}
    >
      <span>L{level}</span>
      {showLabel && <span className="font-sans font-normal opacity-70">{LEVEL_LABELS[level] || ""}</span>}
    </span>
  );
}

export function getLevelColorHex(level: number): string {
  if (level <= 2) return "#ef4444";
  if (level <= 4) return "#f59e0b";
  if (level <= 6) return "#8B8B3A";
  if (level <= 8) return "#10b981";
  return "#10b981";
}
