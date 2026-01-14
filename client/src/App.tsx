import { useState, useEffect, lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MigrationPage from "@/pages/migration";
import { DocumentHeadUpdater } from "@/components/DocumentHeadUpdater";
import { EditModeProvider, useEditMode } from "@/context/EditModeContext";
import { AdminToolbar } from "@/components/AdminToolbar";
import "./i18n"; // Initialize i18n
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

// Lazy load the AdminPage component to reduce initial bundle size
const AdminPage = lazy(() => import("@/pages/admin"));

function AppContent() {
  const { i18n } = useTranslation();
  const [currentView, setCurrentView] = useState<'migration' | 'admin'>('migration');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { enableEditMode } = useEditMode();

  // Fetch settings to get default language
  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
  });

  // Set default language from settings ONLY if detection failed or no language is set
  // We trust i18next-browser-languagedetector to have done its job if i18n.language is set
  useEffect(() => {
    if (settings?.defaultLanguage) {
      // If i18n hasn't detected a language (rare) or if the detected language is not supported/loaded
      // we might want to ensure a fallback. However, i18next usually handles fallbackLng.
      // We only intervene if we want to enforce the server-side "default" over the library's fallback.

      const hasLanguageSet = !!i18n.language;
      const hasLocalPreference = !!localStorage.getItem('i18nextLng');

      // If no language is detected/set, or if no local preference exists and the current language is just a fallback 'dev' or similar
      if (!hasLanguageSet || (!hasLocalPreference && !['de', 'en', 'fr', 'it'].some(l => i18n.language.startsWith(l)))) {
         i18n.changeLanguage(settings.defaultLanguage);
      }
    }
  }, [settings?.defaultLanguage, i18n, i18n.language]);

  // Check if user wants to be in admin view on app load
  useEffect(() => {
    const checkInitialView = async () => {
      try {
        // Check if user is already authenticated in admin view
        const wantsAdminView = localStorage.getItem('showAdminView') === 'true';
        
        if (wantsAdminView) {
          const response = await fetch("/api/admin/status", {
            method: "GET",
            credentials: "include"
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.isAuthenticated) {
              setCurrentView('admin');
            } else {
              // Not authenticated, clear the admin view preference
              localStorage.removeItem('showAdminView');
            }
          } else {
            // API error, clear the admin view preference
            localStorage.removeItem('showAdminView');
          }
        }
        // Default to migration view for URL parameter ?admin=true handling
      } catch (error) {
        // Default to migration view on error
        localStorage.removeItem('showAdminView');
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkInitialView();
  }, []);

  const handleAdminAccess = () => {
    localStorage.setItem('showAdminView', 'true');
    setCurrentView('admin');
  };

  const handleAdminClose = () => {
    // Clear admin state when closing admin menu
    localStorage.removeItem('showAdminView');
    localStorage.removeItem('adminActiveTab');
    localStorage.removeItem('adminStatsView');
    setCurrentView('migration');
  };

  const handleOpenVisualEditor = () => {
    // Clean up URL to prevent auto-redirect back to admin
    const url = new URL(window.location.href);
    if (url.searchParams.has('admin')) {
      url.searchParams.delete('admin');
      window.history.replaceState({}, '', url.toString());
    }

    handleAdminClose(); // Switch to migration view
    enableEditMode(); // Activate edit mode
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{useTranslation().t('app.loading', 'Lade Anwendung...')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DocumentHeadUpdater />
      <TooltipProvider>
        <Toaster />
        <Switch>
          <Route path="*">
            {currentView === 'migration' ? (
              <>
                <MigrationPage onAdminAccess={handleAdminAccess} />
                <AdminToolbar />
              </>
            ) : (
              <Suspense fallback={
                <div className="min-h-screen bg-background flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">{useTranslation().t('admin.loading', 'Lade Administrator-Bereich...')}</p>
                  </div>
                </div>
              }>
                <AdminPage
                  onClose={handleAdminClose}
                  onOpenVisualEditor={handleOpenVisualEditor}
                />
              </Suspense>
            )}
          </Route>
        </Switch>
      </TooltipProvider>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <EditModeProvider>
        <AppContent />
      </EditModeProvider>
    </QueryClientProvider>
  );
}

export default App;
