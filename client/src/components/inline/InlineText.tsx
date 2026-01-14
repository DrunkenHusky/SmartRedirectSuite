import React, { useState, useEffect, useRef } from "react";
import { useEditMode } from "@/context/EditModeContext";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

interface InlineTextProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}

export function InlineText({ value, onChange, className, placeholder, multiline = false }: InlineTextProps) {
  const { isEditMode } = useEditMode();
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (tempValue !== value) {
      onChange(tempValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      handleBlur();
    }
    if (e.key === "Escape") {
      setTempValue(value);
      setIsEditing(false);
    }
  };

  if (!isEditMode) {
    return <span className={className}>{value || placeholder}</span>;
  }

  if (isEditing) {
    return multiline ? (
        <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn("w-full bg-background border rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-primary font-inherit text-inherit", className)}
            rows={3}
        />
    ) : (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn("bg-background border rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-primary font-inherit text-inherit", className)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
        onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
        }}
        className={cn(
            "relative cursor-pointer group hover:bg-muted/50 rounded px-1 -mx-1 border border-transparent hover:border-dashed hover:border-muted-foreground/50 transition-colors",
            className
        )}
        title="Click to edit"
    >
        {value || <span className="text-muted-foreground italic">{placeholder || "Empty"}</span>}
        <Pencil className="w-3 h-3 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 text-muted-foreground bg-background rounded-full p-0.5 border shadow-sm" />
    </div>
  );
}
