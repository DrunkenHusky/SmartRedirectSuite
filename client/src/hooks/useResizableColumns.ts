import { useState, useCallback, useRef } from 'react';

interface UseResizableColumnsOptions {
  initialWidths: Record<string, number>;
  minWidth?: number;
}

export function useResizableColumns({ initialWidths, minWidth = 50 }: UseResizableColumnsOptions) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(initialWidths);
  const resizingRef = useRef<{ index: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((index: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent sorting triggering

    const startX = e.pageX;
    const startWidth = columnWidths[index] || 100; // Fallback

    resizingRef.current = { index, startX, startWidth };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;

    const { index, startX, startWidth } = resizingRef.current;
    const diff = e.pageX - startX;
    const newWidth = Math.max(minWidth, startWidth + diff);

    setColumnWidths((prev) => ({
      ...prev,
      [index]: newWidth,
    }));
  }, [minWidth]);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  return {
    columnWidths,
    handleResizeStart,
  };
}
