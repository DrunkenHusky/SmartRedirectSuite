import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { GeneralSettings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface EditModeContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  enableEditMode: () => void;
  disableEditMode: () => void;
  settings: GeneralSettings | undefined;
  isLoading: boolean;
  pendingSettings: Partial<GeneralSettings>;
  updateSetting: <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => void;
  saveChanges: () => Promise<void>;
  discardChanges: () => void;
  hasUnsavedChanges: boolean;
}

const EditModeContext = createContext<EditModeContextType | undefined>(undefined);

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<Partial<GeneralSettings>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<GeneralSettings>({
    queryKey: ["/api/settings"],
  });

  // Effective settings merge the server settings with pending local changes
  const effectiveSettings = settings ? { ...settings, ...pendingSettings } : undefined;

  const updateSetting = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setPendingSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: Partial<GeneralSettings>) => {
        // Merge with existing settings to ensure we send a complete object if needed,
        // or the API might handle partial updates.
        // Based on AdminPage, it sends the full object.
        if (!settings) throw new Error("Settings not loaded");
        return apiRequest("PUT", "/api/admin/settings", { ...settings, ...newSettings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setPendingSettings({});
      toast({
        title: "Einstellungen gespeichert",
        description: "Die Änderungen wurden erfolgreich übernommen.",
      });
      setIsEditMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Fehler beim Speichern",
        description: error.message || "Die Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    },
  });

  const saveChanges = async () => {
    if (Object.keys(pendingSettings).length === 0) {
        setIsEditMode(false);
        return;
    }
    await updateSettingsMutation.mutateAsync(pendingSettings);
  };

  const discardChanges = () => {
    setPendingSettings({});
    setIsEditMode(false);
  };

  const enableEditMode = () => setIsEditMode(true);
  const disableEditMode = () => {
      if (Object.keys(pendingSettings).length > 0) {
          if (confirm("Es gibt ungespeicherte Änderungen. Möchten Sie diese verwerfen?")) {
              discardChanges();
          }
      } else {
          setIsEditMode(false);
      }
  };

  const toggleEditMode = () => {
      if (isEditMode) {
          disableEditMode();
      } else {
          enableEditMode();
      }
  };

  return (
    <EditModeContext.Provider
      value={{
        isEditMode,
        toggleEditMode,
        enableEditMode,
        disableEditMode,
        settings: effectiveSettings,
        isLoading,
        pendingSettings,
        updateSetting,
        saveChanges,
        discardChanges,
        hasUnsavedChanges: Object.keys(pendingSettings).length > 0,
      }}
    >
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (context === undefined) {
    throw new Error("useEditMode must be used within an EditModeProvider");
  }
  return context;
}
