import React, { useCallback, useState } from 'react';
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  onResize: (width: number) => void;
  className?: string;
}

export function ResizeHandle({ onResize, className }: ResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const header = (e.target as HTMLElement).closest('th');
    if (!header) return;

    const startX = e.pageX;
    const startWidth = header.getBoundingClientRect().width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      requestAnimationFrame(() => {
        const currentX = moveEvent.pageX;
        const deltaX = currentX - startX;
        // Min width 40px
        onResize(Math.max(40, startWidth + deltaX));
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      setIsResizing(false);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    setIsResizing(true);
  }, [onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-primary/50 transition-colors z-10",
        isResizing && "bg-primary w-1.5", // Make it slightly thicker and colored when dragging
        className
      )}
    />
  );
}
