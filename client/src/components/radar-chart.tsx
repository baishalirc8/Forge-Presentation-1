import { useRef, useEffect } from "react";
import type { VerticalScores } from "@shared/schema";
import { VERTICALS } from "@shared/schema";

interface RadarChartProps {
  scores: VerticalScores;
  targetLevel?: number;
  size?: number;
  className?: string;
}

export function RadarChart({ scores, targetLevel = 5, size = 320, className = "" }: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = size * 0.38;
    const numAxes = VERTICALS.length;
    const angleStep = (Math.PI * 2) / numAxes;
    const startAngle = -Math.PI / 2;

    ctx.clearRect(0, 0, size, size);

    for (let ring = 1; ring <= 9; ring++) {
      const r = (ring / 9) * maxRadius;
      ctx.beginPath();
      for (let i = 0; i <= numAxes; i++) {
        const angle = startAngle + i * angleStep;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = ring % 3 === 0 ? "rgba(148, 163, 184, 0.18)" : "rgba(148, 163, 184, 0.08)";
      ctx.lineWidth = ring % 3 === 0 ? 1 : 0.5;
      ctx.stroke();
    }

    for (let i = 0; i < numAxes; i++) {
      const angle = startAngle + i * angleStep;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + maxRadius * Math.cos(angle), cy + maxRadius * Math.sin(angle));
      ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    const targetR = (targetLevel / 9) * maxRadius;
    ctx.beginPath();
    for (let i = 0; i <= numAxes; i++) {
      const angle = startAngle + i * angleStep;
      const x = cx + targetR * Math.cos(angle);
      const y = cy + targetR * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    const dataPoints: [number, number][] = [];
    for (let i = 0; i < numAxes; i++) {
      const key = VERTICALS[i].key;
      const value = scores[key] || 0;
      const r = (value / 9) * maxRadius;
      const angle = startAngle + i * angleStep;
      dataPoints.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }

    ctx.beginPath();
    dataPoints.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.08)");
    gradient.addColorStop(1, "rgba(59, 130, 246, 0.22)");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(59, 130, 246, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    dataPoints.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgb(59, 130, 246)";
      ctx.fill();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    ctx.font = "600 9px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < numAxes; i++) {
      const angle = startAngle + i * angleStep;
      const labelR = maxRadius + 18;
      const x = cx + labelR * Math.cos(angle);
      const y = cy + labelR * Math.sin(angle);

      const key = VERTICALS[i].key;
      const value = scores[key] || 0;

      ctx.fillStyle = value >= targetLevel
        ? "rgba(74, 222, 128, 0.9)"
        : value >= targetLevel - 2
          ? "rgba(251, 191, 36, 0.9)"
          : "rgba(148, 163, 184, 0.7)";
      ctx.fillText(key, x, y);
    }
  }, [scores, targetLevel, size]);

  return <canvas ref={canvasRef} className={className} data-testid="chart-radar" />;
}
