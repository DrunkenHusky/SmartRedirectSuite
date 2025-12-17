import React from 'react';
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
}

export function ResizeHandle({ onMouseDown, className }: ResizeHandleProps) {
  return (
    <div
      className={cn(
        "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-primary/50 active:bg-primary z-10",
        className
      )}
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()} // Prevent sort click
    />
  );
}
