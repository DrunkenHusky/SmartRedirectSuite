import React from "react";
import { useEditMode } from "@/context/EditModeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Palette, Check } from "lucide-react";

interface InlineColorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const PRESET_COLORS = [
    "#ffffff", "#f8f9fa", "#e9ecef", "#dee2e6", "#ced4da", "#adb5bd",
    "#6c757d", "#495057", "#343a40", "#212529", "#000000",
    "#f8d7da", "#d4edda", "#cce5ff", "#fff3cd", "#d1ecf1",
    "#dc3545", "#28a745", "#007bff", "#ffc107", "#17a2b8"
];

export function InlineColor({ value, onChange, className }: InlineColorProps) {
  const { isEditMode } = useEditMode();

  if (!isEditMode) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-center p-1.5 rounded-full bg-background border shadow-sm hover:bg-muted transition-colors",
            className
          )}
          onClick={(e) => e.stopPropagation()}
          title="Change Color"
        >
            <Palette className="w-4 h-4 text-muted-foreground" />
            <span
                className="w-3 h-3 rounded-full border ml-1.5"
                style={{ backgroundColor: value }}
            />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="space-y-3">
            <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Custom Color</label>
                <div className="flex gap-2">
                    <input
                        type="color"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-10 h-8 p-0 border-0 rounded cursor-pointer"
                    />
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="flex-1 h-8 px-2 text-sm border rounded bg-background"
                        placeholder="#ffffff"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Presets</label>
                <div className="grid grid-cols-7 gap-1">
                    {PRESET_COLORS.map(color => (
                        <button
                            key={color}
                            className={cn(
                                "w-6 h-6 rounded border flex items-center justify-center transition-transform hover:scale-110",
                                value === color && "ring-2 ring-primary ring-offset-1"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => onChange(color)}
                            title={color}
                        >
                            {value === color && <Check className={cn("w-3 h-3", getContrastYIQ(color) ? "text-black" : "text-white")} />}
                        </button>
                    ))}
                </div>
            </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getContrastYIQ(hexcolor: string) {
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0, 2), 16);
    var g = parseInt(hexcolor.substr(2, 2), 16);
    var b = parseInt(hexcolor.substr(4, 2), 16);
    var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128);
}
