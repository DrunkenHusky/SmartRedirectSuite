import React from 'react';
import { Gauge } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface QualityGaugeProps {
  score: number; // 0-100
  level: 'red' | 'yellow' | 'green';
  explanation?: string;
}

export function QualityGauge({ score, level, explanation }: QualityGaugeProps) {
  // Determine color classes
  let colorClass = "text-green-600 bg-green-50";
  let iconColor = "#16a34a"; // green-600

  if (level === 'red') {
    colorClass = "text-red-600 bg-red-50";
    iconColor = "#dc2626"; // red-600
  } else if (level === 'yellow') {
    colorClass = "text-yellow-600 bg-yellow-50";
    iconColor = "#ca8a04"; // yellow-600
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${colorClass} border border-transparent hover:border-current transition-colors cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500`}
          tabIndex={0}
          role="status"
          aria-label={`Link-Qualität: ${score}%. ${explanation || ""}`}
        >
          <Gauge className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm font-bold">{score}%</span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold">Link-Qualität: {score}%</p>
          <p className="text-xs text-muted-foreground">{explanation || "Einschätzung der Qualität dieses Links."}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
