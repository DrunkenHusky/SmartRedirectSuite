import React from 'react';
import { useEditMode } from './EditModeContext';
import { cn } from "@/lib/utils";
import {
  ArrowRightLeft,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Info,
  Bookmark,
  Share2,
  Clock,
  CheckCircle,
  Star,
  Heart,
  Bell
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ICON_OPTIONS } from "@shared/schema";

interface InlineIconPickerProps {
  iconName: string;
  onSave: (newIcon: string) => Promise<void>;
  className?: string;
  children: React.ReactNode;
}

const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    ArrowRightLeft,
    AlertTriangle,
    AlertCircle,
    XCircle,
    Info,
    Bookmark,
    Share2,
    Clock,
    CheckCircle,
    Star,
    Heart,
    Bell
  };
  return iconMap[iconName] || AlertTriangle;
};

export function InlineIconPicker({
  iconName,
  onSave,
  className,
  children
}: InlineIconPickerProps) {
  const { isEditMode } = useEditMode();

  if (!isEditMode) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className={cn("relative group cursor-pointer inline-block", className)}>
          {children}
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded pointer-events-none">
            <span className="sr-only">Icon ändern</span>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Icon wählen</h4>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {ICON_OPTIONS.filter(i => i !== 'none').map((icon) => {
              const IconComp = getIconComponent(icon);
              return (
                <button
                  key={icon}
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded border hover:bg-muted transition-colors",
                    iconName === icon ? "bg-primary/10 border-primary text-primary" : "border-transparent"
                  )}
                  onClick={() => onSave(icon)}
                  title={icon}
                >
                  <IconComp className="h-4 w-4" />
                </button>
              );
            })}
             <button
                className={cn(
                    "flex items-center justify-center h-8 w-8 rounded border hover:bg-muted transition-colors text-xs",
                    iconName === 'none' ? "bg-primary/10 border-primary text-primary" : "border-transparent"
                )}
                onClick={() => onSave('none')}
                title="Kein Icon"
             >
                Ø
             </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
