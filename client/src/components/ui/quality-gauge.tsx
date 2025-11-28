import React from 'react';

interface QualityGaugeProps {
  score: number; // 0-100
  level: 'red' | 'yellow' | 'green';
}

export function QualityGauge({ score, level }: QualityGaugeProps) {
  // Determine color classes
  let colorClass = "text-green-600";
  let bgClass = "bg-green-100";
  let borderColorClass = "border-green-200";

  if (level === 'red') {
    colorClass = "text-red-600";
    bgClass = "bg-red-100";
    borderColorClass = "border-red-200";
  } else if (level === 'yellow') {
    colorClass = "text-yellow-600";
    bgClass = "bg-yellow-100";
    borderColorClass = "border-yellow-200";
  }

  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-lg border ${bgClass} ${borderColorClass} shadow-sm`}>
      <div className="relative w-24 h-12 overflow-hidden mb-2">
         {/* Gauge Background (Semicircle) */}
        <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-[10px] border-gray-200 box-border"></div>

        {/* Gauge Color Segments */}
        <svg viewBox="0 0 100 50" className="w-full h-full">
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
            <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke={level === 'red' ? '#dc2626' : level === 'yellow' ? '#ca8a04' : '#16a34a'}
                strokeWidth="10"
                strokeDasharray={`${(score / 100) * 126} 126`} // 126 is approx arc length for radius 40 semicircle
            />
        </svg>
      </div>
      <div className={`text-xl font-bold ${colorClass}`}>
        {score}%
      </div>
      <div className="text-xs text-muted-foreground mt-1 font-medium">
        Qualität der Übereinstimmung
      </div>
    </div>
  );
}
