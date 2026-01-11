import React from 'react';
import { useEditMode } from './EditModeContext';
import { cn } from "@/lib/utils";
import { Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface InlineSemanticColorPickerProps {
  color: string;
  onSave: (newColor: string) => Promise<void>;
  className?: string;
  children?: React.ReactNode;
}

const SEMANTIC_COLORS = [
  { value: 'yellow', label: 'Gelb', bgClass: 'bg-yellow-100 border-yellow-200' },
  { value: 'red', label: 'Rot', bgClass: 'bg-red-100 border-red-200' },
  { value: 'orange', label: 'Orange', bgClass: 'bg-orange-100 border-orange-200' },
  { value: 'blue', label: 'Blau', bgClass: 'bg-blue-100 border-blue-200' },
  { value: 'gray', label: 'Grau', bgClass: 'bg-gray-100 border-gray-200' },
];

export function InlineSemanticColorPicker({
  color,
  onSave,
  className,
  children
}: InlineSemanticColorPickerProps) {
  const { isEditMode } = useEditMode();

  if (!isEditMode) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className={cn("relative group cursor-pointer", className)}>
          {children}
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded pointer-events-none">
            <Palette className="h-4 w-4 text-white drop-shadow-md" />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Farbe wählen</h4>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {SEMANTIC_COLORS.map((c) => (
              <button
                key={c.value}
                className={cn(
                  "flex items-center gap-2 p-2 rounded border transition-colors text-sm",
                  color === c.value ? "ring-2 ring-primary" : "hover:bg-muted"
                )}
                onClick={() => onSave(c.value)}
              >
                <div className={cn("w-4 h-4 rounded-full border", c.bgClass.split(' ')[0])} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
