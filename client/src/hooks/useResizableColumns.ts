import { useState, useCallback, useEffect } from 'react';

export function useResizableColumns(initialWidths: Record<string, number | string>) {
  const [columnWidths, setColumnWidths] = useState(initialWidths);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const startResizing = useCallback((columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Get current width of the column
    const headerCell = (e.target as HTMLElement).closest('th');
    if (!headerCell) return;

    const currentWidth = headerCell.getBoundingClientRect().width;

    setResizingColumn(columnId);
    setStartX(e.clientX);
    setStartWidth(currentWidth);

    // Set width to pixel value to prevent jumping when switching from % to px
    setColumnWidths(prev => ({
      ...prev,
      [columnId]: currentWidth
    }));

    // Add resizing class to body to prevent text selection and ensure cursor consistency
    document.body.classList.add('cursor-col-resize', 'select-none');
  }, []);

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      // Min width 50px
      const newWidth = Math.max(50, startWidth + deltaX);

      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.body.classList.remove('cursor-col-resize', 'select-none');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('cursor-col-resize', 'select-none');
    };
  }, [resizingColumn, startX, startWidth]);

  return { columnWidths, startResizing, isResizing: !!resizingColumn };
}
