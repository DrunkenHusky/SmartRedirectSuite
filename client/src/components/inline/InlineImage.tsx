import React, { useRef } from 'react';
import { useEditMode } from './EditModeContext';
import { cn } from "@/lib/utils";
import { Upload, X } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface InlineImageProps {
  src?: string;
  alt?: string;
  className?: string;
  placeholder?: React.ReactNode;
  onSave: (url: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function InlineImage({
  src,
  alt,
  className,
  placeholder,
  onSave,
  onDelete
}: InlineImageProps) {
  const { isEditMode } = useEditMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5242880) { // 5MB
      toast({
        title: "Datei zu groß",
        description: "Maximal 5MB erlaubt.",
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/logo/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();

      await onSave(data.uploadURL);

      toast({
        title: "Bild hochgeladen",
        description: "Das Bild wurde erfolgreich aktualisiert.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Fehler",
        description: "Upload fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  if (!isEditMode) {
    if (!src) return <>{placeholder}</>;
    return <img src={src} alt={alt} className={className} />;
  }

  return (
    <div className={cn("relative group inline-block", className)}>
      {src ? (
        <img src={src} alt={alt} className={cn("transition-opacity group-hover:opacity-70", className)} />
      ) : (
        <div className={cn("border-2 border-dashed border-gray-300 rounded flex items-center justify-center bg-gray-50", className)}>
            {placeholder || <span className="text-xs text-gray-400">Bild hochladen</span>}
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded">
        <div className="flex gap-2">
            <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 text-blue-600"
            title="Bild hochladen"
            >
            <Upload className="h-4 w-4" />
            </button>
            {src && onDelete && (
            <button
                onClick={onDelete}
                className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 text-red-600"
                title="Bild entfernen"
            >
                <X className="h-4 w-4" />
            </button>
            )}
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
    </div>
  );
}
