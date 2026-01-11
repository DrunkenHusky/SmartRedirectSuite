import React, { useState, useEffect, useRef } from 'react';
import { useEditMode } from './EditModeContext';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, X, Edit2 } from 'lucide-react';
import { cn } from "@/lib/utils";

interface InlineTextProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  label?: string; // For accessibility and tooltip
}

export function InlineText({
  value,
  onSave,
  className,
  multiline = false,
  placeholder,
  label
}: InlineTextProps) {
  const { isEditMode } = useEditMode();
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    if (isEditMode) {
      e.preventDefault();
      e.stopPropagation();
      setIsEditing(true);
      setTempValue(value);
    }
  };

  const handleSave = async () => {
    if (tempValue !== value) {
      setIsSaving(true);
      try {
        await onSave(tempValue);
        setIsEditing(false);
      } catch (error) {
        console.error("Failed to save", error);
        // Keep editing state on error
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleCancel = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsEditing(false);
    setTempValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("relative flex items-center gap-1 min-w-[100px]", className)} onClick={e => e.stopPropagation()}>
        {multiline ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[60px] resize-y"
            placeholder={placeholder}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 py-1"
            placeholder={placeholder}
          />
        )}
        <div className="flex flex-col gap-1 absolute -right-8 top-0 z-50">
          <Button
            size="icon"
            variant="default"
            className="h-7 w-7 bg-green-600 hover:bg-green-700"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-7 w-7"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleStartEdit}
      className={cn(
        "relative transition-all duration-200 rounded px-1 -mx-1 border border-transparent",
        isEditMode && "cursor-pointer hover:bg-blue-50 hover:border-blue-200 group",
        className
      )}
      title={isEditMode ? `Edit ${label || 'text'}` : undefined}
    >
      {value || <span className="text-muted-foreground italic opacity-50">{placeholder || 'Empty'}</span>}
      {isEditMode && (
        <Edit2 className="h-3 w-3 text-blue-500 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}
