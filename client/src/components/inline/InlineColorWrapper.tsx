import React, { useRef } from 'react';
import { useEditMode } from './EditModeContext';
import { cn } from "@/lib/utils";
import { Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface InlineColorProps {
  color: string;
  onSave: (newColor: string) => Promise<void>;
  className?: string;
  children?: React.ReactNode;
}

export function InlineColorWrapper({
  color,
  onSave,
  className,
  children
}: InlineColorProps) {
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
      <PopoverContent className="w-64 p-3">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Farbe wählen</h4>
          <p className="text-sm text-muted-foreground">Wählen Sie eine Hintergrundfarbe.</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {['#ffffff', '#f8fafc', '#f1f5f9', '#fee2e2', '#fef3c7', '#ecfccb', '#dbeafe', '#f3e8ff'].map((c) => (
              <button
                key={c}
                className="w-8 h-8 rounded-full border border-gray-200 shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
                onClick={() => onSave(c)}
              />
            ))}
          </div>
          <div className="flex gap-2 items-center mt-2">
            <input
              type="color"
              value={color}
              onChange={(e) => onSave(e.target.value)}
              className="flex-1 h-8 cursor-pointer"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
