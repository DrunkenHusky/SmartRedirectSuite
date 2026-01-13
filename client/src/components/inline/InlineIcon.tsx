import React from "react";
import { useEditMode } from "@/context/EditModeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Bell,
  Pencil
} from "lucide-react";

// Icon mapping matching schema and MigrationPage
const ICON_MAP = {
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
} as const;

interface InlineIconProps {
  value: string; // Icon name
  onChange: (value: string) => void;
  className?: string;
}

export function InlineIcon({ value, onChange, className }: InlineIconProps) {
  const { isEditMode } = useEditMode();

  const IconComponent = ICON_MAP[value as keyof typeof ICON_MAP] || AlertTriangle;

  if (!isEditMode) {
    if (value === "none") return null;
    return <IconComponent className={className} />;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "relative cursor-pointer group hover:bg-muted/50 rounded p-1 -m-1 border border-transparent hover:border-dashed hover:border-muted-foreground/50 transition-colors inline-flex",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {value === "none" ? <span className="text-muted-foreground text-xs">[No Icon]</span> : <IconComponent className="w-full h-full" />}
          <Pencil className="w-3 h-3 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 text-muted-foreground bg-background rounded-full p-0.5 border shadow-sm" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <ScrollArea className="h-64">
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant="ghost"
              className={cn("h-10 w-10 p-0", value === "none" && "bg-muted")}
              onClick={() => onChange("none")}
              title="None"
            >
              <span className="text-xs">None</span>
            </Button>
            {Object.entries(ICON_MAP).map(([name, Icon]) => (
              <Button
                key={name}
                variant="ghost"
                className={cn("h-10 w-10 p-0", value === name && "bg-muted")}
                onClick={() => onChange(name)}
                title={name}
              >
                <Icon className="h-5 w-5" />
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
