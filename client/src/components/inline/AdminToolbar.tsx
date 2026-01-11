import { useEditMode } from './EditModeContext';
import { Button } from "@/components/ui/button";
import { Edit, LogOut, Settings, Eye, Check } from 'lucide-react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import AdminPage from "@/pages/admin"; // We will reuse the Admin Page in a Modal or overlay

interface AdminToolbarProps {
  onLogout: () => void;
  onOpenAdmin: () => void;
}

export function AdminToolbar({ onLogout, onOpenAdmin }: AdminToolbarProps) {
  const { isEditMode, toggleEditMode, isAdmin } = useEditMode();
  const { toast } = useToast();

  if (!isAdmin) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-5 fade-in">

        <Button
          variant={isEditMode ? "default" : "outline"}
          size="icon"
          onClick={toggleEditMode}
          className={`rounded-full h-10 w-10 transition-all ${isEditMode ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
          title={isEditMode ? "Vorschau anzeigen" : "Seite bearbeiten"}
        >
          {isEditMode ? <Check className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenAdmin}
          className="rounded-full h-10 w-10"
          title="Erweiterte Einstellungen & Statistiken"
        >
          <Settings className="h-5 w-5" />
        </Button>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onLogout}
          className="rounded-full h-10 w-10 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          title="Abmelden"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
      {isEditMode && (
         <div className="text-center">
            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                Edit Mode
            </span>
         </div>
      )}
    </div>
  );
}
