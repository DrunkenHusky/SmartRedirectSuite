import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MigrationPage from "@/pages/migration";
import AdminPage from "@/pages/admin";
import { FaviconUpdater } from "@/components/FaviconUpdater";
import type { GeneralSettings } from "@shared/schema";

function AppContent() {
  const [currentView, setCurrentView] = useState<'migration' | 'admin'>('migration');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Fetch settings early for logo and favicon
  const { data: settings } = useQuery<GeneralSettings>({
    queryKey: ["/api/settings"],
    staleTime: 5 * 60 * 1000,
  });

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

  return (
    <>
      <FaviconUpdater />
      {isCheckingAuth ? (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            {settings?.headerLogoUrl ? (
              <img
                src={settings.headerLogoUrl}
                alt="Logo"
                className="h-16 w-auto mx-auto mb-4 object-contain"
              />
            ) : (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            )}
            {settings?.headerLogoUrl && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>}
            <p className="text-muted-foreground">Lade Anwendung...</p>
          </div>
        </div>
      ) : (
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="*">
              {currentView === 'migration' ? (
                <MigrationPage onAdminAccess={handleAdminAccess} />
              ) : (
                <AdminPage onClose={handleAdminClose} />
              )}
            </Route>
          </Switch>
        </TooltipProvider>
      )}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
