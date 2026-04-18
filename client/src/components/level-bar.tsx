interface LevelBarProps {
  current: number;
  target: number;
  max?: number;
  vertical?: string;
}

function getBarColor(current: number, target: number): string {
  if (current >= target) return "bg-emerald-500";
  if (current >= target - 1) return "bg-amber-500";
  return "bg-primary";
}

export function LevelBar({ current, target, max = 9, vertical }: LevelBarProps) {
  const pct = (current / max) * 100;
  const targetPct = (target / max) * 100;

  return (
    <div className="w-full" data-testid={`levelbar-${vertical || "default"}`}>
      <div className="relative h-2 rounded-sm bg-muted/60">
        <div
          className="absolute inset-y-0 left-0 rounded-sm transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundImage: `linear-gradient(90deg, ${current >= target ? "rgb(16, 185, 129)" : current >= target - 1 ? "rgb(245, 158, 11)" : "rgb(139, 139, 58)"}, ${current >= target ? "rgb(52, 211, 153)" : current >= target - 1 ? "rgb(252, 211, 77)" : "rgb(160, 160, 80)"})`,
          }}
        />
        <div
          className="absolute top-[-3px] h-[14px] w-[2px] bg-amber-400/60 rounded-full"
          style={{ left: `${targetPct}%` }}
          title={`Target: L${target}`}
        />
      </div>
    </div>
  );
}
