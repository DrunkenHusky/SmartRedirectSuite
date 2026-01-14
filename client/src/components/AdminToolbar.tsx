import React from "react";
import { useEditMode } from "@/context/EditModeContext";
import { Button } from "@/components/ui/button";
import { Save, X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminToolbar() {
  const { isEditMode, saveChanges, discardChanges, hasUnsavedChanges, isLoading } = useEditMode();
  const [isSaving, setIsSaving] = React.useState(false);

  if (!isEditMode) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await saveChanges();
    setIsSaving(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 p-2 bg-foreground/90 text-background rounded-full shadow-lg backdrop-blur supports-[backdrop-filter]:bg-foreground/80 animate-in slide-in-from-bottom-10 fade-in duration-300">
      <div className="flex items-center gap-2 pl-3 pr-4 border-r border-background/20">
        <Settings className="w-4 h-4 animate-spin-slow" />
        <span className="font-medium text-sm whitespace-nowrap">Visual Editor Mode</span>
      </div>

      <div className="flex items-center gap-2 pr-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isSaving}
          className={cn("rounded-full px-4 h-8 transition-all", hasUnsavedChanges ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground")}
        >
          <Save className="w-3 h-3 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={disableEditMode}
          className="rounded-full h-8 w-8 p-0 text-background hover:bg-background/20 hover:text-background"
          title="Exit / Discard"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
