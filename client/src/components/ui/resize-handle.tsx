import { cn } from "@/lib/utils";
import React from "react";

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
}

export function ResizeHandle({ onMouseDown, className }: ResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10 touch-none select-none",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
