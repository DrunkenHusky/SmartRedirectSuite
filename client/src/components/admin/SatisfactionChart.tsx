import { useState, useRef } from "react";

export function SatisfactionChart({
  data,
  feedbackOnly,
  aggregation = 'day'
}: {
  data: Array<{
    date: string;
    score: number;
    count: number;
    okCount: number;
    nokCount: number;
    autoCount: number;
    avgMatchQuality: number;
    mixedScore: number;
  }>,
  feedbackOnly?: boolean,
  aggregation?: 'day' | 'week' | 'month'
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!data || data.length < 2) return <div className="text-center text-muted-foreground py-8">Nicht genügend Daten für Trendanzeige</div>;

  // Process data based on feedbackOnly mode
  const chartData = data.map(d => {
    // Determine Satisfaction Score based on mode
    let satisfactionScore: number | null = d.mixedScore; // Default mixed score

    const totalFeedback = (d.okCount || 0) + (d.nokCount || 0) + (d.autoCount || 0);

    if (feedbackOnly) {
       // Strict mode: Only explicit feedback (auto is implicit positive?)
       // If autoCount is included in "totalFeedback", we should decide if it contributes to score.
       // Usually auto-redirect is 100% success.
       satisfactionScore = totalFeedback > 0 ? Math.round(((d.okCount + d.autoCount) / totalFeedback) * 100) : null;
    } else {
       // Mixed mode: if count is 0, it's a gap (no traffic)
       if (d.count === 0) {
           satisfactionScore = null;
       }
    }

    return {
      ...d,
      satisfactionScore,
      feedbackCount: totalFeedback,
      matchQualityScore: d.avgMatchQuality,
      autoCount: d.autoCount || 0
    };
  });

  const maxCount = Math.max(...chartData.map(d => d.feedbackCount)) || 1; // Dynamic scale

  // Calculate SVG paths

  // 1. Match Quality Line (Blue)
  const qualityPoints = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * 100;
    const y = 100 - d.matchQualityScore;
    return `${x},${y}`;
  }).join(' ');

  // 2. Satisfaction Score Line (Orange)
  let satisfactionPathD = "";
  let isDrawing = false;

  chartData.forEach((d, i) => {
      const x = (i / (chartData.length - 1)) * 100;

      if (d.satisfactionScore !== null) {
          const y = 100 - d.satisfactionScore;
          if (!isDrawing) {
              satisfactionPathD += `M ${x},${y} `;
              isDrawing = true;
          } else {
              satisfactionPathD += `L ${x},${y} `;
          }
      } else {
          isDrawing = false;
      }
  });

  // 3. Feedback Count Line (Purple Dotted)
  const countPoints = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * 100;
    const y = 100 - ((d.feedbackCount / maxCount) * 90); // Use 90% height max
    return `${x},${y}`;
  }).join(' ');

  // Helper for date formatting
  const formatDate = (dateStr: string) => {
    if (aggregation === 'month') return dateStr; // YYYY-MM
    if (aggregation === 'week') return dateStr; // YYYY-Wxx
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const index = Math.round((x / width) * (chartData.length - 1));
    if (index >= 0 && index < chartData.length) {
      setActiveIndex(index);
    }
  };

  return (
    <div
      className="w-full h-[200px] flex flex-col relative"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setActiveIndex(null)}
    >
        {/* Legends */}
        <div className="absolute top-2 right-2 flex flex-wrap justify-end gap-3 text-[10px] z-10 bg-background/80 p-1 rounded backdrop-blur-sm border">
            <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>Match Quality</span>
            </div>
            <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span>{feedbackOnly ? "Zufriedenheit (Feedback)" : "Gesamt-Zufriedenheit"}</span>
            </div>
            <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span>Feedback (inkl. Auto)</span>
            </div>
        </div>

        {/* Tooltip Overlay */}
        {activeIndex !== null && chartData[activeIndex] && (
          <div
            className="absolute top-8 left-0 z-20 bg-popover text-popover-foreground p-2 rounded shadow-md text-xs border pointer-events-none"
            style={{
              left: `${(activeIndex / (chartData.length - 1)) * 100}%`,
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap'
            }}
          >
            <div className="font-semibold mb-1">{formatDate(chartData[activeIndex].date)}</div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Match: {chartData[activeIndex].matchQualityScore}%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span>Score: {chartData[activeIndex].satisfactionScore !== null ? `${chartData[activeIndex].satisfactionScore}%` : '-'}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span>Total: {chartData[activeIndex].feedbackCount}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                <span>(OK: {chartData[activeIndex].okCount}, Auto: {chartData[activeIndex].autoCount}, NOK: {chartData[activeIndex].nokCount})</span>
            </div>
          </div>
        )}

        <div className="flex-1 relative w-full h-full min-h-[150px]">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Background Grid */}
                {[0, 25, 50, 75, 100].map(y => (
                    <line
                        key={y}
                        x1="0"
                        y1={y}
                        x2="100"
                        y2={y}
                        stroke="currentColor"
                        strokeOpacity="0.1"
                        strokeDasharray="2"
                        vectorEffect="non-scaling-stroke"
                        className="text-foreground"
                    />
                ))}

                {/* Line for Match Quality (Blue) */}
                <polyline
                    points={qualityPoints}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeOpacity="0.6"
                    vectorEffect="non-scaling-stroke"
                />

                {/* Line for Feedback Count (Purple Dotted) */}
                <polyline
                    points={countPoints}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    vectorEffect="non-scaling-stroke"
                />

                {/* Line for Satisfaction Score (Orange) - Using Path for gaps */}
                <path
                    d={satisfactionPathD}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                />

                {/* Dots for isolated points or all points for clarity */}
                {chartData.map((d, i) => {
                    if (d.satisfactionScore === null) return null;
                    const x = (i / (chartData.length - 1)) * 100;
                    const y = 100 - d.satisfactionScore;
                    return (
                        <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="1.5"
                            fill="#f97316"
                            vectorEffect="non-scaling-stroke"
                        />
                    );
                })}

                {/* Active Indicator Line */}
                {activeIndex !== null && (
                  <line
                    x1={(activeIndex / (chartData.length - 1)) * 100}
                    y1="0"
                    x2={(activeIndex / (chartData.length - 1)) * 100}
                    y2="100"
                    stroke="currentColor"
                    strokeOpacity="0.5"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
            </svg>

            {/* Axis Labels (Overlay) */}
            <div className="absolute top-0 left-0 h-full flex flex-col justify-between text-[10px] text-muted-foreground pointer-events-none -ml-6">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
            </div>
        </div>

        {/* X-Axis Labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
            <span>{formatDate(data[0].date)}</span>
            <span className="hidden sm:inline">{formatDate(data[Math.floor(data.length / 2)].date)}</span>
            <span>{formatDate(data[data.length - 1].date)}</span>
        </div>
    </div>
  );
}
