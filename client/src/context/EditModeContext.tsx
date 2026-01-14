import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { GeneralSettings, Translation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface EditModeContextType {
  isEditMode: boolean;
  toggleEditMode: () => void;
  enableEditMode: () => void;
  disableEditMode: () => void;
  settings: GeneralSettings | undefined;
  isLoading: boolean;
  pendingSettings: Partial<GeneralSettings>;
  updateSetting: <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => void;
  pendingTranslations: Record<string, string>;
  updateTranslation: (key: string, value: string, lang: string) => void;
  getLocalizedText: (key: string, defaultValue: string) => string;
  saveChanges: () => Promise<void>;
  discardChanges: () => void;
  hasUnsavedChanges: boolean;
}

const EditModeContext = createContext<EditModeContextType | undefined>(undefined);

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<Partial<GeneralSettings>>({});
  const [pendingTranslations, setPendingTranslations] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { i18n, t } = useTranslation();

  const { data: settings, isLoading } = useQuery<GeneralSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: translations } = useQuery<Translation[]>({
    queryKey: ["/api/admin/translations"],
    enabled: isEditMode, // Only fetch all translations when in edit mode
  });

  // Effective settings merge the server settings with pending local changes
  const effectiveSettings = settings ? { ...settings, ...pendingSettings } : undefined;

  const updateSetting = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setPendingSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateTranslation = (key: string, value: string, lang: string) => {
    setPendingTranslations((prev) => ({ ...prev, [`${lang}:${key}`]: value }));
  };

  const getLocalizedText = (key: string, defaultValue: string) => {
    const lang = i18n.language;
    // Check pending changes first
    if (pendingTranslations[`${lang}:${key}`] !== undefined) {
      return pendingTranslations[`${lang}:${key}`];
    }
    // Then check loaded translations (if available in context, or via i18next)
    // Note: i18next `t` function uses loaded resources.
    // However, if we want to support editing, we rely on the translations API.
    // Ideally, we use `t(key, { defaultValue })`.
    // But since we want to edit, we should see the actual value.

    // Check if translation exists in standard i18next
    if (i18n.exists(key)) {
        return t(key);
    }

    return defaultValue;
  };

  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: Partial<GeneralSettings>) => {
        // Merge with existing settings to ensure we send a complete object if needed,
        // or the API might handle partial updates.
        // Based on AdminPage, it sends the full object.
        if (!settings) throw new Error("Settings not loaded");

        // Remove id and updatedAt from the payload as they are not allowed in the update schema
        const { id, updatedAt, ...payload } = { ...settings, ...newSettings };

        return apiRequest("PUT", "/api/admin/settings", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setPendingSettings({});
      toast({
        title: "Einstellungen gespeichert",
        description: "Die Änderungen wurden erfolgreich übernommen.",
      });
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
    try {
        if (Object.keys(pendingSettings).length > 0) {
            await updateSettingsMutation.mutateAsync(pendingSettings);
        }

        if (Object.keys(pendingTranslations).length > 0) {
            // Process translations one by one (or batch if API supported)
            const updates = Object.entries(pendingTranslations).map(([compositeKey, value]) => {
                const [lang, ...keyParts] = compositeKey.split(':');
                const key = keyParts.join(':');
                return { key, value, lang };
            });

            // Sequential updates to ensure order and error handling
            for (const update of updates) {
                await apiRequest("POST", "/api/admin/translations", update);
            }

            // Invalidate translations query
            queryClient.invalidateQueries({ queryKey: ["/api/admin/translations"] });
            // Also invalidate i18n resources (force reload) - this requires i18next-http-backend to reload
            i18n.reloadResources();

            setPendingTranslations({});

            // Only show toast if no settings were updated (otherwise settings mutation shows toast)
            if (Object.keys(pendingSettings).length === 0) {
                toast({
                    title: "Übersetzungen gespeichert",
                    description: "Die Änderungen wurden erfolgreich übernommen.",
                });
            }
        }

        setIsEditMode(false);
    } catch (error: any) {
        console.error("Save error:", error);
        toast({
            title: "Fehler beim Speichern",
            description: "Einige Änderungen konnten nicht gespeichert werden.",
            variant: "destructive"
        });
    }
  };

  const discardChanges = () => {
    setPendingSettings({});
    setPendingTranslations({});
    setIsEditMode(false);
  };

  const enableEditMode = () => setIsEditMode(true);
  const disableEditMode = () => {
      if (Object.keys(pendingSettings).length > 0 || Object.keys(pendingTranslations).length > 0) {
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
        pendingTranslations,
        updateTranslation,
        getLocalizedText,
        saveChanges,
        discardChanges,
        hasUnsavedChanges: Object.keys(pendingSettings).length > 0 || Object.keys(pendingTranslations).length > 0,
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
