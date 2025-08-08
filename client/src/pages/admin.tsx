import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogFooter,
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Shield, 
  X, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Upload,
  Eye,

  BarChart3,
  Settings,
  FileText,
  Database,
  LogOut,
  Trash,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  AlertTriangle,
  Info,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

import type { UrlRule, GeneralSettings } from "@shared/schema";

interface AdminPageProps {
  onClose: () => void;
}

interface AdminAuthFormProps {
  onAuthenticated: () => void;
  onClose: () => void;
}

function AdminAuthForm({ onAuthenticated, onClose }: AdminAuthFormProps) {
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const authMutation = useMutation({
    mutationFn: async (password: string) => {
      return await apiRequest("POST", "/api/admin/login", { password });
    },
    onSuccess: async () => {
      toast({
        title: "Erfolgreich angemeldet",
        description: "Willkommen im Administrator-Bereich.",
      });
      
      // Immediately call onAuthenticated to update parent state
      onAuthenticated();
      
      // Then invalidate queries after state is updated
      await queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
    },
    onError: (error: any) => {
      toast({
        title: "Anmeldung fehlgeschlagen",
        description: error.message || "Falsches Passwort",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      authMutation.mutate(password);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="text-primary text-4xl" />
          </div>
          <CardTitle className="text-2xl">Administrator-Anmeldung</CardTitle>
          <p className="text-sm text-muted-foreground">
            Bitte geben Sie das Administrator-Passwort ein.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Passwort
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Administrator-Passwort eingeben"
                required
                disabled={authMutation.isPending}
              />
            </div>
            <div className="flex space-x-2">
              <Button
                type="submit"
                className="flex-1"
                disabled={authMutation.isPending}
              >
                {authMutation.isPending ? "Anmelden..." : "Anmelden"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={authMutation.isPending}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage({ onClose }: AdminPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Default to false until verified
  const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Start with checking auth on mount
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<UrlRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    matcher: "",
    targetUrl: "",
    infoText: "",
    redirectType: "partial" as "wildcard" | "partial",
    autoRedirect: false,
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [rulesSearchQuery, setRulesSearchQuery] = useState("");
  const [debouncedRulesSearchQuery, setDebouncedRulesSearchQuery] = useState("");
  const [rulesSortBy, setRulesSortBy] = useState<'matcher' | 'targetUrl' | 'createdAt'>('createdAt');
  const [rulesSortOrder, setRulesSortOrder] = useState<'asc' | 'desc'>('desc');
  const [rulesPage, setRulesPage] = useState(1);
  const [rulesPerPage] = useState(50); // Fixed page size for performance
  const rulesSearchInputRef = useRef<HTMLInputElement>(null);
  
  // Multi-select state for bulk delete
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Statistics pagination state
  const [statsPage, setStatsPage] = useState(1);
  const [statsPerPage] = useState(50); // Fixed page size for performance
  const [statsSearchQuery, setStatsSearchQuery] = useState("");
  const [debouncedStatsSearchQuery, setDebouncedStatsSearchQuery] = useState("");
  const statsSearchInputRef = useRef<HTMLInputElement>(null);

  const [generalSettings, setGeneralSettings] = useState({
    headerTitle: "URL Migration Tool",
    headerIcon: "ArrowRightLeft" as "ArrowLeftRight" | "ArrowRightLeft" | "AlertTriangle" | "XCircle" | "AlertCircle" | "Info" | "Bookmark" | "Share2" | "Clock" | "CheckCircle" | "Star" | "Heart" | "Bell" | "none",
    headerLogoUrl: "" as string | undefined,
    headerBackgroundColor: "#ffffff",
    mainTitle: "Veralteter Link erkannt",
    mainDescription: "Sie verwenden einen veralteten Link unserer Web-App. Bitte aktualisieren Sie Ihre Lesezeichen und verwenden Sie die neue URL unten.",
    mainBackgroundColor: "#ffffff",
    alertIcon: "AlertTriangle" as "AlertTriangle" | "XCircle" | "AlertCircle" | "Info",
    alertBackgroundColor: "yellow" as "yellow" | "red" | "orange" | "blue" | "gray",
    urlComparisonTitle: "URL-Vergleich",
    urlComparisonIcon: "ArrowRightLeft" as "ArrowLeftRight" | "ArrowRightLeft" | "AlertTriangle" | "XCircle" | "AlertCircle" | "Info" | "Bookmark" | "Share2" | "Clock" | "CheckCircle" | "Star" | "Heart" | "Bell" | "none",
    urlComparisonBackgroundColor: "#ffffff",
    oldUrlLabel: "Alte URL (veraltet)",
    newUrlLabel: "Neue URL (verwenden Sie diese)",
    defaultNewDomain: "https://thisisthenewurl.com/",
    copyButtonText: "URL kopieren",
    openButtonText: "In neuem Tab öffnen",
    showUrlButtonText: "Zeige mir die neue URL",
    popupButtonText: "Zeige mir die neue URL",
    specialHintsTitle: "Spezielle Hinweise für diese URL",
    specialHintsDescription: "Hier finden Sie spezifische Informationen und Hinweise für die Migration dieser URL.",
    specialHintsIcon: "Info" as "ArrowLeftRight" | "ArrowRightLeft" | "AlertTriangle" | "XCircle" | "AlertCircle" | "Info" | "Bookmark" | "Share2" | "Clock" | "CheckCircle" | "Star" | "Heart" | "Bell" | "none",
    infoTitle: "",
    infoTitleIcon: "Info" as "ArrowLeftRight" | "ArrowRightLeft" | "AlertTriangle" | "XCircle" | "AlertCircle" | "Info" | "Bookmark" | "Share2" | "Clock" | "CheckCircle" | "Star" | "Heart" | "Bell" | "none",
    infoItems: ["", "", ""],
    infoIcons: ["Bookmark", "Share2", "Clock"] as ("Bookmark" | "Share2" | "Clock" | "Info" | "CheckCircle" | "Star" | "Heart" | "Bell")[],
    footerCopyright: "",
    autoRedirect: false,
  });

  // Statistics filters and state
  const [statsFilter, setStatsFilter] = useState('all' as '24h' | '7d' | 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statsView, setStatsView] = useState<'top100' | 'referrers' | 'browser'>(() => {
    // Only restore stats view if we're explicitly showing admin view
    const showAdmin = localStorage.getItem('showAdminView') === 'true';
    return showAdmin ? ((localStorage.getItem('adminStatsView') as 'top100' | 'referrers' | 'browser') || 'top100') : 'top100';
  });
  const [activeTab, setActiveTab] = useState(() => {
    // Only restore admin tab if we're explicitly showing admin view
    const showAdmin = localStorage.getItem('showAdminView') === 'true';
    return showAdmin ? (localStorage.getItem('adminActiveTab') || 'general') : 'general';
  });

  // Auto-redirect confirmation dialog state
  const [showAutoRedirectDialog, setShowAutoRedirectDialog] = useState(false);
  const [pendingAutoRedirectValue, setPendingAutoRedirectValue] = useState(false);
  
  // Get current base URL
  const getCurrentBaseUrl = () => {
    return `${window.location.protocol}//${window.location.host}`;
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Save active tab to localStorage when it changes
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    localStorage.setItem('adminActiveTab', newTab);
  };

  // Save stats view to localStorage when it changes
  const handleStatsViewChange = (newView: 'top100' | 'referrers' | 'browser') => {
    setStatsView(newView);
    localStorage.setItem('adminStatsView', newView);
  };

  // Check authentication status on mount and when page becomes visible again
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch("/api/admin/status", {
          method: "GET",
          credentials: "include",
          cache: "no-store" // Prevent caching to get fresh session status
        });
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(data.isAuthenticated);
          setIsCheckingAuth(false);
        } else {
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setIsAuthenticated(false);
        setIsCheckingAuth(false);
      }
    };

    // Check auth status on mount
    checkAuthStatus();

    // Also check when page becomes visible (e.g., after browser tab switch or page reload)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAuthStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check auth status every 5 minutes to handle session expiry
    const interval = setInterval(checkAuthStatus, 5 * 60 * 1000);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Remove dependencies to prevent continuous re-checking

  // Queries - Use paginated API for better performance with large datasets
  const { data: paginatedRulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ["/api/admin/rules/paginated", rulesPage, rulesPerPage, debouncedRulesSearchQuery, rulesSortBy, rulesSortOrder],
    enabled: isAuthenticated,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: rulesPage.toString(),
        limit: rulesPerPage.toString(),
        sortBy: rulesSortBy,
        sortOrder: rulesSortOrder,
      });
      
      if (debouncedRulesSearchQuery.trim()) {
        params.append('search', debouncedRulesSearchQuery);
      }
      
      const response = await fetch(`/api/admin/rules/paginated?${params}`, {
        credentials: 'include',
      });
      if (response.status === 401 || response.status === 403) {
        setIsAuthenticated(false);
        throw new Error('Authentication required');
      }
      if (!response.ok) {
        throw new Error('Failed to fetch rules');
      }
      return response.json();
    },
  });

  const rules = paginatedRulesData?.rules || [];
  const totalRules = paginatedRulesData?.total || 0;
  const totalPagesFromAPI = paginatedRulesData?.totalPages || 1;

  const { data: statsData, isLoading: statsLoading } = useQuery<{
    stats: { total: number; today: number; week: number };
    topUrls: Array<{ path: string; count: number }>;
  }>({
    queryKey: ["/api/admin/stats/all", statsFilter],
    enabled: isAuthenticated,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statsFilter !== 'all') {
        params.append('timeRange', statsFilter);
      }
      const url = `/api/admin/stats/all${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        credentials: 'include',
      });
      if (response.status === 401 || response.status === 403) {
        setIsAuthenticated(false);
        throw new Error('Authentication required');
      }
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }
      return response.json();
    },
  });

  // Top 100 URLs - all entries (non-paginated)
  const { data: topUrlsData, isLoading: top100Loading } = useQuery<Array<{ path: string; count: number }>>({
    queryKey: ["/api/admin/stats/top100", statsFilter],
    enabled: isAuthenticated && statsView === 'top100',
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statsFilter !== 'all') {
        params.append('timeRange', statsFilter);
      }
      const url = `/api/admin/stats/top100${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) {
        setIsAuthenticated(false);
        throw new Error('Authentication required');
      }
      if (!response.ok) throw new Error('Failed to fetch top 100');
      return response.json();
    },
  });

  // Top Referrers - all entries (non-paginated)  
  const { data: referrersPagedData, isLoading: referrersLoading } = useQuery<Array<{ referrer: string; count: number }>>({
    queryKey: ["/api/admin/stats/referrers", statsFilter],
    enabled: isAuthenticated && statsView === 'referrers',
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statsFilter !== 'all') {
        params.append('timeRange', statsFilter);
      }
      const url = `/api/admin/stats/referrers${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) {
        setIsAuthenticated(false);
        throw new Error('Authentication required');
      }
      if (!response.ok) throw new Error('Failed to fetch referrers');
      return response.json();
    },
  });

  // Paginated tracking entries with search and sort
  const { data: paginatedEntriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ["/api/admin/stats/entries/paginated", statsPage, statsPerPage, debouncedStatsSearchQuery, sortBy, sortOrder],
    enabled: isAuthenticated && statsView === 'browser',
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: statsPage.toString(),
        limit: statsPerPage.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder,
      });
      
      if (debouncedStatsSearchQuery.trim()) {
        params.append('search', debouncedStatsSearchQuery);
      }
      
      const response = await fetch(`/api/admin/stats/entries/paginated?${params}`, {
        credentials: 'include',
      });
      if (response.status === 401 || response.status === 403) {
        setIsAuthenticated(false);
        throw new Error('Authentication required');
      }
      if (!response.ok) {
        throw new Error('Failed to fetch tracking entries');
      }
      return response.json();
    },
  });



  const { data: settingsData, isLoading: settingsLoading } = useQuery<GeneralSettings>({
    queryKey: ["/api/settings"],
    enabled: true, // Settings can be fetched without authentication
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    queryFn: async () => {
      console.log("Settings query executing - authenticated:", isAuthenticated);
      const response = await fetch("/api/settings", {
        credentials: 'include',
      });
      if (!response.ok) {
        console.error("Settings query failed:", response.status, response.statusText);
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      console.log("Settings query successful:", data);
      return data;
    },
  });

  // Populate general settings form when data is loaded
  useEffect(() => {
    if (settingsData) {
      setGeneralSettings({
        headerTitle: settingsData.headerTitle || "",
        headerIcon: settingsData.headerIcon || "ArrowRightLeft",
        headerLogoUrl: settingsData.headerLogoUrl || "",
        headerBackgroundColor: settingsData.headerBackgroundColor || "#ffffff",
        mainTitle: settingsData.mainTitle || "", 
        mainDescription: settingsData.mainDescription || "",
        mainBackgroundColor: settingsData.mainBackgroundColor || "#ffffff",
        alertIcon: settingsData.alertIcon || "AlertTriangle",
        alertBackgroundColor: settingsData.alertBackgroundColor || "yellow",
        urlComparisonTitle: settingsData.urlComparisonTitle || "URL-Vergleich",
        urlComparisonIcon: settingsData.urlComparisonIcon || "ArrowRightLeft",
        urlComparisonBackgroundColor: settingsData.urlComparisonBackgroundColor || "#ffffff",
        oldUrlLabel: settingsData.oldUrlLabel || "Alte URL (veraltet)",
        newUrlLabel: settingsData.newUrlLabel || "Neue URL (verwenden Sie diese)",
        defaultNewDomain: settingsData.defaultNewDomain || "https://thisisthenewurl.com/",
        copyButtonText: settingsData.copyButtonText || "URL kopieren",
        openButtonText: settingsData.openButtonText || "In neuem Tab öffnen",
        showUrlButtonText: settingsData.showUrlButtonText || "Zeige mir die neue URL",
        popupButtonText: settingsData.popupButtonText || "Zeige mir die neue URL",
        specialHintsTitle: settingsData.specialHintsTitle || "Spezielle Hinweise für diese URL",
        specialHintsDescription: settingsData.specialHintsDescription || "Hier finden Sie spezifische Informationen und Hinweise für die Migration dieser URL.",
        specialHintsIcon: settingsData.specialHintsIcon || "Info",
        infoTitle: settingsData.infoTitle || "",
        infoTitleIcon: settingsData.infoTitleIcon || "Info",
        infoItems: settingsData.infoItems || ["", "", ""],
        infoIcons: settingsData.infoIcons || ["Bookmark", "Share2", "Clock"],
        footerCopyright: settingsData.footerCopyright || "",
        autoRedirect: settingsData.autoRedirect || false, // Fix: This was missing!
      });
    }
  }, [settingsData]);

  // Mutations
  const createRuleMutation = useMutation({
    mutationFn: (rule: typeof ruleForm) => 
      apiRequest("POST", "/api/admin/rules", rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      setIsRuleDialogOpen(false);
      setValidationError(null);
      setShowValidationDialog(false);
      resetRuleForm();
      toast({ title: "Regel erstellt", description: "Die URL-Regel wurde erfolgreich erstellt." });
    },
    onError: (error: any) => {
      console.error('Create rule error:', error);
      console.error('Error keys:', Object.keys(error || {}));
      console.error('Error type:', typeof error);
      
      // Handle authentication errors specifically
      if (error?.status === 403 || error?.status === 401) {
        toast({ 
          title: "Authentifizierung erforderlich", 
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive" 
        });
        window.location.reload();
        return;
      }
      
      // Extract German error message from the server response
      let errorMessage = "Die Regel konnte nicht erstellt werden.";
      let title = "Fehler";
      
      // Check different possible error structures for createRuleMutation
      if (error?.error) {
        errorMessage = error.error;
        title = "Validierungsfehler";
      } else if (error?.message) {
        errorMessage = error.message;
        title = "Validierungsfehler";
      } else if (typeof error === 'string') {
        errorMessage = error;
        title = "Validierungsfehler";
      } else {
        // Fallback for unknown error structures
        errorMessage = JSON.stringify(error);
        title = "Unbekannter Fehler";
      }
      
      // Show validation error with save anyway option
      if (title === "Validierungsfehler") {
        setValidationError(errorMessage);
        setShowValidationDialog(true);
      } else {
        // For non-validation errors, show normal toast
        toast({ 
          title: title, 
          description: errorMessage,
          variant: "destructive" 
        });
      }
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: typeof ruleForm }) =>
      apiRequest("PUT", `/api/admin/rules/${id}`, rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      setIsRuleDialogOpen(false);
      setValidationError(null);
      setShowValidationDialog(false);
      resetRuleForm();
      toast({ title: "Regel aktualisiert", description: "Die URL-Regel wurde erfolgreich aktualisiert." });
    },
    onError: (error: any) => {
      console.error('Update rule error:', error);
      console.error('Error keys:', Object.keys(error || {}));
      console.error('Error type:', typeof error);
      
      // Handle authentication errors specifically
      if (error?.status === 403 || error?.status === 401) {
        toast({ 
          title: "Authentifizierung erforderlich", 
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive" 
        });
        window.location.reload();
        return;
      }
      
      // Extract German error message from the server response
      let errorMessage = "Die Regel konnte nicht aktualisiert werden.";
      let title = "Fehler";
      
      // Check different possible error structures for updateRuleMutation
      if (error?.error) {
        errorMessage = error.error;
        title = "Validierungsfehler";
      } else if (error?.message) {
        errorMessage = error.message;
        title = "Validierungsfehler";
      } else if (typeof error === 'string') {
        errorMessage = error;
        title = "Validierungsfehler";
      } else {
        // Fallback for unknown error structures
        errorMessage = JSON.stringify(error);
        title = "Unbekannter Fehler";
      }
      
      // Show validation error with save anyway option
      if (title === "Validierungsfehler") {
        setValidationError(errorMessage);
        setShowValidationDialog(true);
      } else {
        // For non-validation errors, show normal toast
        toast({ 
          title: title, 
          description: errorMessage,
          variant: "destructive" 
        });
      }
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      toast({ title: "Regel gelöscht", description: "Die URL-Regel wurde erfolgreich gelöscht." });
    },
    onError: (error: any) => {
      // Handle authentication errors specifically
      if (error?.status === 403 || error?.status === 401) {
        setIsAuthenticated(false);
        toast({ 
          title: "Authentifizierung erforderlich", 
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive" 
        });
        window.location.reload();
        return;
      }
      
      toast({ 
        title: "Fehler", 
        description: "Die Regel konnte nicht gelöscht werden.",
        variant: "destructive" 
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteRulesMutation = useMutation({
    mutationFn: async (ruleIds: string[]) => {
      // Critical safety check: Ensure we only delete rules from the current page
      const currentPageRuleIds = paginatedRules.map(rule => rule.id);
      const validRuleIds = ruleIds.filter(id => currentPageRuleIds.includes(id));
      
      if (validRuleIds.length === 0) {
        throw new Error('No valid rules selected from current page for deletion');
      }
      
      if (validRuleIds.length !== ruleIds.length) {
        const invalidCount = ruleIds.length - validRuleIds.length;
        throw new Error(`${invalidCount} selected rules are not on the current page. Only ${validRuleIds.length} will be deleted.`);
      }
      
      // Additional safety: Never delete more than what's visible on current page
      if (validRuleIds.length > paginatedRules.length) {
        throw new Error(`Safety error: Trying to delete ${validRuleIds.length} rules but only ${paginatedRules.length} visible on page`);
      }
      
      console.log(`BULK DELETE SAFETY CHECK: Deleting ${validRuleIds.length} rules from current page (${paginatedRules.length} total on page)`, validRuleIds.slice(0, 5));
      
      // Use the dedicated bulk delete endpoint with ONLY valid IDs
      return await apiRequest("DELETE", "/api/admin/bulk-delete-rules", { ruleIds: validRuleIds });
    },
    onSuccess: (result, ruleIds) => {
      const deletedCount = result.deletedCount || 0;
      const failedCount = result.failedCount || 0;
      const totalRequested = result.totalRequested || ruleIds.length;
      
      if (failedCount > 0) {
        toast({ 
          title: "Teilweise gelöscht", 
          description: `${deletedCount} von ${totalRequested} Regeln wurden erfolgreich gelöscht. ${failedCount} konnten nicht gelöscht werden.`,
          variant: "destructive"
        });
      } else {
        toast({ 
          title: "Regeln gelöscht", 
          description: `${deletedCount} ${deletedCount === 1 ? 'Regel wurde' : 'Regeln wurden'} erfolgreich gelöscht.` 
        });
      }
      
      setSelectedRuleIds([]);
      setShowBulkDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
    },
    onError: (error: any) => {
      if (error?.status === 403 || error?.status === 401) {
        setIsAuthenticated(false);
        toast({
          title: "Authentifizierung erforderlich",
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive",
        });
        window.location.reload();
        return;
      }
      toast({ 
        title: "Fehler beim Löschen", 
        description: error.message || "Die Regeln konnten nicht gelöscht werden.",
        variant: "destructive" 
      });
      setShowBulkDeleteDialog(false);
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: typeof generalSettings) => 
      apiRequest("PUT", "/api/admin/settings", settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Einstellungen gespeichert", description: "Die allgemeinen Einstellungen wurden erfolgreich aktualisiert." });
    },
    onError: (error: any) => {
      console.error("Settings save error:", error);
      
      // Handle authentication errors specifically
      if (error?.status === 403 || error?.status === 401) {
        setIsAuthenticated(false);
        toast({ 
          title: "Authentifizierung erforderlich", 
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive" 
        });
        window.location.reload();
        return;
      }
      
      let errorMessage = "Die Einstellungen konnten nicht gespeichert werden.";
      
      // Check for validation errors in the response
      if (error?.serverError?.validationErrors) {
        const validationErrors = error.serverError.validationErrors;
        errorMessage = validationErrors.map((err: any) => `${getUIFieldName(err.field)}: ${err.message}`).join(', ');
      } else if (error?.serverError?.details) {
        errorMessage = error.serverError.details;
      } else if (error?.serverError?.error) {
        errorMessage = error.serverError.error;
      } else if (error?.response?.data?.validationErrors) {
        const validationErrors = error.response.data.validationErrors;
        errorMessage = validationErrors.map((err: any) => `${getUIFieldName(err.field)}: ${err.message}`).join(', ');
      } else if (error?.response?.data?.details) {
        errorMessage = error.response.data.details;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      toast({ 
        title: "Validierungsfehler", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (rules: any[]) => {
      const response = await apiRequest("POST", "/api/admin/import/rules", { rules });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      if (data.errors && data.errors.length > 0) {
        toast({ 
          title: "Import mit Validierungsfehlern", 
          description: `${data.errors.length} Validierungsfehler: ${data.errors.slice(0, 2).join('; ')}${data.errors.length > 2 ? '...' : ''}`,
          variant: "destructive"
        });
      } else {
        const imported = data.imported || 0;
        const updated = data.updated || 0;
        toast({ 
          title: "Import erfolgreich", 
          description: `${imported} neue Regeln importiert, ${updated} Regeln aktualisiert.` 
        });
      }
    },
    onError: (error: any) => {
      // Handle authentication errors specifically
      if (error?.status === 403 || error?.status === 401) {
        setIsAuthenticated(false);
        toast({ 
          title: "Authentifizierung erforderlich", 
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive" 
        });
        window.location.reload();
        return;
      }
      
      toast({ 
        title: "Import fehlgeschlagen", 
        description: "Die Regeln konnten nicht importiert werden. Überprüfen Sie das Dateiformat.",
        variant: "destructive" 
      });
    },
  });

  const importSettingsMutation = useMutation({
    mutationFn: (settings: any) => 
      apiRequest("POST", "/api/admin/import/settings", { settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ 
        title: "Import erfolgreich", 
        description: "Die Einstellungen wurden erfolgreich importiert." 
      });
    },
    onError: (error: any) => {
      // Handle authentication errors specifically
      if (error?.status === 403 || error?.status === 401) {
        setIsAuthenticated(false);
        toast({ 
          title: "Authentifizierung erforderlich", 
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive" 
        });
        window.location.reload();
        return;
      }
      
      toast({ 
        title: "Import fehlgeschlagen", 
        description: "Die Einstellungen konnten nicht importiert werden. Überprüfen Sie das Dateiformat.",
        variant: "destructive" 
      });
    },
  });

  const resetRuleForm = () => {
    setRuleForm({ matcher: "", targetUrl: "", infoText: "", redirectType: "partial", autoRedirect: false });
    setEditingRule(null);
    setValidationError(null);
    setShowValidationDialog(false);
  };

  // Force save mutations that bypass validation
  const forceCreateRuleMutation = useMutation({
    mutationFn: (rule: typeof ruleForm) => 
      apiRequest("POST", "/api/admin/rules", { ...rule, forceCreate: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      setIsRuleDialogOpen(false);
      setValidationError(null);
      setShowValidationDialog(false);
      resetRuleForm();
      toast({ title: "Regel erstellt", description: "Die URL-Regel wurde trotz Warnung erfolgreich erstellt." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Fehler", 
        description: "Die Regel konnte auch mit Force-Option nicht erstellt werden.",
        variant: "destructive" 
      });
    },
  });

  const forceUpdateRuleMutation = useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: typeof ruleForm }) =>
      apiRequest("PUT", `/api/admin/rules/${id}`, { ...rule, forceUpdate: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      setIsRuleDialogOpen(false);
      setValidationError(null);
      setShowValidationDialog(false);
      resetRuleForm();
      toast({ title: "Regel aktualisiert", description: "Die URL-Regel wurde trotz Warnung erfolgreich aktualisiert." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Fehler", 
        description: "Die Regel konnte auch mit Force-Option nicht aktualisiert werden.",
        variant: "destructive" 
      });
    },
  });

  const handleForceSave = () => {
    if (editingRule) {
      forceUpdateRuleMutation.mutate({ id: editingRule.id, rule: ruleForm });
    } else {
      forceCreateRuleMutation.mutate(ruleForm);
    }
  };

  // Server-side pagination variables - now handled by the API
  const totalFilteredRules = totalRules;
  const totalPages = totalPagesFromAPI;
  const startIndex = (rulesPage - 1) * rulesPerPage;
  const endIndex = startIndex + rules.length; // Use actual returned rules length
  const paginatedRules = rules; // Rules are already paginated from server

  // Extract paginated stats data
  const trackingEntries = paginatedEntriesData?.entries || [];
  const totalStatsEntries = paginatedEntriesData?.total || 0;
  const totalAllStatsEntries = paginatedEntriesData?.totalAllEntries || 0;
  const totalStatsPages = paginatedEntriesData?.totalPages || 1;
  const statsStartIndex = (statsPage - 1) * statsPerPage;
  const statsEndIndex = statsStartIndex + trackingEntries.length;

  // Add missing variables for UI display
  const totalReferrers = referrersPagedData?.length || 0;
  const totalReferrersPages = 1; // Since we're not paginating referrers anymore
  const totalTopUrls = topUrlsData?.length || 0;
  const totalTopUrlsPages = 1; // Since we're not paginating top URLs anymore



  // Debounce search query to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRulesSearchQuery(rulesSearchQuery);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [rulesSearchQuery]);

  // Reset to first page when debounced search query changes
  useEffect(() => {
    setRulesPage(1);
    setSelectedRuleIds([]); // Clear selections when search query changes
  }, [debouncedRulesSearchQuery]);

  // Clear selected rule IDs when page changes
  useEffect(() => {
    setSelectedRuleIds([]);
  }, [rulesPage]);

  // Debounce stats search query to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedStatsSearchQuery(statsSearchQuery);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [statsSearchQuery]);

  // Reset to first page when debounced stats search query changes
  useEffect(() => {
    setStatsPage(1);
  }, [debouncedStatsSearchQuery]);

  const handleRulesSort = (column: 'matcher' | 'targetUrl' | 'createdAt') => {
    if (rulesSortBy === column) {
      setRulesSortOrder(rulesSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setRulesSortBy(column);
      setRulesSortOrder('asc');
    }
  };

  const handleSubmitRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, rule: ruleForm });
    } else {
      createRuleMutation.mutate(ruleForm);
    }
  };

  const handleEditRule = (rule: UrlRule) => {
    setEditingRule(rule);
    setRuleForm({
      matcher: rule.matcher,
      targetUrl: rule.targetUrl || "",
      infoText: rule.infoText || "",
      redirectType: rule.redirectType || "partial",
      autoRedirect: rule.autoRedirect || false,
    });
    setIsRuleDialogOpen(true);
  };



  // Multi-select handlers
  const handleSelectRule = (ruleId: string) => {
    setSelectedRuleIds(prev => 
      prev.includes(ruleId) 
        ? prev.filter(id => id !== ruleId)
        : [...prev, ruleId]
    );
  };

  const handleSelectAllRules = (checked: boolean) => {
    if (checked) {
      // Only select rules from the current page to avoid selecting all rules in the database
      const currentPageRuleIds = paginatedRules.map((rule: UrlRule) => rule.id);
      
      // Clear any existing selections and set only current page rules
      // Filter out any IDs that aren't on the current page to prevent accumulation
      setSelectedRuleIds(prevIds => {
        const validIds = prevIds.filter(id => currentPageRuleIds.includes(id));
        return [...new Set([...validIds, ...currentPageRuleIds])]; // Use Set to prevent duplicates
      });
    } else {
      const currentPageRuleIds = paginatedRules.map((rule: UrlRule) => rule.id);
      setSelectedRuleIds(prevIds => 
        prevIds.filter(id => !currentPageRuleIds.includes(id))
      );
    }
  };

  const handleBulkDelete = () => {
    if (selectedRuleIds.length === 0) return;
    
    // Critical safety check: ensure all selected IDs exist on current page
    const currentPageRuleIds = paginatedRules.map(rule => rule.id);
    const validSelectedIds = selectedRuleIds.filter(id => currentPageRuleIds.includes(id));
    
    console.log('BULK DELETE VALIDATION:', {
      selectedCount: selectedRuleIds.length,
      validCount: validSelectedIds.length,
      pageRuleCount: paginatedRules.length,
      currentPageIds: currentPageRuleIds,
      selectedIds: selectedRuleIds,
      validIds: validSelectedIds
    });
    
    if (validSelectedIds.length === 0) {
      toast({
        title: "Keine gültigen Regeln ausgewählt",
        description: "Keine der ausgewählten Regeln befinden sich auf der aktuellen Seite.",
        variant: "destructive"
      });
      return;
    }
    
    if (validSelectedIds.length !== selectedRuleIds.length) {
      const invalidCount = selectedRuleIds.length - validSelectedIds.length;
      toast({
        title: "Warnung: Ungültige Auswahl erkannt",
        description: `${invalidCount} ausgewählte Regeln sind nicht auf der aktuellen Seite. Nur ${validSelectedIds.length} Regeln werden gelöscht.`,
        variant: "destructive"
      });
      // Update selection to only valid IDs before proceeding
      setSelectedRuleIds(validSelectedIds);
    }
    
    // Additional safety: Never allow deleting more than what's on page
    if (validSelectedIds.length > paginatedRules.length) {
      toast({
        title: "Sicherheitsfehler",
        description: `Fehler: Versuch ${validSelectedIds.length} Regeln zu löschen, aber nur ${paginatedRules.length} auf der Seite sichtbar.`,
        variant: "destructive"
      });
      return;
    }
    
    setShowBulkDeleteDialog(true);
  };

  const handleExport = async (type: string, format: string = 'json') => {
    try {
      const response = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, format }),
        credentials: 'include',
      });

      if (response.status === 401 || response.status === 403) {
        setIsAuthenticated(false);
        toast({
          title: "Authentifizierung erforderlich",
          description: "Bitte melden Sie sich erneut an.",
          variant: "destructive",
        });
        window.location.reload();
        return;
      }

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}.${format === 'csv' ? 'csv' : 'json'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        const typeText = type === 'statistics' ? 'Statistiken' : type === 'rules' ? 'Regeln' : 'Einstellungen';
        toast({ 
          title: "Export erfolgreich", 
          description: `${typeText} wurden heruntergeladen.` 
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({ 
        title: "Export fehlgeschlagen", 
        description: "Die Daten konnten nicht exportiert werden.",
        variant: "destructive" 
      });
    }
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(generalSettings);
  };

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsAuthenticated(false);
      localStorage.removeItem('adminActiveTab'); // Clear saved tab on logout
      localStorage.removeItem('adminStatsView'); // Clear saved stats view on logout
      toast({
        title: "Erfolgreich abgemeldet",
        description: "Sie wurden erfolgreich abgemeldet.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Abmeldung fehlgeschlagen",
        description: error.message || "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  // Import/Export mutations
  const importRulesMutation = useMutation({
    mutationFn: async (rules: any[]) => {
      return await apiRequest("/api/admin/import", "POST", { rules });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Import erfolgreich",
        description: `${data.imported} Regeln wurden importiert.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
    },
    onError: (error: any) => {
      toast({
        title: "Import fehlgeschlagen",
        description: error.message || "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });



  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Show authentication form if not authenticated
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Überprüfe Authentifizierung...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminAuthForm onAuthenticated={() => {
      setIsAuthenticated(true);
      setIsCheckingAuth(false);
    }} onClose={onClose} />;
  }

  // Helper function to map technical field names to UI field names
  const getUIFieldName = (technicalName: string): string => {
    const fieldNameMap: Record<string, string> = {
      headerTitle: "Titel",
      mainTitle: "Titel", 
      mainDescription: "Beschreibung",
      footerCopyright: "Copyright-Text",
      urlComparisonTitle: "Titel",
      oldUrlLabel: "Alte URL Label",
      newUrlLabel: "Neue URL Label",
      defaultNewDomain: "Standard-Domain",
      copyButtonText: "Kopieren Button-Text",
      openButtonText: "Öffnen Button-Text",
      showUrlButtonText: "URL anzeigen Button-Text",
      popupButtonText: "PopUp Button-Text",
      specialHintsTitle: "Titel",
      specialHintsDescription: "Standard-Beschreibung"
    };
    return fieldNameMap[technicalName] || technicalName;
  };

  const handleInfoItemChange = (index: number, value: string) => {
    const newInfoItems = [...generalSettings.infoItems];
    newInfoItems[index] = value;
    setGeneralSettings({ ...generalSettings, infoItems: newInfoItems });
  };

  const addInfoItem = () => {
    const newInfoItems = [...generalSettings.infoItems, ""];
    const newInfoIcons = [...generalSettings.infoIcons, "Bookmark" as const];
    setGeneralSettings({ 
      ...generalSettings, 
      infoItems: newInfoItems,
      infoIcons: newInfoIcons
    });
  };

  const removeInfoItem = (index: number) => {
    const newInfoItems = generalSettings.infoItems.filter((_, i) => i !== index);
    const newInfoIcons = generalSettings.infoIcons.filter((_, i) => i !== index);
    setGeneralSettings({ 
      ...generalSettings, 
      infoItems: newInfoItems,
      infoIcons: newInfoIcons
    });
  };

  const handleInfoIconChange = (index: number, value: string) => {
    const newInfoIcons = [...generalSettings.infoIcons];
    newInfoIcons[index] = value as any;
    setGeneralSettings({ ...generalSettings, infoIcons: newInfoIcons });
  };

  // Helper functions for sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('de-DE');
  };

  const maxCount = statsData?.topUrls[0]?.count || 1;

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileContent = await file.text();
      const importData = JSON.parse(fileContent);
      
      // Validate that it's an array of rules
      if (!Array.isArray(importData)) {
        throw new Error("Import-Datei muss ein Array von Regeln enthalten");
      }

      // Import the rules
      importMutation.mutate(importData);
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      toast({ 
        title: "Dateifehler", 
        description: "Die Import-Datei konnte nicht gelesen werden. Überprüfen Sie das JSON-Format.",
        variant: "destructive" 
      });
      // Reset file input
      event.target.value = '';
    }
  };

  const handleImportSettingsFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileContent = await file.text();
      const importData = JSON.parse(fileContent);
      
      // Validate that it's a settings object (should have required fields)
      if (!importData || typeof importData !== 'object' || Array.isArray(importData)) {
        throw new Error("Import-Datei muss ein Einstellungs-Objekt enthalten");
      }

      // Remove id and updatedAt fields if present (they will be auto-generated)
      const { id, updatedAt, ...settingsData } = importData;

      // Import the settings
      importSettingsMutation.mutate(settingsData);
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      toast({ 
        title: "Dateifehler", 
        description: "Die Import-Datei konnte nicht gelesen werden. Überprüfen Sie das JSON-Format.",
        variant: "destructive" 
      });
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile-Friendly Admin Header */}
      <header className="bg-surface shadow-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Shield className="text-primary text-xl sm:text-2xl" />
              <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                <span className="hidden sm:inline">Administrator-Bereich</span>
                <span className="sm:hidden">Admin</span>
              </h1>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="text-muted-foreground hover:text-orange-600"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {logoutMutation.isPending ? "Abmelden..." : "Abmelden"}
                </span>
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Schließen</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile-Optimized Admin Content */}
      <main className="py-4 sm:py-8 px-3 sm:px-4 overflow-x-hidden">
        <div className="max-w-6xl mx-auto w-full">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-6">
            {/* Enhanced Tab Navigation */}
            <div className="w-full overflow-hidden">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="general" className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 py-3 px-1 sm:px-3 text-xs sm:text-sm min-h-[56px] sm:min-h-[48px]">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate leading-tight text-center">Allgemein</span>
                </TabsTrigger>
                <TabsTrigger value="rules" className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 py-3 px-1 sm:px-3 text-xs sm:text-sm min-h-[56px] sm:min-h-[48px]">
                  <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate leading-tight text-center">Regeln</span>
                </TabsTrigger>
                <TabsTrigger value="stats" className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 py-3 px-1 sm:px-3 text-xs sm:text-sm min-h-[56px] sm:min-h-[48px]">
                  <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate leading-tight text-center">Statistiken</span>
                </TabsTrigger>
                <TabsTrigger value="export" className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 py-3 px-1 sm:px-3 text-xs sm:text-sm min-h-[56px] sm:min-h-[48px]">
                  <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate leading-tight text-center">Import/Export</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* General Settings Tab */}
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Allgemeine Einstellungen</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Hier können Sie alle Texte der Anwendung anpassen.
                  </p>
                </CardHeader>
                <CardContent>
                  {!isAuthenticated ? (
                    <div className="text-center py-8">Bitte melden Sie sich an... (Auth: {String(isAuthenticated)})</div>
                  ) : settingsLoading ? (
                    <div className="text-center py-8">Lade Einstellungen... (Auth: {String(isAuthenticated)}, Loading: {String(settingsLoading)})</div>
                  ) : (
                    <form onSubmit={handleSettingsSubmit} className="space-y-8">
                      {/* 1. Header Settings */}
                      <div className="space-y-4 sm:space-y-6">
                        <div className="flex items-center gap-3 border-b pb-3">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-semibold">1</div>
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold text-foreground">Header-Einstellungen</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">Anpassung des oberen Bereichs der Anwendung - wird auf jeder Seite angezeigt</p>
                          </div>
                        </div>
                        <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                            {/* Title */}
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Titel <span className="text-red-500">*</span>
                              </label>
                              <Input
                                value={generalSettings.headerTitle}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, headerTitle: e.target.value })}
                                placeholder="Smart Redirect Service"
                                className={`bg-white dark:bg-gray-700 ${!generalSettings.headerTitle?.trim() ? 'border-red-500 focus:border-red-500' : ''}`}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Wird als Haupttitel im Header der Anwendung angezeigt
                              </p>
                            </div>
                            
                            {/* Icon */}
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${generalSettings.headerLogoUrl ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                Icon {generalSettings.headerLogoUrl && '(deaktiviert - Logo wird verwendet)'}
                              </label>
                              <Select 
                                value={generalSettings.headerIcon} 
                                onValueChange={(value) => 
                                  setGeneralSettings({ ...generalSettings, headerIcon: value as any })
                                }
                                disabled={!!generalSettings.headerLogoUrl}
                              >
                                <SelectTrigger className={`${generalSettings.headerLogoUrl ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-white dark:bg-gray-700'}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">🚫 Kein Icon</SelectItem>
                                  <SelectItem value="ArrowRightLeft">🔄 Pfeil Wechsel</SelectItem>
                                  <SelectItem value="AlertTriangle">⚠️ Warnung</SelectItem>
                                  <SelectItem value="XCircle">❌ Fehler</SelectItem>
                                  <SelectItem value="AlertCircle">⭕ Alert</SelectItem>
                                  <SelectItem value="Info">ℹ️ Info</SelectItem>
                                  <SelectItem value="Bookmark">🔖 Lesezeichen</SelectItem>
                                  <SelectItem value="Share2">📤 Teilen</SelectItem>
                                  <SelectItem value="Clock">⏰ Zeit</SelectItem>
                                  <SelectItem value="CheckCircle">✅ Häkchen</SelectItem>
                                  <SelectItem value="Star">⭐ Stern</SelectItem>
                                  <SelectItem value="Heart">❤️ Herz</SelectItem>
                                  <SelectItem value="Bell">🔔 Glocke</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* Background Color */}
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Hintergrundfarbe
                              </label>
                              <div className="flex items-center gap-3">
                                <input
                                  type="color"
                                  value={generalSettings.headerBackgroundColor}
                                  onChange={(e) => setGeneralSettings({ ...generalSettings, headerBackgroundColor: e.target.value })}
                                  className="w-20 h-10 p-1 rounded-md border cursor-pointer"
                                />
                                <Input
                                  value={generalSettings.headerBackgroundColor}
                                  onChange={(e) => setGeneralSettings({ ...generalSettings, headerBackgroundColor: e.target.value })}
                                  placeholder="#ffffff"
                                  className="flex-1 bg-white dark:bg-gray-700 font-mono text-sm"
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Logo Upload Section */}
                          <div className="border-t pt-4">
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Logo hochladen
                              </label>
                              <div className="space-y-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    // Validate file size (5MB)
                                    if (file.size > 5242880) {
                                      toast({
                                        title: "Datei zu groß",
                                        description: "Die Datei darf maximal 5MB groß sein.",
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
                                        credentials: 'include',
                                      });

                                      if (response.status === 401 || response.status === 403) {
                                        setIsAuthenticated(false);
                                        toast({
                                          title: "Authentifizierung erforderlich",
                                          description: "Bitte melden Sie sich erneut an.",
                                          variant: "destructive",
                                        });
                                        window.location.reload();
                                        return;
                                      }

                                      if (!response.ok) {
                                        throw new Error('Upload failed');
                                      }

                                      const data = await response.json();
                                      
                                      // Update settings with the new logo URL
                                      const logoResponse = await apiRequest("PUT", "/api/admin/logo", { logoUrl: data.uploadURL });
                                      const logoData = await logoResponse.json();
                                      
                                      // Update local state immediately with returned settings
                                      if (logoData?.settings) {
                                        setGeneralSettings(logoData.settings);
                                      } else {
                                        // Fallback: update logo URL in current state
                                        setGeneralSettings(prev => ({
                                          ...prev,
                                          headerLogoUrl: data.uploadURL
                                        }));
                                      }
                                      
                                      toast({
                                        title: "Logo hochgeladen",
                                        description: "Das Header-Logo wurde erfolgreich aktualisiert.",
                                      });
                                      
                                      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                                      // Reset the input
                                      e.target.value = '';
                                      
                                    } catch (error) {
                                      console.error("Logo upload error:", error);
                                      toast({
                                        title: "Fehler beim Hochladen",
                                        description: "Das Logo konnte nicht hochgeladen werden.",
                                        variant: "destructive",
                                      });
                                      e.target.value = '';
                                    }
                                  }}
                                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer cursor-pointer"
                                />
                                <div className="text-xs text-muted-foreground">
                                  <strong>Empfehlung:</strong> PNG mit transparentem Hintergrund, 200x50 Pixel (max. 5MB)
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                  <strong>Funktion:</strong> Wenn ein Logo hochgeladen wird, ersetzt es das gewählte Icon links neben dem Header-Titel. Ohne Logo wird das gewählte Icon angezeigt.
                                </div>
                                
                                {/* Logo Preview and Delete */}
                                {generalSettings.headerLogoUrl && generalSettings.headerLogoUrl.trim() !== "" && (
                                  <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 border rounded-lg">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Aktuelles Logo:
                                      </span>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        disabled={!generalSettings.headerLogoUrl || generalSettings.headerLogoUrl.trim() === ""} // Prevent clicks when no logo
                                        onClick={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          
                                          // Disable button immediately to prevent multiple clicks
                                          const button = e.currentTarget;
                                          button.disabled = true;
                                          
                                          try {
                                            const response = await apiRequest("DELETE", "/api/admin/logo");
                                            
                                            if (!response.ok) {
                                              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                                            }
                                            
                                            const deleteData = await response.json();
                                            
                                            // Update local state to immediately remove logo URL
                                            setGeneralSettings(prev => ({
                                              ...prev,
                                              headerLogoUrl: ""
                                            }));
                                            
                                            toast({
                                              title: "Logo entfernt",
                                              description: "Das Header-Logo wurde erfolgreich entfernt.",
                                            });
                                            
                                            // Invalidate settings to ensure UI reflects the change
                                            queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                                            
                                          } catch (error: any) {
                                            console.error("Logo deletion error:", error);
                                            
                                            // Re-enable button in case of error
                                            button.disabled = false;
                                            
                                            // Handle authentication errors specifically
                                            if (error?.status === 403 || error?.status === 401) {
                                              setIsAuthenticated(false);
                                              toast({
                                                title: "Authentifizierung erforderlich",
                                                description: "Bitte melden Sie sich erneut an.",
                                                variant: "destructive",
                                              });
                                              window.location.reload();
                                              return;
                                            }
                                            
                                            toast({
                                              title: "Fehler",
                                              description: "Das Logo konnte nicht entfernt werden.",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                        className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                                      >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Löschen
                                      </Button>
                                    </div>
                                    <div className="flex justify-center p-4 bg-white dark:bg-gray-700 border rounded">
                                      <img 
                                        src={generalSettings.headerLogoUrl} 
                                        alt="Header Logo" 
                                        className="max-h-16 max-w-[200px] object-contain"
                                        onError={(e) => {
                                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMiAxNkgyOEMzMC4yMDkxIDE2IDMyIDE3Ljc5MDkgMzIgMjBWMjRDMzIgMjYuMjA5MSAzMC4yMDkxIDI4IDI4IDI4SDEyQzkuNzkwODYgMjggOCAyNi4yMDkxIDggMjRWMjBDOCAxNy43OTA5IDkuNzkwODYgMTYgMTIgMTZaIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';
                                        }}
                                      />
                                    </div>
                                    <div className="flex items-center gap-2 justify-center">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      <span className="text-xs text-green-700 dark:text-green-300">
                                        Logo aktiv - wird anstelle des Icons angezeigt
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. PopUp Content Settings */}
                      <div className="space-y-4 sm:space-y-6">
                        <div className="flex items-center gap-3 border-b pb-3">
                          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 text-xs sm:text-sm font-semibold">2</div>
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold text-foreground">PopUp-Einstellungen</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">Dialog-Fenster das automatisch erscheint, wenn ein Nutzer eine veraltete URL aufruft</p>
                          </div>
                        </div>
                        <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Titel <span className="text-red-500">*</span>
                              </label>
                              <Input
                                value={generalSettings.mainTitle}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, mainTitle: e.target.value })}
                                placeholder="URL veraltet - Aktualisierung erforderlich"
                                className={`bg-white dark:bg-gray-700 ${!generalSettings.mainTitle?.trim() ? 'border-red-500 focus:border-red-500' : ''}`}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Icon
                              </label>
                              <Select value={generalSettings.alertIcon} onValueChange={(value) => 
                                setGeneralSettings({ ...generalSettings, alertIcon: value as any })
                              }>
                                <SelectTrigger className="bg-white dark:bg-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AlertTriangle">⚠️ Warnung</SelectItem>
                                  <SelectItem value="XCircle">❌ Fehler</SelectItem>
                                  <SelectItem value="AlertCircle">⭕ Alert</SelectItem>
                                  <SelectItem value="Info">ℹ️ Info</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              Beschreibung <span className="text-red-500">*</span>
                            </label>
                            <Textarea
                              value={generalSettings.mainDescription}
                              onChange={(e) => setGeneralSettings({ ...generalSettings, mainDescription: e.target.value })}
                              placeholder="Du verwendest einen alten Link. Dieser Link ist nicht mehr aktuell und wird bald nicht mehr funktionieren. Bitte verwende die neue URL und aktualisiere deine Verknüpfungen."
                              rows={3}
                              className={`bg-white dark:bg-gray-700 ${!generalSettings.mainDescription?.trim() ? 'border-red-500 focus:border-red-500' : ''}`}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Erklärt dem Nutzer die Situation und warum die neue URL verwendet werden sollte
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              PopUp Button-Text
                            </label>
                            <Input
                              value={generalSettings.popupButtonText}
                              onChange={(e) => setGeneralSettings({ ...generalSettings, popupButtonText: e.target.value })}
                              placeholder="Zeige mir die neue URL"
                              className="bg-white dark:bg-gray-700"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Text für den Button der das PopUp-Fenster öffnet
                            </p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Alert-Hintergrundfarbe
                              </label>
                              <Select value={generalSettings.alertBackgroundColor} onValueChange={(value) => 
                                setGeneralSettings({ ...generalSettings, alertBackgroundColor: value as any })
                              }>
                                <SelectTrigger className="bg-white dark:bg-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="yellow">🟡 Gelb</SelectItem>
                                  <SelectItem value="red">🔴 Rot</SelectItem>
                                  <SelectItem value="orange">🟠 Orange</SelectItem>
                                  <SelectItem value="blue">🔵 Blau</SelectItem>
                                  <SelectItem value="gray">⚫ Grau</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Hauptinhalt-Hintergrundfarbe
                              </label>
                              <div className="flex items-center gap-3">
                                <input
                                  type="color"
                                  value={generalSettings.mainBackgroundColor}
                                  onChange={(e) => setGeneralSettings({ ...generalSettings, mainBackgroundColor: e.target.value })}
                                  className="w-20 h-10 p-1 rounded-md border cursor-pointer"
                                />
                                <Input
                                  value={generalSettings.mainBackgroundColor}
                                  onChange={(e) => setGeneralSettings({ ...generalSettings, mainBackgroundColor: e.target.value })}
                                  placeholder="#ffffff"
                                  className="flex-1 bg-white dark:bg-gray-700 font-mono text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 3. URL Comparison Settings */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b pb-3">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm font-semibold">3</div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">URL-Vergleich</h3>
                            <p className="text-sm text-muted-foreground">Bereich für alte/neue URL-Gegenüberstellung</p>
                          </div>
                        </div>
                        <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-6 space-y-6">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                            {/* Title */}
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Titel
                              </label>
                              <Input
                                value={generalSettings.urlComparisonTitle}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, urlComparisonTitle: e.target.value })}
                                placeholder="Zu verwendende URL"
                                className="bg-white dark:bg-gray-700"
                              />
                            </div>
                            
                            {/* Icon */}
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Icon
                              </label>
                              <Select value={generalSettings.urlComparisonIcon} onValueChange={(value) => 
                                setGeneralSettings({ ...generalSettings, urlComparisonIcon: value as any })
                              }>
                                <SelectTrigger className="bg-white dark:bg-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">🚫 Kein Icon</SelectItem>
                                  <SelectItem value="ArrowRightLeft">🔄 Pfeil Wechsel</SelectItem>
                                  <SelectItem value="AlertTriangle">⚠️ Warnung</SelectItem>
                                  <SelectItem value="XCircle">❌ Fehler</SelectItem>
                                  <SelectItem value="AlertCircle">⭕ Alert</SelectItem>
                                  <SelectItem value="Info">ℹ️ Info</SelectItem>
                                  <SelectItem value="Bookmark">🔖 Lesezeichen</SelectItem>
                                  <SelectItem value="Share2">📤 Teilen</SelectItem>
                                  <SelectItem value="Clock">⏰ Zeit</SelectItem>
                                  <SelectItem value="CheckCircle">✅ Häkchen</SelectItem>
                                  <SelectItem value="Star">⭐ Stern</SelectItem>
                                  <SelectItem value="Heart">❤️ Herz</SelectItem>
                                  <SelectItem value="Bell">🔔 Glocke</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* Background Color */}
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Hintergrundfarbe
                              </label>
                              <div className="flex items-center gap-3">
                                <input
                                  type="color"
                                  value={generalSettings.urlComparisonBackgroundColor}
                                  onChange={(e) => setGeneralSettings({ ...generalSettings, urlComparisonBackgroundColor: e.target.value })}
                                  className="w-20 h-10 p-1 rounded-md border cursor-pointer"
                                />
                                <Input
                                  value={generalSettings.urlComparisonBackgroundColor}
                                  onChange={(e) => setGeneralSettings({ ...generalSettings, urlComparisonBackgroundColor: e.target.value })}
                                  placeholder="#ffffff"
                                  className="flex-1 bg-white dark:bg-gray-700 font-mono text-sm"
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* URL Labels */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Label für alte URL
                              </label>
                              <Input
                                value={generalSettings.oldUrlLabel}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, oldUrlLabel: e.target.value })}
                                placeholder="Alte aufgerufene URL"
                                className="bg-white dark:bg-gray-700"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Beschriftung für die veraltete URL im Vergleich
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Label für neue URL
                              </label>
                              <Input
                                value={generalSettings.newUrlLabel}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, newUrlLabel: e.target.value })}
                                placeholder="Neue URL"
                                className="bg-white dark:bg-gray-700"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Beschriftung für die neue/aktuelle URL im Vergleich
                              </p>
                            </div>
                          </div>
                          
                          {/* Default Domain */}
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              Standard neue Domain
                            </label>
                            <Input
                              value={generalSettings.defaultNewDomain}
                              onChange={(e) => setGeneralSettings({ ...generalSettings, defaultNewDomain: e.target.value })}
                              placeholder="https://newapplicationurl.com/"
                              className="bg-white dark:bg-gray-700"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Domain die verwendet wird wenn keine spezielle URL-Regel greift - der Pfad wird automatisch übernommen
                            </p>
                          </div>
                          
                          {/* Action Buttons Sub-section */}
                          <div className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                  Button-Text "URL kopieren"
                                </label>
                                <Input
                                  value={generalSettings.copyButtonText}
                                  onChange={(e) => setGeneralSettings({ ...generalSettings, copyButtonText: e.target.value })}
                                  placeholder="URL kopieren"
                                  className="bg-white dark:bg-gray-700"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Kopiert die neue URL in die Zwischenablage
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                  Button-Text "In neuem Tab öffnen"
                                </label>
                                <Input
                                  value={generalSettings.openButtonText}
                                  onChange={(e) => setGeneralSettings({ ...generalSettings, openButtonText: e.target.value })}
                                  placeholder="In neuem Tab öffnen"
                                  className="bg-white dark:bg-gray-700"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Öffnet die neue URL in einem neuen Browser-Tab
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Special Hints Sub-section */}
                          <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400 text-xs font-semibold">3.1</div>
                              <div>
                                <h4 className="text-base font-semibold text-foreground">Spezielle Hinweise</h4>
                                <p className="text-sm text-muted-foreground">Zusatzbereich der immer sichtbar ist</p>
                              </div>
                            </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Titel
                              </label>
                              <Input
                                value={generalSettings.specialHintsTitle}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, specialHintsTitle: e.target.value })}
                                placeholder="Bitte beachte folgendes für diese URL:"
                                className="bg-white dark:bg-gray-700"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Icon
                              </label>
                              <Select value={generalSettings.specialHintsIcon} onValueChange={(value) => 
                                setGeneralSettings({ ...generalSettings, specialHintsIcon: value as any })
                              }>
                                <SelectTrigger className="bg-white dark:bg-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">🚫 Kein Icon</SelectItem>
                                  <SelectItem value="ArrowRightLeft">🔄 Pfeil Wechsel</SelectItem>
                                  <SelectItem value="AlertTriangle">⚠️ Warnung</SelectItem>
                                  <SelectItem value="XCircle">❌ Fehler</SelectItem>
                                  <SelectItem value="AlertCircle">⭕ Alert</SelectItem>
                                  <SelectItem value="Info">ℹ️ Info</SelectItem>
                                  <SelectItem value="Bookmark">🔖 Lesezeichen</SelectItem>
                                  <SelectItem value="Share2">📤 Teilen</SelectItem>
                                  <SelectItem value="Clock">⏰ Zeit</SelectItem>
                                  <SelectItem value="CheckCircle">✅ Häkchen</SelectItem>
                                  <SelectItem value="Star">⭐ Stern</SelectItem>
                                  <SelectItem value="Heart">❤️ Herz</SelectItem>
                                  <SelectItem value="Bell">🔔 Glocke</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              Standard-Beschreibung
                            </label>
                            <Textarea
                              value={generalSettings.specialHintsDescription}
                              onChange={(e) => setGeneralSettings({ ...generalSettings, specialHintsDescription: e.target.value })}
                              placeholder="Die neue URL wurde automatisch generiert. Es kann sein, dass sie nicht wie erwartet funktioniert. Falls die URL ungültig ist, nutze bitte die Suchfunktion in der neuen Applikation, um den gewünschten Inhalt zu finden."
                              rows={3}
                              className={`bg-white dark:bg-gray-700 ${!generalSettings.specialHintsDescription?.trim() ? 'border-red-500 focus:border-red-500' : ''}`}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Wird angezeigt, wenn keine passende URL-Regel aktiv ist
                            </p>
                          </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. Additional Information */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b pb-3">
                          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-sm font-semibold">4</div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">Zusätzliche Informationen</h3>
                            <p className="text-sm text-muted-foreground">Wird nur angezeigt wenn mindestens ein Info-Punkt konfiguriert ist</p>
                          </div>
                        </div>
                        <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-6 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Titel der Sektion
                              </label>
                              <Input
                                value={generalSettings.infoTitle}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, infoTitle: e.target.value })}
                                placeholder="Zusätzliche Informationen"
                                className="bg-white dark:bg-gray-700"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Überschrift für den Bereich mit zusätzlichen Informationen
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Icon für den Titel
                              </label>
                              <Select value={generalSettings.infoTitleIcon} onValueChange={(value) => 
                                setGeneralSettings({ ...generalSettings, infoTitleIcon: value as any })
                              }>
                                <SelectTrigger className="bg-white dark:bg-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">🚫 Kein Icon</SelectItem>
                                  <SelectItem value="ArrowRightLeft">🔄 Pfeil Wechsel</SelectItem>
                                  <SelectItem value="AlertTriangle">⚠️ Warnung</SelectItem>
                                  <SelectItem value="XCircle">❌ Fehler</SelectItem>
                                  <SelectItem value="AlertCircle">⭕ Alert</SelectItem>
                                  <SelectItem value="Info">ℹ️ Info</SelectItem>
                                  <SelectItem value="Bookmark">🔖 Lesezeichen</SelectItem>
                                  <SelectItem value="Share2">📤 Teilen</SelectItem>
                                  <SelectItem value="Clock">⏰ Zeit</SelectItem>
                                  <SelectItem value="CheckCircle">✅ Häkchen</SelectItem>
                                  <SelectItem value="Star">⭐ Stern</SelectItem>
                                  <SelectItem value="Heart">❤️ Herz</SelectItem>
                                  <SelectItem value="Bell">🔔 Glocke</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Informations-Punkte
                              </label>
                              <p className="text-xs text-gray-500 mb-2">
                                Liste von Stichpunkten die unter dem Info-Text angezeigt werden
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addInfoItem}
                                className="flex items-center gap-2 bg-white dark:bg-gray-700"
                              >
                                <Plus className="h-4 w-4" />
                                <span>Hinzufügen</span>
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {generalSettings.infoItems.map((item, index) => (
                                <div key={index} className="flex gap-3 items-center p-3 bg-white dark:bg-gray-700 rounded-lg border">
                                  <div className="flex-1">
                                    <Input
                                      value={item}
                                      onChange={(e) => handleInfoItemChange(index, e.target.value)}
                                      placeholder={`Informationspunkt ${index + 1}`}
                                      className="border-0 bg-transparent focus:ring-1 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="w-36">
                                    <Select 
                                      value={generalSettings.infoIcons[index] || "Info"} 
                                      onValueChange={(value) => handleInfoIconChange(index, value)}
                                    >
                                      <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Bookmark">🔖 Bookmark</SelectItem>
                                        <SelectItem value="Share2">📤 Share</SelectItem>
                                        <SelectItem value="Clock">⏰ Clock</SelectItem>
                                        <SelectItem value="Info">ℹ️ Info</SelectItem>
                                        <SelectItem value="CheckCircle">✅ Check</SelectItem>
                                        <SelectItem value="Star">⭐ Star</SelectItem>
                                        <SelectItem value="Heart">❤️ Heart</SelectItem>
                                        <SelectItem value="Bell">🔔 Bell</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeInfoItem(index)}
                                    className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              {generalSettings.infoItems.length === 0 && (
                                <div className="text-center p-8 bg-white dark:bg-gray-700 rounded-lg border border-dashed">
                                  <p className="text-sm text-muted-foreground">
                                    Keine Info-Punkte vorhanden. Klicken Sie "Hinzufügen" um welche zu erstellen.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 5. Footer Settings */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b pb-3">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-900/30 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 text-sm font-semibold">5</div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">Footer</h3>
                            <p className="text-sm text-muted-foreground">Copyright und Fußzeile der Anwendung</p>
                          </div>
                        </div>
                        <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-6 space-y-6">
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              Copyright-Text <span className="text-red-500">*</span>
                            </label>
                            <Input
                              value={generalSettings.footerCopyright}
                              onChange={(e) => setGeneralSettings({ ...generalSettings, footerCopyright: e.target.value })}
                              placeholder="Proudly brewed with Generative AI."
                              className={`bg-white dark:bg-gray-700 ${!generalSettings.footerCopyright?.trim() ? 'border-red-500 focus:border-red-500' : ''}`}
                            />
                          </div>
                          

                        </div>
                      </div>

                      {/* 6. Auto-Redirect Settings */}
                      <div className="space-y-6 mt-8">
                      <div className="flex items-center gap-3 border-b pb-3">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm font-semibold">6</div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">Automatische Weiterleitung</h3>
                          <p className="text-sm text-muted-foreground">Globale Einstellungen für automatische Weiterleitungen</p>
                        </div>
                      </div>
                      <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-6 space-y-6">
                        <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                            <div>
                              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Globale Auto-Weiterleitung</p>
                              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                Aktiviert die sofortige automatische Weiterleitung für alle Besucher
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={generalSettings.autoRedirect}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setPendingAutoRedirectValue(true);
                                setShowAutoRedirectDialog(true);
                              } else {
                                setGeneralSettings({ ...generalSettings, autoRedirect: false });
                              }
                            }}
                            className="data-[state=checked]:bg-yellow-600"
                          />
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                              <p className="font-medium">Wichtiger Hinweis:</p>
                              <p>Bei aktivierter automatischer Weiterleitung können Benutzer die Admin-Einstellungen nur noch über den URL-Parameter <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-xs">?admin=true</code> erreichen.</p>
                              <p><strong>Beispiel:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-xs">{getCurrentBaseUrl()}?admin=true</code></p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="border-t pt-6 mt-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Speichern Sie Ihre Änderungen um sie auf der Website anzuwenden.
                          </p>
                        </div>
                        <Button 
                          type="submit" 
                          size="lg"
                          className="min-w-48 px-6"
                          disabled={updateSettingsMutation.isPending}
                        >
                          {updateSettingsMutation.isPending ? "Speichere..." : "Einstellungen speichern"}
                        </Button>
                      </div>
                    </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rules Tab */}
            <TabsContent value="rules">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                    <div className="flex-1">
                      <CardTitle className="text-lg sm:text-xl">URL-Transformationsregeln</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        Verwalten Sie URL-Transformations-Regeln für die Migration.
                      </p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      {/* Bulk Delete Button */}
                      {selectedRuleIds.length > 0 && (
                        <Button 
                          onClick={handleBulkDelete}
                          size="sm"
                          variant="destructive"
                          className="flex-1 sm:flex-initial"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {selectedRuleIds.length} löschen
                        </Button>
                      )}
                      
                      {/* Create New Rule Button */}
                      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            onClick={resetRuleForm}
                            size="sm"
                            className="flex-1 sm:flex-initial sm:w-auto"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Neue Regel
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-lg sm:text-xl">
                            {editingRule ? "Regel bearbeiten" : "Neue Regel erstellen"}
                          </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmitRule} className="space-y-4 sm:space-y-6">
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              URL-Pfad Matcher
                            </label>
                            <Input
                              placeholder="/news-beitrag"
                              value={ruleForm.matcher}
                              onChange={(e) => setRuleForm(prev => ({ ...prev, matcher: e.target.value }))}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Ziel-URL (optional)
                            </label>
                            <Input
                              placeholder="https://thisisthenewurl.com/news"
                              value={ruleForm.targetUrl}
                              onChange={(e) => setRuleForm(prev => ({ ...prev, targetUrl: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Redirect-Typ
                            </label>
                            <Select
                              value={ruleForm.redirectType}
                              onValueChange={(value: "wildcard" | "partial") => 
                                setRuleForm(prev => ({ ...prev, redirectType: value }))
                              }
                            >
                              <SelectTrigger className="h-auto min-h-[40px]">
                                <SelectValue>
                                  {ruleForm.redirectType === "partial" && "Teilweise"}
                                  {ruleForm.redirectType === "wildcard" && "Vollständig"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="min-w-[480px] max-w-[600px]">
                                <SelectItem value="partial" className="p-3">
                                  <div className="flex flex-col space-y-1">
                                    <span className="font-medium text-sm">Teilweise</span>
                                    <span className="text-xs text-muted-foreground leading-relaxed">
                                      Nur die Pfadsegmente ab dem Matcher werden ersetzt. Base URL aus den generellen Einstellungen wird verwendet. Zusätzliche Pfadsegmente, Parameter und Anker bleiben erhalten.
                                    </span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="wildcard" className="p-3">
                                  <div className="flex flex-col space-y-1">
                                    <span className="font-medium text-sm">Vollständig</span>
                                    <span className="text-xs text-muted-foreground leading-relaxed">
                                      Alte Links werden komplett auf die neue Ziel-URL umgeleitet. Keine Bestandteile der alten URL werden übernommen – weder Pfadsegmente noch Parameter oder Anker.
                                    </span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Info-Text (Markdown)
                            </label>
                            <Textarea
                              placeholder="Nachrichtenbeiträge wurden migriert..."
                              value={ruleForm.infoText}
                              onChange={(e) => setRuleForm(prev => ({ ...prev, infoText: e.target.value }))}
                              rows={3}
                            />
                          </div>
                          <div className="border-t pt-4">
                            <div className="flex items-start space-x-3">
                              <Switch
                                checked={ruleForm.autoRedirect}
                                onCheckedChange={(checked) => setRuleForm(prev => ({ ...prev, autoRedirect: checked }))}
                              />
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Automatische Weiterleitung für diese Regel
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Wenn aktiviert, werden Benutzer für URLs, die dieser Regel entsprechen, automatisch weitergeleitet.
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                            <Button 
                              type="submit" 
                              className="flex-1"
                              size="sm"
                              disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
                            >
                              {editingRule ? "Aktualisieren" : "Erstellen"}
                            </Button>
                            <Button 
                              type="button" 
                              variant="secondary" 
                              size="sm"
                              className="flex-1"
                              onClick={() => setIsRuleDialogOpen(false)}
                            >
                              Abbrechen
                            </Button>
                          </div>
                        </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Search Controls - Always visible */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        ref={rulesSearchInputRef}
                        placeholder="Regeln durchsuchen..."
                        value={rulesSearchQuery}
                        onChange={(e) => setRulesSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    {/* Results Count and Status */}
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <div>
                        {rulesLoading ? (
                          "Lade Regeln..."
                        ) : debouncedRulesSearchQuery ? (
                          `${totalRules} von ${paginatedRulesData?.totalAllRules || totalRules} Regel${totalRules !== 1 ? 'n' : ''} gefunden`
                        ) : (
                          `${paginatedRulesData?.totalAllRules || totalRules} Regel${(paginatedRulesData?.totalAllRules || totalRules) !== 1 ? 'n' : ''} insgesamt`
                        )}
                        {rulesSearchQuery !== debouncedRulesSearchQuery && (
                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">Suche...</span>
                        )}
                      </div>
                      {!rulesLoading && totalFilteredRules > 0 && (
                        <div>
                          Seite {rulesPage} von {totalPages}
                        </div>
                      )}
                    </div>

                    {/* Content Area */}
                    {rulesLoading ? (
                      <div className="text-center py-8">Lade Regeln...</div>
                    ) : rules.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {debouncedRulesSearchQuery ? (
                          <>
                            Keine Regeln für "{debouncedRulesSearchQuery}" gefunden.
                            <br />
                            <span className="text-xs mt-1 block">Versuchen Sie einen anderen Suchbegriff oder erstellen Sie eine neue Regel.</span>
                          </>
                        ) : (
                          "Keine Regeln vorhanden. Erstellen Sie eine neue Regel."
                        )}
                      </div>
                    ) : (
                      <>
                      {/* Desktop Table View - Hidden on mobile/tablet */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-3 px-4 w-12">
                                <input
                                  type="checkbox"
                                  checked={
                                    paginatedRules.length > 0 && 
                                    selectedRuleIds.length > 0 &&
                                    paginatedRules.every(rule => selectedRuleIds.includes(rule.id))
                                  }
                                  onChange={(e) => handleSelectAllRules(e.target.checked)}
                                  className="rounded border border-gray-300 focus:ring-2 focus:ring-blue-500"
                                  title="Alle Regeln auf dieser Seite auswählen/abwählen"
                                />
                              </th>
                              <th className="text-left py-3 px-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 font-medium text-sm hover:bg-transparent"
                                  onClick={() => handleRulesSort('matcher')}
                                >
                                  <span className="flex items-center gap-1">
                                    URL-Pfad Matcher
                                    {rulesSortBy === 'matcher' && (
                                      rulesSortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                    )}
                                  </span>
                                </Button>
                              </th>
                              <th className="text-left py-3 px-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 font-medium text-sm hover:bg-transparent"
                                  onClick={() => handleRulesSort('targetUrl')}
                                >
                                  <span className="flex items-center gap-1">
                                    Ziel-URL
                                    {rulesSortBy === 'targetUrl' && (
                                      rulesSortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                    )}
                                  </span>
                                </Button>
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                                Typ
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                                Auto-Redirect
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                                Info-Text
                              </th>
                              <th className="text-left py-3 px-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 font-medium text-sm hover:bg-transparent"
                                  onClick={() => handleRulesSort('createdAt')}
                                >
                                  <span className="flex items-center gap-1">
                                    Erstellt am
                                    {rulesSortBy === 'createdAt' && (
                                      rulesSortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                    )}
                                  </span>
                                </Button>
                              </th>
                              <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                                Aktionen
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedRules.map((rule: UrlRule) => (
                              <tr key={rule.id} className="border-b border-border hover:bg-muted/50">
                                <td className="py-3 px-4 w-12">
                                  <input
                                    type="checkbox"
                                    checked={selectedRuleIds.includes(rule.id)}
                                    onChange={() => handleSelectRule(rule.id)}
                                    className="rounded border border-gray-300 focus:ring-2 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant="secondary">{rule.matcher}</Badge>
                                </td>
                                <td className="py-3 px-4 text-sm">
                                  {rule.targetUrl ? (
                                    <code className="text-xs bg-muted px-2 py-1 rounded">
                                      {rule.targetUrl}
                                    </code>
                                  ) : (
                                    <span className="italic text-muted-foreground">
                                      Automatisch generiert
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant={(rule as any).redirectType === 'wildcard' ? 'destructive' : 'default'}>
                                    {(rule as any).redirectType === 'wildcard' ? 'Vollständig' : 'Teilweise'}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant={rule.autoRedirect ? 'default' : 'secondary'}>
                                    {rule.autoRedirect ? '✓ Aktiv' : '✗ Inaktiv'}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                  {rule.infoText ? rule.infoText.substring(0, 50) + "..." : "-"}
                                </td>
                                <td className="py-3 px-4 text-xs text-muted-foreground">
                                  {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString('de-DE') : '-'}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditRule(rule)}
                                      title="Bearbeiten"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-destructive hover:text-destructive"
                                          title="Löschen"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Regel löschen</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Sind Sie sicher, dass Sie diese Regel löschen möchten?
                                            Diese Aktion kann nicht rückgängig gemacht werden.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Löschen
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile/Tablet Sort Controls - Hidden on desktop */}
                      <div className="lg:hidden flex flex-wrap gap-2 pb-4 border-b border-border">
                        <Button
                          variant={rulesSortBy === 'matcher' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleRulesSort('matcher')}
                          className="text-xs"
                        >
                          URL-Pfad
                          {rulesSortBy === 'matcher' && (
                            rulesSortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                        <Button
                          variant={rulesSortBy === 'targetUrl' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleRulesSort('targetUrl')}
                          className="text-xs"
                        >
                          Ziel-URL
                          {rulesSortBy === 'targetUrl' && (
                            rulesSortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                        <Button
                          variant={rulesSortBy === 'createdAt' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleRulesSort('createdAt')}
                          className="text-xs"
                        >
                          Erstellt am
                          {rulesSortBy === 'createdAt' && (
                            rulesSortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                      </div>
                      
                      {/* Mobile/Tablet Card Layout - Hidden on desktop */}
                      <div className="lg:hidden space-y-3">
                        {/* Multi-select info for mobile users */}
                        {paginatedRules.length > 1 && (
                          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                              <Info className="h-4 w-4 flex-shrink-0" />
                              <span>
                                <strong>Hinweis:</strong> Das Auswählen und Löschen mehrerer Regeln ist nur auf Desktop-Geräten verfügbar.
                              </span>
                            </div>
                          </div>
                        )}

                        {paginatedRules.map((rule: UrlRule) => (
                          <div key={rule.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                            {/* Header with Matcher and Actions */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1 min-w-0">
                                <Badge variant="secondary" className="mb-2 text-xs">
                                  {rule.matcher}
                                </Badge>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant={(rule as any).redirectType === 'wildcard' ? 'destructive' : 'default'} className="text-xs">
                                    {(rule as any).redirectType === 'wildcard' ? 'Vollständig' : 'Teilweise'}
                                  </Badge>
                                  <Badge variant={rule.autoRedirect ? 'default' : 'secondary'} className="text-xs">
                                    {rule.autoRedirect ? '✓ Auto-Redirect' : '✗ Manuell'}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex space-x-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditRule(rule)}
                                  title="Bearbeiten"
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                      title="Löschen"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Regel löschen</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Sind Sie sicher, dass Sie diese Regel löschen möchten?
                                        Diese Aktion kann nicht rückgängig gemacht werden.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Löschen
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                            
                            {/* Target URL */}
                            <div className="mb-3">
                              <div className="text-xs text-muted-foreground mb-1">Ziel-URL:</div>
                              {rule.targetUrl ? (
                                <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                                  {rule.targetUrl}
                                </code>
                              ) : (
                                <span className="text-xs italic text-muted-foreground">
                                  Automatisch generiert
                                </span>
                              )}
                            </div>
                            
                            {/* Info Text */}
                            {rule.infoText && (
                              <div className="mb-3">
                                <div className="text-xs text-muted-foreground mb-1">Info-Text:</div>
                                <p className="text-xs text-foreground break-words">
                                  {rule.infoText.length > 100 ? rule.infoText.substring(0, 100) + "..." : rule.infoText}
                                </p>
                              </div>
                            )}
                            
                            {/* Created Date */}
                            <div className="text-xs text-muted-foreground">
                              Erstellt: {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString('de-DE') : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRulesPage(1)}
                              disabled={rulesPage === 1}
                            >
                              Erste
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRulesPage(rulesPage - 1)}
                              disabled={rulesPage === 1}
                            >
                              Vorherige
                            </Button>
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            Zeige {startIndex + 1}-{Math.min(endIndex, totalFilteredRules)} von {totalFilteredRules}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRulesPage(rulesPage + 1)}
                              disabled={rulesPage === totalPages}
                            >
                              Nächste
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRulesPage(totalPages)}
                              disabled={rulesPage === totalPages}
                            >
                              Letzte
                            </Button>
                          </div>
                        </div>
                      )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="stats" className="space-y-6">
              {/* Statistics View Navigation */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={statsView === 'top100' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatsViewChange('top100')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Top 100
                  </Button>
                  <Button
                    variant={statsView === 'referrers' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatsViewChange('referrers')}
                  >
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Top 100 Referrer
                  </Button>
                  <Button
                    variant={statsView === 'browser' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatsViewChange('browser')}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Alle Einträge
                  </Button>
                </div>

                {/* Time filter for top100 and referrers */}
                {(statsView === 'top100' || statsView === 'referrers') && (
                  <Select value={statsFilter} onValueChange={(value) => setStatsFilter(value as '24h' | '7d' | 'all')}>
                    <SelectTrigger className="w-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">Letzte 24h</SelectItem>
                      <SelectItem value="7d">Letzte 7 Tage</SelectItem>
                      <SelectItem value="all">Alle Zeit</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Search for browser view */}
                {statsView === 'browser' && (
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <input
                      ref={statsSearchInputRef}
                      type="text"
                      placeholder="Einträge suchen..."
                      value={statsSearchQuery}
                      onChange={(e) => setStatsSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full border border-input rounded-md bg-background text-sm"
                    />
                  </div>
                )}

                {/* Search and pagination info for paginated views */}
                {(statsView === 'top100' || statsView === 'referrers' || statsView === 'browser') && (
                  <div className="flex justify-between items-center text-sm text-muted-foreground mt-4">
                    <div>
                      {statsView === 'top100' && (
                        top100Loading ? (
                          "Lade URLs..."
                        ) : (
                          `${totalTopUrls} URL${totalTopUrls !== 1 ? 's' : ''} insgesamt`
                        )
                      )}
                      {statsView === 'referrers' && (
                        referrersLoading ? (
                          "Lade Referrer..."
                        ) : (
                          `${totalReferrers} Referrer insgesamt`
                        )
                      )}
                      {statsView === 'browser' && (
                        entriesLoading ? (
                          "Lade Einträge..."
                        ) : debouncedStatsSearchQuery ? (
                          `${totalStatsEntries} von ${totalAllStatsEntries} Eintrag${totalStatsEntries !== 1 ? 'e' : ''} gefunden`
                        ) : (
                          `${totalAllStatsEntries} Eintrag${totalAllStatsEntries !== 1 ? 'e' : ''} insgesamt`
                        )
                      )}
                      {statsView === 'browser' && statsSearchQuery !== debouncedStatsSearchQuery && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">Suche...</span>
                      )}
                    </div>
                    {!entriesLoading && !top100Loading && !referrersLoading && (
                      <div>
                        {statsView === 'top100' && totalTopUrlsPages > 1 && `Seite ${statsPage} von ${totalTopUrlsPages}`}
                        {statsView === 'referrers' && totalReferrersPages > 1 && `Seite ${statsPage} von ${totalReferrersPages}`}
                        {statsView === 'browser' && totalStatsPages > 1 && `Seite ${statsPage} von ${totalStatsPages}`}
                      </div>
                    )}
                  </div>
                )}
              </div>



              {/* Top 100 View */}
              {statsView === 'top100' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top URLs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {top100Loading ? (
                      <div className="text-center py-8">Lade URLs...</div>
                    ) : !topUrlsData?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Keine URL-Aufrufe vorhanden.
                      </div>
                    ) : (
                      <>
                        <div className="overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-muted/50 border-b">
                              <tr>
                                <th className="text-left p-3 font-medium">Rang</th>
                                <th className="text-left p-3 font-medium">URL-Pfad</th>
                                <th className="text-right p-3 font-medium">Aufrufe</th>
                                <th className="text-left p-3 font-medium">Anteil</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topUrlsData.map((url, index) => {
                                const rank = index + 1;
                                const maxCount = topUrlsData[0]?.count || 1;
                                return (
                                  <tr key={index} className="border-b hover:bg-muted/50">
                                    <td className="p-3 text-sm font-medium">#{rank}</td>
                                    <td className="p-3">
                                      <code className="text-sm text-foreground">{url.path}</code>
                                    </td>
                                    <td className="p-3 text-right text-sm font-medium">{url.count}</td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16">
                                          <Progress value={(url.count / maxCount) * 100} className="h-2" />
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          {((url.count / maxCount) * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Top 100 Referrers View */}
              {statsView === 'referrers' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top Referrer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {referrersLoading ? (
                      <div className="text-center py-8">Lade Referrer-Statistiken...</div>
                    ) : !referrersPagedData?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Keine Referrer-Daten vorhanden.
                      </div>
                    ) : (
                      <>
                        <div className="overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-muted/50 border-b">
                              <tr>
                                <th className="text-left p-3 font-medium">Rang</th>
                                <th className="text-left p-3 font-medium">HTTP Referrer</th>
                                <th className="text-right p-3 font-medium">Aufrufe</th>
                                <th className="text-left p-3 font-medium">Anteil</th>
                              </tr>
                            </thead>
                            <tbody>
                              {referrersPagedData.map((referrer: any, index: number) => {
                                const rank = index + 1;
                                const maxCount = referrersPagedData[0]?.count || 1;
                                return (
                                  <tr key={index} className="border-b hover:bg-muted/50">
                                    <td className="p-3 text-sm font-medium">#{rank}</td>
                                    <td className="p-3">
                                      <code className="text-sm text-foreground break-all">
                                        {referrer.referrer === 'Direkt' ? (
                                          <span className="text-muted-foreground">Direkt (kein Referrer)</span>
                                        ) : (
                                          referrer.referrer
                                        )}
                                      </code>
                                    </td>
                                    <td className="p-3 text-right text-sm font-medium">{referrer.count}</td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16">
                                          <Progress value={(referrer.count / maxCount) * 100} className="h-2" />
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          {((referrer.count / maxCount) * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Comprehensive Tracking Browser */}
              {statsView === 'browser' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Alle Tracking-Einträge</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {entriesLoading ? (
                      <div className="text-center py-8">Lade Einträge...</div>
                    ) : !trackingEntries?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {statsSearchQuery ? `Keine Einträge für "${statsSearchQuery}" gefunden.` : 'Keine Tracking-Einträge vorhanden.'}
                      </div>
                    ) : (
                      <>
                        <div className="overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-muted/50 border-b">
                              <tr>
                                <th className="text-left p-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('timestamp')}
                                    className="h-auto p-0 font-medium hover:bg-transparent"
                                  >
                                    Zeitstempel
                                    {getSortIcon('timestamp')}
                                  </Button>
                                </th>
                                <th className="text-left p-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('oldUrl')}
                                    className="h-auto p-0 font-medium hover:bg-transparent"
                                  >
                                    Alte URL
                                    {getSortIcon('oldUrl')}
                                  </Button>
                                </th>
                                <th className="text-left p-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('newUrl')}
                                    className="h-auto p-0 font-medium hover:bg-transparent"
                                  >
                                    Neue URL
                                    {getSortIcon('newUrl')}
                                  </Button>
                                </th>
                                <th className="text-left p-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('path')}
                                    className="h-auto p-0 font-medium hover:bg-transparent"
                                  >
                                    Pfad
                                    {getSortIcon('path')}
                                  </Button>
                                </th>
                                <th className="text-left p-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSort('httpReferrer')}
                                    className="h-auto p-0 font-medium hover:bg-transparent"
                                  >
                                    HTTP Referer
                                    {getSortIcon('httpReferrer')}
                                  </Button>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {trackingEntries.map((entry: any) => (
                                <tr key={entry.id} className="border-b hover:bg-muted/50">
                                  <td className="p-3 text-sm">
                                    {formatTimestamp(entry.timestamp)}
                                  </td>
                                  <td className="p-3">
                                    <code className="text-xs text-foreground break-all">
                                      {entry.oldUrl}
                                    </code>
                                  </td>
                                  <td className="p-3">
                                    <code className="text-xs text-foreground break-all">
                                      {entry.newUrl || 'N/A'}
                                    </code>
                                  </td>
                                  <td className="p-3">
                                    <code className="text-sm text-foreground">{entry.path}</code>
                                  </td>
                                  <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                                    {entry.httpReferrer || 'Direkt'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Pagination Controls for Browser View */}
                        {totalStatsPages > 1 && (
                          <div className="flex justify-between items-center mt-4 pt-4 border-t">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStatsPage(1)}
                                disabled={statsPage === 1}
                              >
                                Erste
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStatsPage(statsPage - 1)}
                                disabled={statsPage === 1}
                              >
                                Vorherige
                              </Button>
                            </div>
                            
                            <div className="text-sm text-muted-foreground">
                              Zeige {statsStartIndex + 1}-{Math.min(statsEndIndex, totalStatsEntries)} von {debouncedStatsSearchQuery ? totalStatsEntries : totalAllStatsEntries}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStatsPage(statsPage + 1)}
                                disabled={statsPage === totalStatsPages}
                              >
                                Nächste
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStatsPage(totalStatsPages)}
                                disabled={statsPage === totalStatsPages}
                              >
                                Letzte
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

            </TabsContent>

            {/* Export Tab */}
            <TabsContent value="export">
              <Card>
                <CardHeader>
                  <CardTitle>Daten exportieren</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-6">
                    Exportieren Sie Ihre Tracking-Daten und Konfigurationen für weitere Analysen oder Backups.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 border border-border rounded-lg">
                      <h3 className="font-medium text-foreground mb-2 flex items-center">
                        <BarChart3 className="text-primary mr-2" />
                        Statistiken exportieren
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Alle Tracking-Daten und URL-Aufrufe
                      </p>
                      <div className="space-y-2">
                        <Button 
                          className="w-full" 
                          onClick={() => handleExport('statistics', 'csv')}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Als CSV herunterladen
                        </Button>
                        <Button 
                          variant="secondary" 
                          className="w-full"
                          onClick={() => handleExport('statistics', 'json')}
                        >
                          <Database className="h-4 w-4 mr-2" />
                          Als JSON herunterladen
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 border border-border rounded-lg">
                      <h3 className="font-medium text-foreground mb-2 flex items-center">
                        <Settings className="text-primary mr-2" />
                        URL-Regeln exportieren
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Alle konfigurierten URL-Transformationsregeln. 
                        <a 
                          href="/sample-rules-import.json" 
                          download 
                          className="text-primary hover:underline ml-1"
                        >
                          Beispieldatei herunterladen
                        </a>
                      </p>
                      <div className="space-y-2">
                        <Button 
                          className="w-full"
                          onClick={() => handleExport('rules')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Regeln exportieren
                        </Button>
                        <div className="relative">
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleImportFile}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            id="import-rules-file"
                          />
                          <Button 
                            variant="secondary" 
                            className="w-full"
                            disabled={importMutation.isPending}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {importMutation.isPending ? 'Importiere...' : 'Regeln importieren'}
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2 p-3 bg-muted/50 rounded-lg">
                          <div className="font-medium mb-1">Import-Verhalten:</div>
                          <ul className="space-y-1">
                            <li>• <strong>Mit ID:</strong> Bestehende Regel mit gleicher ID wird aktualisiert</li>
                            <li>• <strong>Ohne ID:</strong> Prüfung auf gleichen Matcher - bei Übereinstimmung wird aktualisiert, sonst neue Regel erstellt</li>
                            <li>• <strong>Bestehende Regeln:</strong> Bleiben erhalten (kein Überschreiben oder Löschen)</li>
                            <li>• <strong>Ergebnis:</strong> Additive Ergänzung + Updates bei Übereinstimmungen</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mt-6">
                    <div className="p-4 border border-border rounded-lg">
                      <h3 className="font-medium text-foreground mb-2 flex items-center">
                        <Settings className="text-primary mr-2" />
                        Allgemeine Einstellungen exportieren
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Alle Texte, Icons und Styling-Einstellungen der Migration-Anwendung
                      </p>
                      <div className="space-y-2">
                        <Button 
                          className="w-full"
                          onClick={() => handleExport('settings')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Einstellungen exportieren
                        </Button>
                        <div className="relative">
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleImportSettingsFile}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            id="import-settings-file"
                          />
                          <Button 
                            variant="secondary" 
                            className="w-full"
                            disabled={importSettingsMutation.isPending}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {importSettingsMutation.isPending ? 'Importiere...' : 'Einstellungen importieren'}
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2 p-3 bg-muted/50 rounded-lg">
                          <div className="font-medium mb-1">Import-Verhalten:</div>
                          <ul className="space-y-1">
                            <li>• <strong>Vollständiger Import:</strong> Alle Einstellungen werden komplett überschrieben</li>
                            <li>• <strong>Texte & Styling:</strong> Titel, Beschreibungen, Farben, Icons werden ersetzt</li>
                            <li>• <strong>Bestehende Werte:</strong> Werden vollständig durch importierte Werte ersetzt</li>
                            <li>• <strong>Backup empfohlen:</strong> Exportieren Sie vorher Ihre aktuellen Einstellungen</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Auto-Redirect Confirmation Dialog */}
      <Dialog open={showAutoRedirectDialog} onOpenChange={setShowAutoRedirectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Wichtiger Hinweis
            </DialogTitle>
            <DialogDescription className="sr-only">
              Bestätigung für die Aktivierung der automatischen Weiterleitung
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sie sind dabei, die automatische sofortige Weiterleitung für alle Besucher und alle URLs zu aktivieren. Besucher werden so automatisch sofort zur neuen URL ohne Anzeige der Seite weitergeleitet.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                  <p className="font-medium">Wichtiger Hinweis:</p>
                  <p>Bei aktivierter automatischer Weiterleitung können Benutzer die Admin-Einstellungen nur noch über den URL-Parameter <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-xs">?admin=true</code> erreichen.</p>
                  <p><strong>Beispiel:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-xs">{getCurrentBaseUrl()}?admin=true</code></p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAutoRedirectDialog(false);
                setPendingAutoRedirectValue(false);
              }}
              className="w-full sm:w-auto"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={() => {
                setGeneralSettings({ ...generalSettings, autoRedirect: pendingAutoRedirectValue });
                setShowAutoRedirectDialog(false);
                setPendingAutoRedirectValue(false);
              }}
              className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700"
            >
              Ich habe verstanden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Warning Dialog */}
      <AlertDialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <AlertDialogHeader className="flex-shrink-0">
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Validierungswarnung
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-sm">
              Möchten Sie die Regel trotz der folgenden Warnung(en) speichern?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex-1 min-h-0 my-4">
            <div className="max-h-60 overflow-y-auto border rounded-md p-3 bg-muted/50">
              <div className="text-sm text-foreground whitespace-pre-wrap">
                {validationError}
              </div>
            </div>
          </div>
          
          <AlertDialogFooter className="flex-shrink-0">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceSave}
              disabled={forceCreateRuleMutation.isPending || forceUpdateRuleMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {(forceCreateRuleMutation.isPending || forceUpdateRuleMutation.isPending) 
                ? 'Speichere...' 
                : 'Trotzdem speichern'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regeln löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie die ausgewählten {selectedRuleIds.length} {selectedRuleIds.length === 1 ? 'Regel' : 'Regeln'} löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
              <br /><br />
              <strong>Hinweis:</strong> Es werden nur die auf der aktuellen Seite ausgewählten Regeln gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Critical fix: Only delete rules that are on current page
                const currentPageRuleIds = paginatedRules.map(rule => rule.id);
                const safeRuleIds = selectedRuleIds.filter(id => currentPageRuleIds.includes(id));
                console.log('DIALOG DELETE: Filtering selected rules for safety', {
                  originalSelected: selectedRuleIds.length,
                  safeSelected: safeRuleIds.length,
                  pageRules: currentPageRuleIds.length
                });
                bulkDeleteRulesMutation.mutate(safeRuleIds);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteRulesMutation.isPending}
            >
              {bulkDeleteRulesMutation.isPending ? 'Lösche...' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
