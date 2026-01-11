import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DebouncedInput } from "@/components/ui/debounced-input";
import { Textarea } from "@/components/ui/textarea";
import { DebouncedTextarea } from "@/components/ui/debounced-textarea";
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

  Database,
  BarChart3,
  Settings,
  FileText,
  FileJson,
  List,
  LogOut,
  Trash,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  AlertTriangle,
  Info,
  CheckCircle,
  FileSpreadsheet,
  Filter,
  Share2
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { CardDescription } from "@/components/ui/card";
import { RulesTable } from "@/components/admin/RulesTable";
import { RulesCardList } from "@/components/admin/RulesCardList";
import { ImportPreviewTable } from "@/components/admin/ImportPreviewTable";
import { StatsTable } from "@/components/admin/StatsTable";

import type { UrlRule, GeneralSettings } from "@shared/schema";

// --- Types ---

interface ParsedRuleResult {
  rule: Partial<UrlRule>;
  isValid: boolean;
  errors: string[];
  status: 'new' | 'update' | 'invalid';
}

interface ImportPreviewData {
  total: number;
  limit: number;
  isLimited: boolean;
  preview: ParsedRuleResult[];
  all?: ParsedRuleResult[];
  counts: {
    new: number;
    update: number;
    invalid: number;
  };
}

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
    redirectType: "partial" as "wildcard" | "partial" | "domain",
    autoRedirect: false,
    discardQueryParams: false,
    forwardQueryParams: false,
  });
  const targetUrlPlaceholder =
    ruleForm.redirectType === "wildcard"
      ? "https://beispiel.com/neue-seite"
      : ruleForm.redirectType === "domain"
        ? "https://neue-domain.com"
        : "/neue-seite";
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

  // Delete all rules state
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [deleteAllConfirmationText, setDeleteAllConfirmationText] = useState("");

  // Delete all stats state
  const [showDeleteAllStatsDialog, setShowDeleteAllStatsDialog] = useState(false);
  const [deleteAllStatsConfirmationText, setDeleteAllStatsConfirmationText] = useState("");

  // Clear blocked IPs state
  const [showClearBlockedIpsDialog, setShowClearBlockedIpsDialog] = useState(false);
  const [clearBlockedIpsConfirmationText, setClearBlockedIpsConfirmationText] = useState("");

  // Manage blocked IPs state
  const [showManageBlockedIpsDialog, setShowManageBlockedIpsDialog] = useState(false);
  const [newBlockedIp, setNewBlockedIp] = useState("");

  // Statistics pagination state
  const [statsPage, setStatsPage] = useState(1);
  const [statsPerPage] = useState(50); // Fixed page size for performance
  const [statsSearchQuery, setStatsSearchQuery] = useState("");
  const [debouncedStatsSearchQuery, setDebouncedStatsSearchQuery] = useState("");
  const [statsRuleFilter, setStatsRuleFilter] = useState<'all' | 'with_rule' | 'no_rule'>('all');
  const [statsQualityFilter, setStatsQualityFilter] = useState<string>("all");
  const [statsFeedbackFilter, setStatsFeedbackFilter] = useState<'all' | 'OK' | 'NOK' | 'empty'>('all');
  const statsSearchInputRef = useRef<HTMLInputElement>(null);

  // Responsive state
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  useEffect(() => {
    const checkScreen = () => setIsLargeScreen(window.matchMedia("(min-width: 1024px)").matches);
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Import Preview State
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<ImportPreviewData | null>(null);
  const [previewLimit, setPreviewLimit] = useState(50);
  const [showAllPreview, setShowAllPreview] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);

  // Import Preview Sorting & Filtering
  const [previewSortBy, setPreviewSortBy] = useState<'status' | 'matcher' | 'targetUrl'>('status');
  const [previewSortOrder, setPreviewSortOrder] = useState<'asc' | 'desc'>('asc');
  const [previewStatusFilter, setPreviewStatusFilter] = useState<'all' | 'new' | 'update' | 'invalid'>('all');

  const filteredPreviewData = useMemo(() => {
    if (!importPreviewData) return [];

    // Use all data if available, otherwise fallback to preview data (for initial limited view)
    const sourceData = importPreviewData.all || importPreviewData.preview || [];
    let filtered = [...sourceData]; // Copy to sort

    // Filter
    if (previewStatusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === previewStatusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let valA = '', valB = '';
      if (previewSortBy === 'status') {
         valA = a.status;
         valB = b.status;
      } else if (previewSortBy === 'matcher') {
         valA = a.rule.matcher || '';
         valB = b.rule.matcher || '';
      } else if (previewSortBy === 'targetUrl') {
         valA = a.rule.targetUrl || '';
         valB = b.rule.targetUrl || '';
      }

      if (valA < valB) return previewSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return previewSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [importPreviewData, previewStatusFilter, previewSortBy, previewSortOrder]);

  const [generalSettings, setGeneralSettings] = useState({
    headerTitle: "URL Migration Tool",
    headerIcon: "ArrowRightLeft" as "ArrowLeftRight" | "ArrowRightLeft" | "AlertTriangle" | "XCircle" | "AlertCircle" | "Info" | "Bookmark" | "Share2" | "Clock" | "CheckCircle" | "Star" | "Heart" | "Bell" | "none",
    headerLogoUrl: "" as string | undefined,
    headerBackgroundColor: "#ffffff",
    popupMode: "active" as "active" | "inline" | "disabled",
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
    caseSensitiveLinkDetection: false,
    encodeImportedUrls: true,
    autoRedirect: false,
    showLinkQualityGauge: true,
    matchHighExplanation: "Die neue URL entspricht exakt der angeforderten Seite oder ist die Startseite. Höchste Qualität.",
    matchMediumExplanation: "Die URL wurde erkannt, weicht aber leicht ab (z.B. zusätzliche Parameter).",
    matchLowExplanation: "Es wurde nur ein Teil der URL erkannt und ersetzt (Partial Match).",
    matchRootExplanation: "Startseite erkannt. Direkte Weiterleitung auf die neue Domain.",
    matchNoneExplanation: "Die URL konnte nicht spezifisch zugeordnet werden. Es wird auf die Standard-Seite weitergeleitet.",
    enableTrackingCache: true,
    enableReferrerTracking: true,
    defaultRedirectMode: "domain" as "domain" | "search",
    defaultSearchUrl: "" as string | undefined | null,
    defaultSearchMessage: "Keine direkte Übereinstimmung gefunden. Sie werden zur Suche weitergeleitet.",
  });

  // Statistics filters and state
  const [statsFilter, setStatsFilter] = useState('all' as '24h' | '7d' | 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statsView, setStatsView] = useState<'top100' | 'browser'>(() => {
    // Only restore stats view if we're explicitly showing admin view
    const showAdmin = localStorage.getItem('showAdminView') === 'true';
    return showAdmin ? ((localStorage.getItem('adminStatsView') as 'top100' | 'browser') || 'top100') : 'top100';
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
  const handleStatsViewChange = (newView: 'top100' | 'browser') => {
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

  // Top Referrers
  const { data: topReferrersData, isLoading: topReferrersLoading } = useQuery<Array<{ domain: string; count: number }>>({
    queryKey: ["/api/admin/stats/top-referrers", statsFilter],
    enabled: isAuthenticated && statsView === 'top100',
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statsFilter !== 'all') {
        params.append('timeRange', statsFilter);
      }
      const url = `/api/admin/stats/top-referrers${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) {
        setIsAuthenticated(false);
        throw new Error('Authentication required');
      }
      if (!response.ok) throw new Error('Failed to fetch top referrers');
      return response.json();
    },
  });


  // Paginated tracking entries with search and sort
  const { data: paginatedEntriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ["/api/admin/stats/entries/paginated", statsPage, statsPerPage, debouncedStatsSearchQuery, sortBy, sortOrder, statsRuleFilter, statsQualityFilter, statsFeedbackFilter],
    enabled: isAuthenticated && statsView === 'browser',
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: statsPage.toString(),
        limit: statsPerPage.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder,
        ruleFilter: statsRuleFilter,
        feedbackFilter: statsFeedbackFilter,
      });

      // Parse quality filter
      if (statsQualityFilter !== "all") {
        if (statsQualityFilter === "100") {
          params.append("minQuality", "100");
        } else if (statsQualityFilter === "75") {
          params.append("minQuality", "75");
          params.append("maxQuality", "75");
        } else if (statsQualityFilter === "50") {
          params.append("minQuality", "50");
          params.append("maxQuality", "50");
        } else if (statsQualityFilter === "0") {
          params.append("maxQuality", "0");
        }
      }
      
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
        popupMode: settingsData.popupMode || "active",
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
        caseSensitiveLinkDetection: settingsData.caseSensitiveLinkDetection ?? false,
        encodeImportedUrls: settingsData.encodeImportedUrls ?? true,
        autoRedirect: settingsData.autoRedirect || false,
        showLinkQualityGauge: settingsData.showLinkQualityGauge ?? true,
        matchHighExplanation: settingsData.matchHighExplanation || "Die neue URL entspricht exakt der angeforderten Seite oder ist die Startseite. Höchste Qualität.",
        matchMediumExplanation: settingsData.matchMediumExplanation || "Die URL wurde erkannt, weicht aber leicht ab (z.B. zusätzliche Parameter).",
        matchLowExplanation: settingsData.matchLowExplanation || "Es wurde nur ein Teil der URL erkannt und ersetzt (Partial Match).",
        matchRootExplanation: settingsData.matchRootExplanation || "Startseite erkannt. Direkte Weiterleitung auf die neue Domain.",
        matchNoneExplanation: settingsData.matchNoneExplanation || "Die URL konnte nicht spezifisch zugeordnet werden. Es wird auf die Standard-Seite weitergeleitet.",
        enableTrackingCache: settingsData.enableTrackingCache ?? true,
        enableReferrerTracking: settingsData.enableReferrerTracking ?? true,
        defaultRedirectMode: settingsData.defaultRedirectMode || "domain",
        defaultSearchUrl: settingsData.defaultSearchUrl || "",
        defaultSearchMessage: settingsData.defaultSearchMessage || "Keine direkte Übereinstimmung gefunden. Sie werden zur Suche weitergeleitet.",
        enableFeedbackSurvey: settingsData.enableFeedbackSurvey ?? false,
        feedbackSurveyTitle: settingsData.feedbackSurveyTitle || "Hat die Weiterleitung funktioniert?",
        feedbackSurveyQuestion: settingsData.feedbackSurveyQuestion || "Bitte bewerten Sie die Zielseite.",
        feedbackSuccessMessage: settingsData.feedbackSuccessMessage || "Danke für Ihr Feedback!",
        feedbackButtonYes: settingsData.feedbackButtonYes || "Ja, OK",
        feedbackButtonNo: settingsData.feedbackButtonNo || "Nein",
      });
    }
  }, [settingsData]);

  // Mutations
  const createRuleMutation = useMutation({
    mutationFn: (rule: typeof ruleForm) => 
      apiRequest("POST", "/api/admin/rules", rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/entries/paginated"] });
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
      toast({
        title: "Regel gelöscht",
        description: "1 Regel wurde erfolgreich gelöscht.",
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
        title: "Fehler", 
        description: "Die Regel konnte nicht gelöscht werden.",
        variant: "destructive" 
      });
    },
  });

  // Delete all stats mutation
  const deleteAllStatsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/admin/all-stats");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/entries/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/top100"] });
      setShowDeleteAllStatsDialog(false);
      setDeleteAllStatsConfirmationText("");
      toast({
        title: "Alle Statistiken gelöscht",
        description: "Alle Tracking-Daten wurden erfolgreich gelöscht.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Löschen aller Statistiken.",
        variant: "destructive",
      });
    },
  });

  // Clear blocked IPs mutation
  const clearBlockedIpsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/admin/blocked-ips");
      return await response.json();
    },
    onSuccess: () => {
      setShowClearBlockedIpsDialog(false);
      setClearBlockedIpsConfirmationText("");
      toast({
        title: "Blockierte IPs gelöscht",
        description: "Alle blockierten IP-Adressen wurden erfolgreich gelöscht.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Löschen der blockierten IPs.",
        variant: "destructive",
      });
    },
  });

  // Fetch blocked IPs
  const { data: blockedIps, isLoading: blockedIpsLoading, refetch: refetchBlockedIps } = useQuery({
    queryKey: ["/api/admin/blocked-ips"],
    enabled: isAuthenticated && showManageBlockedIpsDialog,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/admin/blocked-ips", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch blocked IPs");
      return response.json() as Promise<Array<{ ip: string; attempts: number; blockedUntil: number }>>;
    },
  });

  // Block IP mutation
  const blockIpMutation = useMutation({
    mutationFn: async (ip: string) => {
      return await apiRequest("POST", "/api/admin/blocked-ips", { ip });
    },
    onSuccess: () => {
      setNewBlockedIp("");
      refetchBlockedIps();
      toast({ title: "IP blockiert", description: "Die IP-Adresse wurde erfolgreich blockiert." });
    },
    onError: (error: any) => {
       toast({ title: "Fehler", description: error.message || "IP konnte nicht blockiert werden.", variant: "destructive" });
    }
  });

  // Unblock IP mutation
  const unblockIpMutation = useMutation({
    mutationFn: async (ip: string) => {
      return await apiRequest("DELETE", `/api/admin/blocked-ips/${ip}`);
    },
    onSuccess: () => {
      refetchBlockedIps();
      toast({ title: "IP entsperrt", description: "Die IP-Adresse wurde erfolgreich entsperrt." });
    },
    onError: (error: any) => {
       toast({ title: "Fehler", description: error.message || "IP konnte nicht entsperrt werden.", variant: "destructive" });
    }
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
      const response = await apiRequest("DELETE", "/api/admin/bulk-delete-rules", { ruleIds: validRuleIds });
      return await response.json();
    },
    onSuccess: (result, ruleIds) => {
      const deletedCount = result.deletedCount || 0;
      const failedCount = (result.failedCount || 0) + (result.notFoundCount || 0);
      const totalRequested = result.totalRequested || ruleIds.length;

      if (failedCount > 0) {
        toast({
          title: "Teilweise gelöscht",
          description: `${deletedCount} von ${totalRequested} ${totalRequested === 1 ? 'Regel wurde' : 'Regeln wurden'} erfolgreich gelöscht. ${failedCount} konnten nicht gelöscht werden.`,
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
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
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


  const importSettingsMutation = useMutation({
    mutationFn: (settings: any) => 
      apiRequest("POST", "/api/admin/import/settings", { settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
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
    setRuleForm({ matcher: "", targetUrl: "", infoText: "", redirectType: "partial", autoRedirect: false, discardQueryParams: false, forwardQueryParams: false });
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

  const handleRulesSort = useCallback((column: 'matcher' | 'targetUrl' | 'createdAt') => {
    if (rulesSortBy === column) {
      setRulesSortOrder(rulesSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setRulesSortBy(column);
      setRulesSortOrder('asc');
    }
  }, [rulesSortBy, rulesSortOrder]);

  const handleSubmitRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, rule: ruleForm });
    } else {
      createRuleMutation.mutate(ruleForm);
    }
  };

  const handleEditRule = useCallback((rule: UrlRule) => {
    setEditingRule(rule);
    setRuleForm({
      matcher: rule.matcher,
      targetUrl: rule.targetUrl || "",
      infoText: rule.infoText || "",
      redirectType: rule.redirectType || "partial",
      autoRedirect: rule.autoRedirect || false,
      discardQueryParams: rule.discardQueryParams || false,
      forwardQueryParams: rule.forwardQueryParams || false,
    });
    setIsRuleDialogOpen(true);
  }, []);

  const handleDeleteRule = useCallback((ruleId: string) => {
    deleteRuleMutation.mutate(ruleId);
  }, [deleteRuleMutation]);

  // Multi-select handlers
  const handleSelectRule = useCallback((ruleId: string) => {
    setSelectedRuleIds(prev => 
      prev.includes(ruleId) 
        ? prev.filter(id => id !== ruleId)
        : [...prev, ruleId]
    );
  }, []);

  const handleSelectAllRules = useCallback((checked: boolean) => {
    if (checked) {
      // Only select rules from the current page to avoid selecting all rules in storage
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
  }, [paginatedRules]);

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
        const extension = format === 'csv' ? 'csv' : (format === 'xlsx' || format === 'excel' ? 'xlsx' : 'json');
        a.download = `${type}.${extension}`;
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
    updateSettingsMutation.mutate(generalSettings, {
      onSuccess: () => {
        toast({ title: "Einstellungen gespeichert", description: "Die allgemeinen Einstellungen wurden erfolgreich aktualisiert." });
      }
    });
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
  const previewMutation = useMutation({
    mutationFn: async ({ file, all = false }: { file: File; all?: boolean }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/admin/import/preview?all=${all}`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to preview file");
      }
      return await response.json();
    },
    onSuccess: (data: ImportPreviewData) => {
      setImportPreviewData(data);
      setShowPreviewDialog(true);
      setShowAllPreview(false); // Reset to default view
      setPreviewLimit(50);
    },
    onError: (error: any) => {
      toast({
        title: "Vorschau fehlgeschlagen",
        description: error.message || "Die Datei konnte nicht gelesen werden.",
        variant: "destructive",
      });
    }
  });

  const importMutation = useMutation({
    mutationFn: async (rules: any[]) => {
      const response = await apiRequest("POST", "/api/admin/import/rules", { rules });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      setShowPreviewDialog(false);
      setImportPreviewData(null);

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

      // Handle PayloadTooLargeError (413) specifically
      if (error?.status === 413 || error?.message?.includes('too large')) {
        toast({
          title: "Datei zu groß",
          description: "Die Import-Datei ist zu groß. Bitte teilen Sie die Datei in kleinere Dateien auf (z.B. max 50.000 Regeln pro Datei).",
          variant: "destructive",
          duration: 10000
        });
        return;
      }

      toast({
        title: "Import fehlgeschlagen",
        description: error?.message || "Die Regeln konnten nicht importiert werden. Überprüfen Sie das Dateiformat.",
        variant: "destructive"
      });
    },
  });

  // Cache rebuild mutation
  const rebuildCacheMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/force-cache-rebuild");
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cache neu aufgebaut",
        description: "Der Regel-Cache wurde erfolgreich neu erstellt.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler beim Cache-Neuaufbau",
        description: error.message || "Der Cache konnte nicht neu erstellt werden.",
        variant: "destructive",
      });
    },
  });

  // Delete all rules mutation
  const deleteAllRulesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/admin/all-rules");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      setShowDeleteAllDialog(false);
      setDeleteAllConfirmationText("");
      toast({
        title: "Alle Regeln gelöscht",
        description: "Alle URL-Regeln wurden erfolgreich gelöscht.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Löschen aller Regeln.",
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
    return (
      <>
        <AdminAuthForm
          onAuthenticated={() => {
            setIsAuthenticated(true);
            setIsCheckingAuth(false);
          }}
          onClose={onClose}
        />
        <Toaster />
      </>
    );
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

  const maxCount = statsData?.topUrls?.[0]?.count || 1;

  const handlePreview = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedImportFile(file);
    previewMutation.mutate({ file, all: false });

    event.target.value = ''; // Reset input
  };

  const handlePreviewSort = (column: 'status' | 'matcher' | 'targetUrl') => {
    if (previewSortBy === column) {
      setPreviewSortOrder(previewSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPreviewSortBy(column);
      setPreviewSortOrder('asc');
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreviewData) return;

    let allRules = importPreviewData.all;

    // If we don't have the full dataset yet (because we only fetched a preview),
    // we need to fetch it now before importing.
    if (!allRules && selectedImportFile) {
      try {
        const fullData = await previewMutation.mutateAsync({
          file: selectedImportFile,
          all: true
        });
        allRules = fullData.all;
        // Update state to reflect we have all data now
        setImportPreviewData(fullData);
      } catch (error) {
        // Error handling is done in mutation
        return;
      }
    }

    if (!allRules) {
      toast({
        title: "Import Fehler",
        description: "Konnte die vollständigen Daten für den Import nicht laden.",
        variant: "destructive"
      });
      return;
    }

    // Map parsed results to the format expected by the API
    const rulesToImport = allRules
      .filter(r => r.isValid)
      .map(r => r.rule);

    importMutation.mutate(rulesToImport);
  };

  // Old JSON Import (Advanced)
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("ACHTUNG: Dies ist der Experten-Import. Bestehende Regeln mit gleicher ID werden überschrieben. Fortfahren?")) {
      event.target.value = '';
      return;
    }

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
                aria-label={logoutMutation.isPending ? "Abmelden..." : "Abmelden"}
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {logoutMutation.isPending ? "Abmelden..." : "Abmelden"}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Schließen"
              >
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
                  <Database className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="truncate leading-tight text-center">System & Daten</span>
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
                              <DebouncedInput
                                value={generalSettings.headerTitle}
                                onChange={(val) => setGeneralSettings({ ...generalSettings, headerTitle: val as string })}
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
                                <DebouncedInput
                                  value={generalSettings.headerBackgroundColor}
                                  onChange={(val) => setGeneralSettings({ ...generalSettings, headerBackgroundColor: val as string })}
                                  placeholder="#ffffff"
                                  className="flex-1 bg-white dark:bg-gray-700 font-mono text-sm"
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Logo Upload Section */}
                          <div className="pt-4">
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
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              PopUp-Anzeige
                            </label>
                            <Select value={generalSettings.popupMode} onValueChange={(value) =>
                              setGeneralSettings({ ...generalSettings, popupMode: value as any })
                            }>
                              <SelectTrigger className="bg-white dark:bg-gray-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Aktiv</SelectItem>
                                <SelectItem value="inline">Inline</SelectItem>
                                <SelectItem value="disabled">Deaktiviert</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className={`${generalSettings.popupMode === 'disabled' ? 'opacity-50 pointer-events-none' : ''} space-y-4 sm:space-y-6`}>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Titel <span className="text-red-500">*</span>
                              </label>
                              <DebouncedInput
                                value={generalSettings.mainTitle}
                                onChange={(val) => setGeneralSettings({ ...generalSettings, mainTitle: val as string })}
                                placeholder="URL veraltet - Aktualisierung erforderlich"
                                className={`bg-white dark:bg-gray-700 ${!generalSettings.mainTitle?.trim() ? 'border-red-500 focus:border-red-500' : ''}`}
                                disabled={generalSettings.popupMode === 'disabled'}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Icon
                              </label>
                              <Select value={generalSettings.alertIcon} onValueChange={(value) =>
                                setGeneralSettings({ ...generalSettings, alertIcon: value as any })
                              } disabled={generalSettings.popupMode === 'disabled'}>
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
                            <DebouncedTextarea
                              value={generalSettings.mainDescription}
                              onChange={(val) => setGeneralSettings({ ...generalSettings, mainDescription: val as string })}
                              placeholder="Du verwendest einen alten Link. Dieser Link ist nicht mehr aktuell und wird bald nicht mehr funktionieren. Bitte verwende die neue URL und aktualisiere deine Verknüpfungen."
                              rows={3}
                              className={`bg-white dark:bg-gray-700 ${!generalSettings.mainDescription?.trim() ? 'border-red-500 focus:border-red-500' : ''}`}
                              disabled={generalSettings.popupMode === 'disabled'}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Erklärt dem Nutzer die Situation und warum die neue URL verwendet werden sollte
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              PopUp Button-Text
                            </label>
                            <DebouncedInput
                              value={generalSettings.popupButtonText}
                              onChange={(val) => setGeneralSettings({ ...generalSettings, popupButtonText: val as string })}
                              placeholder="Zeige mir die neue URL"
                              className="bg-white dark:bg-gray-700"
                              disabled={generalSettings.popupMode === 'disabled'}
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
                              } disabled={generalSettings.popupMode === 'disabled'}>
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
                                  disabled={generalSettings.popupMode === 'disabled'}
                                />
                                <DebouncedInput
                                  value={generalSettings.mainBackgroundColor}
                                  onChange={(val) => setGeneralSettings({ ...generalSettings, mainBackgroundColor: val as string })}
                                  placeholder="#ffffff"
                                  className="flex-1 bg-white dark:bg-gray-700 font-mono text-sm"
                                  disabled={generalSettings.popupMode === 'disabled'}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      </div>

                      {/* 3. Routing & Fallback Behavior */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b pb-3">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm font-semibold">3</div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">Routing & Fallback-Verhalten</h3>
                            <p className="text-sm text-muted-foreground">Konfiguration des Verhaltens bei fehlender exakter Übereinstimmung</p>
                          </div>
                        </div>
                        <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-6 space-y-6">
                          
                          {/* Field 1: Target Domain */}
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                              Ziel-Domain (Standard neue Domain) <span className="text-red-500">*</span>
                            </label>
                            <DebouncedInput
                              value={generalSettings.defaultNewDomain}
                              onChange={(value) => setGeneralSettings({ ...generalSettings, defaultNewDomain: value as string })}
                              placeholder="https://thisisthenewurl.com/"
                              className={`bg-white dark:bg-gray-700 ${!generalSettings.defaultNewDomain ? 'border-red-500' : ''}`}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Verwendet für Partial Matches und spezifische Regeln.
                            </p>
                          </div>

                          {/* Field 2: Fallback Strategy */}
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Fallback-Strategie
                            </label>
                            <Select
                                value={generalSettings.defaultRedirectMode}
                                onValueChange={(value) =>
                                    setGeneralSettings({ ...generalSettings, defaultRedirectMode: value as "domain" | "search" })
                                }
                            >
                                <SelectTrigger className="h-auto min-h-[40px] bg-white dark:bg-gray-700">
                                    <SelectValue>
                                        {generalSettings.defaultRedirectMode === "domain" && "Einfacher Domain-Austausch"}
                                        {generalSettings.defaultRedirectMode === "search" && "Intelligente Such-Weiterleitung"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="w-[calc(100vw-2rem)] sm:w-[var(--radix-select-trigger-width)]">
                                    <SelectItem value="domain" className="pl-8 pr-3 py-3 items-start">
                                        <div className="flex flex-col space-y-1">
                                            <span className="font-medium text-sm">Einfacher Domain-Austausch</span>
                                            <span className="text-xs text-muted-foreground leading-relaxed">
                                                Standard-Verhalten: Ersetzt die alte Domain durch die neue "Target Domain". Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Ideal wenn die Struktur der Seite gleich bleibt.
                                            </span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="search" className="pl-8 pr-3 py-3 items-start">
                                        <div className="flex flex-col space-y-1">
                                            <span className="font-medium text-sm">Intelligente Such-Weiterleitung</span>
                                            <span className="text-xs text-muted-foreground leading-relaxed">
                                                Intelligenter Fallback: Leitet auf eine interne Suchseite weiter, wenn keine Regel greift. Verwendet das letzte Pfadsegment der alten URL automatisch als Suchbegriff für die neue Seite.
                                            </span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500 mt-1">
                                Definiert was passiert, wenn KEINE Regel (Exakt oder Partial) greift.
                            </p>
                          </div>

                          {/* Field 3: Search Base URL (Conditional) */}
                          {generalSettings.defaultRedirectMode === 'search' && (
                              <div>
                                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                  Such-Basis-URL <span className="text-red-500">*</span>
                                </label>
                                <DebouncedInput
                                  value={generalSettings.defaultSearchUrl || ''}
                                  onChange={(value) => setGeneralSettings({ ...generalSettings, defaultSearchUrl: value as string })}
                                  placeholder="https://newapp.com/?q="
                                  className={`bg-white dark:bg-gray-700 ${!generalSettings.defaultSearchUrl ? 'border-red-500' : ''}`}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Beispiel: https://newapp.com/?q=
                                </p>
                              </div>
                          )}

                           {/* Field 4: Fallback Info Messages (Grouped) */}
                           <div className="border-t pt-4 mt-4">
                                <h4 className="text-sm font-medium mb-4">Fallback-Info-Nachrichten</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Special Hints Title & Icon (Moved from Visualization) */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Spezielle Hinweise - Titel</label>
                                        <DebouncedInput value={generalSettings.specialHintsTitle} onChange={(val) => setGeneralSettings({...generalSettings, specialHintsTitle: val as string})} className="bg-white dark:bg-gray-700"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Spezielle Hinweise - Icon</label>
                                         <Select value={generalSettings.specialHintsIcon} onValueChange={(val) => setGeneralSettings({...generalSettings, specialHintsIcon: val as any})}>
                                            <SelectTrigger className="bg-white dark:bg-gray-700"><SelectValue /></SelectTrigger>
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

                                    {/* Standard Info Text */}
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                            Standard Info Text (Beschreibung)
                                        </label>
                                        <DebouncedTextarea
                                            value={generalSettings.specialHintsDescription}
                                            onChange={(value) => setGeneralSettings({ ...generalSettings, specialHintsDescription: value as string })}
                                            rows={3}
                                            className="bg-white dark:bg-gray-700"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Angezeigt wenn eine Regel matched aber keinen spezifischen Text hat.
                                        </p>
                                    </div>

                                    {/* Smart Search Message */}
                                    {generalSettings.defaultRedirectMode === 'search' && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                            Smart Search Nachricht
                                        </label>
                                        <DebouncedTextarea
                                            value={generalSettings.defaultSearchMessage}
                                            onChange={(value) => setGeneralSettings({ ...generalSettings, defaultSearchMessage: value as string })}
                                            rows={3}
                                            className="bg-white dark:bg-gray-700"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Angezeigt NUR wenn "Intelligente Such-Weiterleitung" ausgelöst wird (keine Regel matched).
                                        </p>
                                    </div>
                                    )}
                                </div>
                           </div>

                           {/* Visualization Settings */}
                           <div className="mt-6 pt-6 border-t border-dashed">
                               <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4">Visualisierung</h4>
                               <div className="space-y-6">
                                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                                       <div>
                                           <label className="block text-sm font-medium mb-2">Titel</label>
                                           <DebouncedInput value={generalSettings.urlComparisonTitle} onChange={(val) => setGeneralSettings({...generalSettings, urlComparisonTitle: val as string})} className="bg-white dark:bg-gray-700"/>
                                       </div>
                                       <div>
                                         <label className="block text-sm font-medium mb-2">Icon</label>
                                         <Select value={generalSettings.urlComparisonIcon} onValueChange={(val) => setGeneralSettings({...generalSettings, urlComparisonIcon: val as any})}>
                                            <SelectTrigger className="bg-white dark:bg-gray-700"><SelectValue /></SelectTrigger>
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
                                       <div>
                                          <label className="block text-sm font-medium mb-2">Hintergrundfarbe</label>
                                          <div className="flex items-center gap-3">
                                              <input type="color" value={generalSettings.urlComparisonBackgroundColor} onChange={(e) => setGeneralSettings({...generalSettings, urlComparisonBackgroundColor: e.target.value})} className="w-20 h-10 p-1 rounded-md border cursor-pointer"/>
                                              <DebouncedInput value={generalSettings.urlComparisonBackgroundColor} onChange={(val) => setGeneralSettings({...generalSettings, urlComparisonBackgroundColor: val as string})} className="flex-1 bg-white dark:bg-gray-700 font-mono text-sm"/>
                                          </div>
                                       </div>
                                   </div>

                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                       <div>
                                           <label className="block text-sm font-medium mb-2">Label für alte URL</label>
                                           <DebouncedInput value={generalSettings.oldUrlLabel} onChange={(val) => setGeneralSettings({...generalSettings, oldUrlLabel: val as string})} className="bg-white dark:bg-gray-700"/>
                                       </div>
                                       <div>
                                           <label className="block text-sm font-medium mb-2">Label für neue URL</label>
                                           <DebouncedInput value={generalSettings.newUrlLabel} onChange={(val) => setGeneralSettings({...generalSettings, newUrlLabel: val as string})} className="bg-white dark:bg-gray-700"/>
                                       </div>
                                   </div>
                               </div>

                               {/* Link Quality Gauge */}
                               <div className="mt-6 space-y-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                 <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                     <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                     <div>
                                       <p className="text-sm font-medium text-green-800 dark:text-green-200">Link-Qualitätstacho anzeigen</p>
                                     </div>
                                   </div>
                                   <Switch
                                     checked={generalSettings.showLinkQualityGauge}
                                     onCheckedChange={(checked) =>
                                       setGeneralSettings({ ...generalSettings, showLinkQualityGauge: checked })
                                     }
                                     className="data-[state=checked]:bg-green-600"
                                   />
                                 </div>

                                 {generalSettings.showLinkQualityGauge && (
                                   <div className="pt-4 mt-4 border-t border-green-200 dark:border-green-800 space-y-4">
                                     <div>
                                       <label className="block text-sm font-medium mb-1 text-green-800 dark:text-green-200">Text für hohe Übereinstimmung (100%)</label>
                                       <DebouncedInput value={generalSettings.matchHighExplanation} onChange={(val) => setGeneralSettings({ ...generalSettings, matchHighExplanation: val as string })} className="bg-white dark:bg-gray-800" />
                                     </div>
                                     <div>
                                       <label className="block text-sm font-medium mb-1 text-green-800 dark:text-green-200">Text für mittlere Übereinstimmung (75%)</label>
                                       <DebouncedInput value={generalSettings.matchMediumExplanation} onChange={(val) => setGeneralSettings({ ...generalSettings, matchMediumExplanation: val as string })} className="bg-white dark:bg-gray-800" />
                                     </div>
                                     <div>
                                       <label className="block text-sm font-medium mb-1 text-green-800 dark:text-green-200">Text für geringe Übereinstimmung (50%)</label>
                                       <DebouncedInput value={generalSettings.matchLowExplanation} onChange={(val) => setGeneralSettings({ ...generalSettings, matchLowExplanation: val as string })} className="bg-white dark:bg-gray-800" />
                                     </div>
                                     <div>
                                       <label className="block text-sm font-medium mb-1 text-green-800 dark:text-green-200">Text für Startseiten-Treffer (100%)</label>
                                       <DebouncedInput value={generalSettings.matchRootExplanation} onChange={(val) => setGeneralSettings({ ...generalSettings, matchRootExplanation: val as string })} className="bg-white dark:bg-gray-800" />
                                     </div>
                                     <div>
                                       <label className="block text-sm font-medium mb-1 text-green-800 dark:text-green-200">Text für keine Übereinstimmung (0%)</label>
                                       <DebouncedInput value={generalSettings.matchNoneExplanation} onChange={(val) => setGeneralSettings({ ...generalSettings, matchNoneExplanation: val as string })} className="bg-white dark:bg-gray-800" />
                                     </div>
                                   </div>
                                 )}
                               </div>

                               {/* Action Buttons */}
                               <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <div>
                                       <label className="block text-sm font-medium mb-2">Button-Text "URL kopieren"</label>
                                       <DebouncedInput value={generalSettings.copyButtonText} onChange={(val) => setGeneralSettings({ ...generalSettings, copyButtonText: val as string })} className="bg-white dark:bg-gray-700" />
                                     </div>
                                     <div>
                                       <label className="block text-sm font-medium mb-2">Button-Text "In neuem Tab öffnen"</label>
                                       <DebouncedInput value={generalSettings.openButtonText} onChange={(val) => setGeneralSettings({ ...generalSettings, openButtonText: val as string })} className="bg-white dark:bg-gray-700" />
                                     </div>
                                   </div>
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
                              <DebouncedInput
                                value={generalSettings.infoTitle}
                                onChange={(val) => setGeneralSettings({ ...generalSettings, infoTitle: val as string })}
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
                                    <DebouncedInput
                                      value={item}
                                      onChange={(val) => handleInfoItemChange(index, val as string)}
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
                                    aria-label={`Information ${index + 1} entfernen`}
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
                            <DebouncedInput
                              value={generalSettings.footerCopyright}
                              onChange={(val) => setGeneralSettings({ ...generalSettings, footerCopyright: val as string })}
                              placeholder="Proudly brewed with Generative AI."
                              className={`bg-white dark:bg-gray-700 ${!generalSettings.footerCopyright?.trim() ? 'border-red-500 focus:border-red-500' : ''}`}
                            />
                          </div>
                          

                        </div>
                      </div>

                      {/* 6. Link Detection & Performance Settings */}
                      <div className="space-y-6 mt-8">
                        <div className="flex items-center gap-3 border-b pb-3">
                          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 text-sm font-semibold">6</div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">Link-Erkennung & Leistung</h3>
                            <p className="text-sm text-muted-foreground">Einstellungen zur Erkennungslogik und Systemleistung</p>
                          </div>
                        </div>
                        <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-6 space-y-6">
                          {/* Case Sensitivity */}
                          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Search className="h-5 w-5 text-green-600 dark:text-green-400" />
                              <div>
                                <p className="text-sm font-medium text-green-800 dark:text-green-200">Groß-/Kleinschreibung beachten</p>
                                <p className="text-xs text-green-700 dark:text-green-300">
                                  Wenn aktiviert, werden Regeln nur bei exakt gleicher Schreibweise erkannt. Standard ist deaktiviert.
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={generalSettings.caseSensitiveLinkDetection}
                              onCheckedChange={(checked) =>
                                setGeneralSettings({ ...generalSettings, caseSensitiveLinkDetection: checked })
                              }
                              className="data-[state=checked]:bg-green-600"
                            />
                          </div>

                          {/* Referrer Tracking Toggle */}
                          <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Share2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              <div>
                                <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Referrer Tracking aktivieren</p>
                                <p className="text-xs text-purple-700 dark:text-purple-300">
                                  Erfasst die Herkunfts-URL (Referrer) der Besucher für statistische Auswertungen.
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={generalSettings.enableReferrerTracking}
                              onCheckedChange={(checked) =>
                                setGeneralSettings({ ...generalSettings, enableReferrerTracking: checked })
                              }
                              className="data-[state=checked]:bg-purple-600"
                            />
                          </div>

                          {/* Tracking Cache Toggle */}
                          <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Database className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              <div>
                                <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Tracking-Cache aktivieren (RAM)</p>
                                <p className="text-xs text-purple-700 dark:text-purple-300">
                                  Speichert Statistik-Daten im Arbeitsspeicher für schnellen Zugriff. Erhöht die Systemgeschwindigkeit massiv, benötigt aber mehr RAM bei vielen Daten.
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={generalSettings.enableTrackingCache}
                              onCheckedChange={(checked) =>
                                setGeneralSettings({ ...generalSettings, enableTrackingCache: checked })
                              }
                              className="data-[state=checked]:bg-purple-600"
                            />
                          </div>

                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                                <p className="font-medium">Empfehlung:</p>
                                <p>Lassen Sie den Tracking-Cache aktiviert (Standard), es sei denn, Ihr Server hat sehr wenig Arbeitsspeicher (&lt; 512MB) oder Sie haben extrem viele Tracking-Daten (&gt; 1 Mio. Einträge).</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 7. Automatic Redirect Settings */}
                      <div className="space-y-6 mt-8">
                        <div className="flex items-center gap-3 border-b pb-3">
                          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center text-yellow-600 dark:text-yellow-400 text-sm font-semibold">7</div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">Automatische Weiterleitung</h3>
                            <p className="text-sm text-muted-foreground">Globale Einstellungen für automatische Weiterleitungen</p>
                          </div>
                        </div>
                        <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-6 space-y-6">
                          <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <ArrowRightLeft className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                              <div>
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Automatische Weiterleitung aktivieren</p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                  Wenn aktiviert, werden alle Benutzer automatisch zur neuen URL weitergeleitet, ohne die Hinweisseite zu sehen.
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
                                <p className="font-medium">Admin-Zugriff:</p>
                                <p>Bei aktivierter automatischer Weiterleitung können Sie die Admin-Einstellungen nur noch über den Parameter <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">?admin=true</code> erreichen.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 8. User Feedback Survey */}
                      <div className="space-y-6 mt-8">
                        <div className="flex items-center gap-3 border-b pb-3">
                          <div className="w-8 h-8 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center text-pink-600 dark:text-pink-400 text-sm font-semibold">8</div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">Benutzer-Feedback-Umfrage</h3>
                            <p className="text-sm text-muted-foreground">Erfassen Sie Feedback von Nutzern zur Qualität der Weiterleitung</p>
                          </div>
                        </div>
                        <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-6 space-y-6">
                          <div className="flex items-center justify-between p-4 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <CheckCircle className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                              <div>
                                <p className="text-sm font-medium text-pink-800 dark:text-pink-200">Feedback-Umfrage aktivieren</p>
                                <p className="text-xs text-pink-700 dark:text-pink-300">
                                  Zeigt ein Popup an, wenn Nutzer auf "Kopieren" oder "Öffnen" klicken, um zu fragen, ob der Link funktioniert hat.
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={generalSettings.enableFeedbackSurvey}
                              onCheckedChange={(checked) =>
                                setGeneralSettings({ ...generalSettings, enableFeedbackSurvey: checked })
                              }
                              className="data-[state=checked]:bg-pink-600"
                            />
                          </div>

                          {generalSettings.enableFeedbackSurvey && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-2">Umfrage Titel <span className="text-red-500">*</span></label>
                                <DebouncedInput
                                  value={generalSettings.feedbackSurveyTitle}
                                  onChange={(val) => setGeneralSettings({ ...generalSettings, feedbackSurveyTitle: val as string })}
                                  className="bg-white dark:bg-gray-700"
                                  placeholder="War die neue URL korrekt?"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Umfrage Frage <span className="text-red-500">*</span></label>
                                <DebouncedInput
                                  value={generalSettings.feedbackSurveyQuestion}
                                  onChange={(val) => setGeneralSettings({ ...generalSettings, feedbackSurveyQuestion: val as string })}
                                  className="bg-white dark:bg-gray-700"
                                  placeholder="Dein Feedback hilft uns, die Weiterleitungen weiter zu verbessern."
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Erfolgsmeldung <span className="text-red-500">*</span></label>
                                <DebouncedInput
                                  value={generalSettings.feedbackSuccessMessage}
                                  onChange={(val) => setGeneralSettings({ ...generalSettings, feedbackSuccessMessage: val as string })}
                                  className="bg-white dark:bg-gray-700"
                                  placeholder="Vielen Dank für deine Rückmeldung."
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Button Ja (OK) <span className="text-red-500">*</span></label>
                                <DebouncedInput
                                  value={generalSettings.feedbackButtonYes}
                                  onChange={(val) => setGeneralSettings({ ...generalSettings, feedbackButtonYes: val as string })}
                                  className="bg-white dark:bg-gray-700"
                                  placeholder="Ja, OK"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Text auf dem Button für positive Rückmeldung (Standard: Ja, OK)</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Button Nein (NOK) <span className="text-red-500">*</span></label>
                                <DebouncedInput
                                  value={generalSettings.feedbackButtonNo}
                                  onChange={(val) => setGeneralSettings({ ...generalSettings, feedbackButtonNo: val as string })}
                                  className="bg-white dark:bg-gray-700"
                                  placeholder="Nein"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Text auf dem Button für negative Rückmeldung (Standard: Nein)</p>
                              </div>
                            </div>
                          )}
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
                      <Button
                        onClick={() => {
                          resetRuleForm();
                          setIsRuleDialogOpen(true);
                        }}
                        size="sm"
                        className="flex-1 sm:flex-initial sm:w-auto"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Neue Regel
                      </Button>
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
                        aria-label="Regeln durchsuchen"
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
                        {isLargeScreen ? (
                          <RulesTable
                            rules={paginatedRules}
                            selectedRuleIds={selectedRuleIds}
                            sortConfig={{ by: rulesSortBy, order: rulesSortOrder }}
                            onSort={handleRulesSort}
                            onSelectRule={handleSelectRule}
                            onSelectAll={handleSelectAllRules}
                            onEditRule={handleEditRule}
                            onDeleteRule={handleDeleteRule}
                          />
                        ) : (
                          <RulesCardList
                            rules={paginatedRules}
                            sortConfig={{ by: rulesSortBy, order: rulesSortOrder }}
                            onSort={handleRulesSort}
                            onEditRule={handleEditRule}
                            onDeleteRule={handleDeleteRule}
                          />
                        )}
                      
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
                    variant={statsView === 'browser' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatsViewChange('browser')}
                  >
                    <List className="h-4 w-4 mr-2" />
                    Alle Einträge
                  </Button>
                </div>
                {/* Time filter for top100 */}
                {statsView === 'top100' && (
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
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <input
                        ref={statsSearchInputRef}
                        type="text"
                        placeholder="Einträge suchen..."
                        value={statsSearchQuery}
                        onChange={(e) => setStatsSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full border border-input rounded-md bg-background text-sm"
                        aria-label="Statistiken durchsuchen"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={statsRuleFilter}
                        onValueChange={(value) => setStatsRuleFilter(value as 'all' | 'with_rule' | 'no_rule')}
                      >
                        <SelectTrigger className="w-auto h-9 text-xs">
                          <SelectValue placeholder="Regel-Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle Einträge</SelectItem>
                          <SelectItem value="with_rule">Nur mit Regeln</SelectItem>
                          <SelectItem value="no_rule">Nur ohne Regeln</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={statsQualityFilter}
                        onValueChange={(value) => setStatsQualityFilter(value)}
                      >
                        <SelectTrigger className="w-auto h-9 text-xs">
                          <SelectValue placeholder="Qualität" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle Qualitäten</SelectItem>
                          <SelectItem value="100">100% (Exakt)</SelectItem>
                          <SelectItem value="75">75% (Fast exakt)</SelectItem>
                          <SelectItem value="50">50% (Teilweise)</SelectItem>
                          <SelectItem value="0">0% (Kein Treffer)</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={statsFeedbackFilter}
                        onValueChange={(value) => setStatsFeedbackFilter(value as 'all' | 'OK' | 'NOK' | 'empty')}
                      >
                        <SelectTrigger className="w-auto h-9 text-xs">
                          <SelectValue placeholder="Feedback" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Alle Feedbacks</SelectItem>
                          <SelectItem value="OK">👍 OK</SelectItem>
                          <SelectItem value="NOK">👎 NOK</SelectItem>
                          <SelectItem value="empty">Kein Feedback</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Search and pagination info for paginated views */}
                {(statsView === 'top100' || statsView === 'browser') && (
                  <div className="flex w-full sm:w-auto justify-between items-center text-sm text-muted-foreground mt-4 sm:mt-0">
                    <div>
                      {statsView === 'top100' && (
                        top100Loading ? (
                          "Lade URLs..."
                        ) : (
                          `${totalTopUrls} URL${totalTopUrls !== 1 ? 's' : ''} insgesamt`
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
                    {!entriesLoading && !top100Loading && (
                      <div>
                        {statsView === 'top100' && totalTopUrlsPages > 1 && `Seite ${statsPage} von ${totalTopUrlsPages}`}
                        {statsView === 'browser' && totalStatsPages > 1 && `Seite ${statsPage} von ${totalStatsPages}`}
                      </div>
                    )}
                  </div>
                )}
              </div>



              {/* Top 100 View */}
              {statsView === 'top100' && (
                <div className={`grid grid-cols-1 ${generalSettings.enableReferrerTracking ? 'lg:grid-cols-2' : ''} gap-6`}>
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
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[300px]">
                              <thead className="bg-muted/50 border-b">
                                <tr>
                                  <th className="text-left p-2 sm:p-3 font-medium w-12">#</th>
                                  <th className="text-left p-2 sm:p-3 font-medium">URL-Pfad</th>
                                  <th className="text-right p-2 sm:p-3 font-medium w-20">Aufrufe</th>
                                  <th className="text-left p-2 sm:p-3 font-medium w-24">Anteil</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topUrlsData.map((url, index) => {
                                  const rank = index + 1;
                                  const maxCount = topUrlsData?.[0]?.count || 1;
                                  return (
                                    <tr key={index} className="border-b hover:bg-muted/50">
                                      <td className="p-2 sm:p-3 text-sm font-medium">#{rank}</td>
                                      <td className="p-2 sm:p-3">
                                        <code className="text-xs sm:text-sm text-foreground break-all">{url.path}</code>
                                      </td>
                                      <td className="p-2 sm:p-3 text-right text-sm font-medium">{url.count}</td>
                                      <td className="p-2 sm:p-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-12 sm:w-16">
                                            <Progress value={(url.count / maxCount) * 100} className="h-1.5 sm:h-2" />
                                          </div>
                                          <span className="text-[10px] sm:text-xs text-muted-foreground">
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

                  {/* Top Referrers Widget */}
                  {generalSettings.enableReferrerTracking && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Referrer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {topReferrersLoading ? (
                        <div className="text-center py-8">Lade Referrer...</div>
                      ) : !topReferrersData?.length ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Keine Referrer-Daten vorhanden.
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[300px]">
                              <thead className="bg-muted/50 border-b">
                                <tr>
                                  <th className="text-left p-2 sm:p-3 font-medium w-12">#</th>
                                  <th className="text-left p-2 sm:p-3 font-medium">Domain</th>
                                  <th className="text-right p-2 sm:p-3 font-medium w-20">Anzahl</th>
                                  <th className="text-left p-2 sm:p-3 font-medium w-24">Anteil</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topReferrersData.map((ref, index) => {
                                  const rank = index + 1;
                                  const maxRefCount = topReferrersData?.[0]?.count || 1;
                                  return (
                                    <tr key={index} className="border-b hover:bg-muted/50">
                                      <td className="p-2 sm:p-3 text-sm font-medium">#{rank}</td>
                                      <td className="p-2 sm:p-3">
                                        <div className="flex items-center gap-2">
                                          <img
                                            src={`https://www.google.com/s2/favicons?domain=${ref.domain}&sz=16`}
                                            alt=""
                                            className="w-4 h-4 opacity-70"
                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                          />
                                          <span className="text-xs sm:text-sm text-foreground truncate max-w-[150px] sm:max-w-[200px]" title={ref.domain}>
                                            {ref.domain}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="p-2 sm:p-3 text-right text-sm font-medium">{ref.count}</td>
                                      <td className="p-2 sm:p-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-12 sm:w-16">
                                            <Progress value={(ref.count / maxRefCount) * 100} className="h-1.5 sm:h-2" />
                                          </div>
                                          <span className="text-[10px] sm:text-xs text-muted-foreground">
                                            {((ref.count / maxRefCount) * 100).toFixed(1)}%
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
                </div>
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
                        <StatsTable
                          entries={trackingEntries}
                          sortConfig={{ by: sortBy, order: sortOrder }}
                          onSort={handleSort}
                          onEditRule={handleEditRule}
                          formatTimestamp={formatTimestamp}
                          showReferrer={generalSettings.enableReferrerTracking}
                        />
                        
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

            {/* Export Tab - REDESIGNED */}
            <TabsContent value="export">
              <div className="space-y-6">
                {/* Standard Import/Export Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-6 w-6 text-primary" />
                        <CardTitle>Standard Import / Export (Excel, CSV)</CardTitle>
                    </div>
                    <CardDescription>
                        Benutzerfreundlicher Import und Export für Redirect Rules. Unterstützt Excel (.xlsx) und CSV.
                        Mit Vorschau-Funktion vor dem Import.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Import Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                            <h3 className="font-medium text-foreground">Regeln Importieren</h3>
                            <div className="text-sm text-muted-foreground space-y-2">
                                <p>Laden Sie eine Excel- oder CSV-Datei hoch. Erwartete Spalten:</p>
                                <ul className="list-disc list-inside text-xs">
                                        <li><strong>Matcher</strong> (Pflicht) - z.B. /alte-seite</li>
                                        <li><strong>Target URL</strong> (Pflicht) - z.B. https://neue-seite.de</li>
                                        <li><strong>Type</strong> (Pflicht) - 'partial', 'wildcard' oder 'domain'</li>
                                        <li><strong>Info</strong> (Optional) - Beschreibung</li>
                                        <li><strong>Auto Redirect</strong> (Optional) - 'true'/'false'</li>
                                        <li><strong>Discard Query Params</strong> (Optional) - 'true'/'false'</li>
                                        <li><strong>Keep Query Params</strong> (Optional) - 'true'/'false'</li>
                                        <li><strong>ID</strong> (Optional) - Nur für Updates bestehender Regeln</li>
                                </ul>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <a href="/sample-rules-import.xlsx" download className="text-xs text-primary hover:underline flex items-center">
                                    <Download className="h-3 w-3 mr-1" />
                                    Musterdatei (Excel)
                                  </a>
                                  <span className="text-muted-foreground">|</span>
                                  <a href="/sample-rules-import.csv" download className="text-xs text-primary hover:underline flex items-center">
                                    <Download className="h-3 w-3 mr-1" />
                                    Musterdatei (CSV)
                                  </a>
                                </div>
                            </div>
                            <div className="flex gap-2 items-center">
                                <div className="relative flex-1">
                                    <Input
                                        id="rule-import-file"
                                        type="file"
                                        accept=".xlsx, .xls, .csv"
                                        className="hidden"
                                        onChange={handlePreview}
                                        disabled={previewMutation.isPending}
                                    />
                                    <label
                                        htmlFor="rule-import-file"
                                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                                            ${previewMutation.isPending
                                                ? 'bg-muted/50 border-muted-foreground/20 cursor-not-allowed'
                                                : 'bg-background hover:bg-muted/50 border-muted-foreground/20 hover:border-primary/50'
                                            }`}
                                    >
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                                            {previewMutation.isPending ? (
                                                <div className="animate-pulse flex flex-col items-center">
                                                    <div className="h-8 w-8 mb-3 rounded-full bg-muted"></div>
                                                    <div className="text-sm text-muted-foreground">Analysiere Datei...</div>
                                                </div>
                                            ) : (
                                                <>
                                                    <Upload className="w-8 h-8 mb-3 text-muted-foreground" />
                                                    <p className="mb-1 text-sm text-foreground font-medium">
                                                        Klicken zum Auswählen
                                                        <span className="text-muted-foreground font-normal"> oder Datei hierher ziehen</span>
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Excel (.xlsx) oder CSV
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                                    <div>
                                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">URLs automatisch kodieren</p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            Sonderzeichen in URLs automatisch konvertieren (encodeURI)
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={generalSettings.encodeImportedUrls}
                                    onCheckedChange={(checked) => {
                                        const newSettings = { ...generalSettings, encodeImportedUrls: checked };
                                        setGeneralSettings(newSettings);
                                        updateSettingsMutation.mutate(newSettings);
                                    }}
                                    className="data-[state=checked]:bg-blue-600 flex-shrink-0"
                                />
                            </div>

                        </div>

                        {/* Export Section */}
                        <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                            <h3 className="font-medium text-foreground">Regeln Exportieren</h3>
                            <p className="text-sm text-muted-foreground">
                                Exportieren Sie alle Regeln zur Bearbeitung in Excel oder als Backup.
                                Die Dateien können später wieder importiert werden.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button className="flex-1" variant="outline" onClick={() => handleExport('rules', 'xlsx')}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Herunterladen (Excel)
                                </Button>
                                <Button className="flex-1" variant="outline" onClick={() => handleExport('rules', 'csv')}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Herunterladen (CSV)
                                </Button>
                            </div>
                        </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Advanced Import/Export Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                        <FileJson className="h-6 w-6 text-orange-600" />
                        <CardTitle>Erweiterter Regel-Import/Export</CardTitle>
                    </div>
                    <CardDescription>
                        Für fortgeschrittene Benutzer und System-Backups. Importiert Rohdaten ohne Vorschau.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* JSON Rules */}
                         <div className="space-y-4 border rounded-lg p-4 bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800">
                            <h3 className="font-medium text-foreground flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                Regel-Rohdaten (JSON)
                            </h3>
                            <div className="space-y-2">
                                <Button
                                    className="w-full"
                                    variant="outline"
                                    onClick={() => handleExport('rules', 'json')}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Herunterladen (JSON)
                                </Button>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={handleImportFile}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <Button
                                        className="w-full"
                                        variant="secondary"
                                        disabled={importMutation.isPending}
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Importieren (JSON)
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <a href="/sample-rules-import.json" download className="text-xs text-primary hover:underline flex items-center">
                                    <Download className="h-3 w-3 mr-1" />
                                    Musterdatei (JSON)
                                  </a>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    <strong>Warnung:</strong> Keine Vorschau. Überschreibt bestehende Regeln bei ID-Konflikt sofort.
                                </p>
                            </div>
                         </div>
                    </div>
                  </CardContent>
                </Card>

                {/* System & Statistics Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                        <Settings className="h-6 w-6 text-blue-600" />
                        <CardTitle>System & Statistiken</CardTitle>
                    </div>
                    <CardDescription>
                        Verwaltung von Systemeinstellungen und Statistiken.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Settings Import/Export */}
                         <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                            <h3 className="font-medium text-foreground flex items-center gap-2">
                                <Settings className="h-4 w-4" />
                                System-Einstellungen
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Exportieren Sie die komplette Konfiguration (Titel, Texte, Farben) als Backup oder um sie auf eine andere Instanz zu übertragen.
                            </p>
                            <div className="space-y-2">
                                <Button
                                    className="w-full"
                                    variant="outline"
                                    onClick={() => handleExport('settings', 'json')}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Herunterladen (JSON)
                                </Button>
                                <div className="relative">
                                  <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImportSettingsFile}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                  <Button
                                    className="w-full"
                                    variant="secondary"
                                    disabled={importSettingsMutation.isPending}
                                  >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Importieren (JSON)
                                  </Button>
                                </div>
                            </div>
                         </div>

                         {/* Statistics Export */}
                         <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                            <h3 className="font-medium text-foreground flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                Statistiken
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Exportieren Sie die Tracking-Logs aller erfolgten Weiterleitungen zur externen Analyse.
                            </p>
                            <div className="space-y-2">
                                <Button
                                    className="w-full"
                                    variant="outline"
                                    onClick={() => handleExport('statistics', 'csv')}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Herunterladen (CSV)
                                </Button>
                            </div>
                         </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Maintenance Section */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <CardTitle className="text-red-500">Gefahrenzone!</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <h4 className="font-medium text-sm">Cache Wartung</h4>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <Button
                                    variant="outline"
                                    onClick={() => rebuildCacheMutation.mutate()}
                                    disabled={rebuildCacheMutation.isPending}
                                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 w-full sm:w-auto"
                                >
                                    {rebuildCacheMutation.isPending ? "Erstelle neu..." : "Cache neu aufbauen"}
                                </Button>
                                <p className="text-xs text-muted-foreground text-center sm:text-left">
                                    Nur bei Problemen mit der Regelerkennung notwendig.
                                </p>
                            </div>
                        </div>

                        <div className="border-t pt-4 flex flex-col gap-2">
                            <h4 className="font-medium text-sm">Sicherheit</h4>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowManageBlockedIpsDialog(true)}
                                    className="w-full sm:w-auto"
                                >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Blockierte IPs anzeigen und verwalten
                                </Button>
                                <p className="text-xs text-muted-foreground text-center sm:text-left">
                                    Liste der blockierten IPs einsehen, neue IPs blockieren oder einzelne entsperren.
                                </p>
                            </div>
                        </div>

                        <div className="border-t pt-4 flex flex-col gap-2">
                            <h4 className="font-medium text-sm text-red-600">Destruktive Aktionen</h4>
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            setDeleteAllConfirmationText("");
                                            setShowDeleteAllDialog(true);
                                        }}
                                        className="w-full sm:w-auto"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Alle Regeln löschen
                                    </Button>
                                    <p className="text-xs text-muted-foreground text-center sm:text-left">
                                        Löscht alle vorhandenen Weiterleitungs-Regeln unwiderruflich.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            setDeleteAllStatsConfirmationText("");
                                            setShowDeleteAllStatsDialog(true);
                                        }}
                                        className="w-full sm:w-auto"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Alle Statistiken löschen
                                    </Button>
                                    <p className="text-xs text-muted-foreground text-center sm:text-left">
                                        Löscht alle erfassten Tracking-Daten unwiderruflich.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            setClearBlockedIpsConfirmationText("");
                                            setShowClearBlockedIpsDialog(true);
                                        }}
                                        className="w-full sm:w-auto"
                                    >
                                        <Shield className="h-4 w-4 mr-2" />
                                        Blockierte IPs löschen
                                    </Button>
                                    <p className="text-xs text-muted-foreground text-center sm:text-left">
                                        Löscht alle blockierten IP-Adressen. Blockierte Nutzer erhalten sofort wieder Zugriff.
                                    </p>
                                </div>
                            </div>
                        </div>
                      </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Import Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Import Vorschau</DialogTitle>
                <DialogDescription>
                    Überprüfen Sie die zu importierenden Regeln. {importPreviewData?.isLimited && `(Vorschau auf ${importPreviewData.limit} Einträge begrenzt)`}
                </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto py-4">
                {importPreviewData && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                            <div className="flex gap-2">
                              <Badge
                                  variant={previewStatusFilter === 'new' ? "default" : "outline"}
                                  className={`cursor-pointer ${previewStatusFilter === 'new' ? 'bg-green-600 hover:bg-green-700' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                                  onClick={() => setPreviewStatusFilter(previewStatusFilter === 'new' ? 'all' : 'new')}
                              >
                                  Neu: {importPreviewData.counts.new}
                              </Badge>
                              <Badge
                                  variant={previewStatusFilter === 'update' ? "default" : "outline"}
                                  className={`cursor-pointer ${previewStatusFilter === 'update' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                                  onClick={() => setPreviewStatusFilter(previewStatusFilter === 'update' ? 'all' : 'update')}
                              >
                                  Update: {importPreviewData.counts.update}
                              </Badge>
                              <Badge
                                  variant={previewStatusFilter === 'invalid' ? "default" : "outline"}
                                  className={`cursor-pointer ${previewStatusFilter === 'invalid' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                                  onClick={() => setPreviewStatusFilter(previewStatusFilter === 'invalid' ? 'all' : 'invalid')}
                              >
                                  Ungültig: {importPreviewData.counts.invalid}
                              </Badge>
                              {previewStatusFilter !== 'all' && (
                                   <Button
                                     variant="ghost"
                                     size="sm"
                                     className="h-6 px-2 text-xs"
                                     onClick={() => setPreviewStatusFilter('all')}
                                   >
                                     <Filter className="h-3 w-3 mr-1" />
                                     Filter löschen
                                   </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                  Zeige {Math.min(previewLimit, filteredPreviewData.length)} von {filteredPreviewData.length} (Gesamt: {importPreviewData.total})
                              </span>
                              {filteredPreviewData.length > 50 && !showAllPreview && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-blue-600 hover:text-blue-800"
                                  onClick={() => {
                                    setShowAllPreview(true);
                                    setPreviewLimit(100); // Start with more

                                    // If we don't have all data yet, fetch it
                                    if (!importPreviewData.all && selectedImportFile) {
                                      previewMutation.mutate({ file: selectedImportFile, all: true });
                                    }
                                  }}
                                  disabled={previewMutation.isPending}
                                >
                                  {previewMutation.isPending ? "Lade..." : "Alle anzeigen"}
                                </Button>
                              )}
                            </div>
                        </div>

                        <ImportPreviewTable
                          data={filteredPreviewData}
                          sortConfig={{ by: previewSortBy, order: previewSortOrder }}
                          onSort={handlePreviewSort}
                          limit={previewLimit}
                        />

                        {/* Pagination / Load More for "Show All" mode */}
                        {showAllPreview && importPreviewData.all && previewLimit < importPreviewData.total && (
                          <div className="flex justify-center pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPreviewLimit(prev => Math.min(prev + 100, importPreviewData.total))}
                            >
                              Mehr laden (+100)
                            </Button>
                          </div>
                        )}
                    </div>
                )}
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Abbrechen</Button>
                <Button
                    onClick={handleExecuteImport}
                    disabled={importMutation.isPending || previewMutation.isPending || (importPreviewData?.all ? !importPreviewData.all.some(r => r.isValid) : !importPreviewData?.preview.some(r => r.isValid))}
                >
                    {importMutation.isPending || previewMutation.isPending
                      ? "Verarbeite..."
                      : `${importPreviewData?.total || 0} Regeln Importieren`
                    }
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Editing Dialog - Moved outside TabsContent to be accessible from all tabs */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editingRule ? "Regel bearbeiten" : "Neue Regel erstellen"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {editingRule ? "Bearbeiten Sie die existierende Regel hier." : "Erstellen Sie hier eine neue Regel."}
            </DialogDescription>
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
                placeholder={targetUrlPlaceholder}
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
                onValueChange={(value: "wildcard" | "partial" | "domain") =>
                  setRuleForm(prev => ({ ...prev, redirectType: value }))
                }
              >
                <SelectTrigger className="h-auto min-h-[40px]">
                  <SelectValue>
                    {ruleForm.redirectType === "partial" && "Teilweise"}
                    {ruleForm.redirectType === "wildcard" && "Vollständig"}
                    {ruleForm.redirectType === "domain" && "Domain-Ersatz"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-[calc(100vw-2rem)] sm:min-w-[480px] sm:max-w-[600px]">
                  <SelectItem value="partial" className="pl-8 pr-3 py-3 items-start">
                    <div className="flex flex-col space-y-1">
                      <span className="font-medium text-sm">Teilweise</span>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        Nur die Pfadsegmente ab dem Matcher werden ersetzt. Base URL aus den generellen Einstellungen wird verwendet. Zusätzliche Pfadsegmente, Parameter und Anker bleiben erhalten.
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="wildcard" className="pl-8 pr-3 py-3 items-start">
                    <div className="flex flex-col space-y-1">
                      <span className="font-medium text-sm">Vollständig</span>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        Alte Links werden komplett auf die neue Ziel-URL umgeleitet. Keine Bestandteile der alten URL werden übernommen – weder Pfadsegmente noch Parameter oder Anker.
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="domain" className="pl-8 pr-3 py-3 items-start">
                    <div className="flex flex-col space-y-1">
                      <span className="font-medium text-sm">Domain-Ersatz</span>
                      <span className="text-xs text-muted-foreground leading-relaxed whitespace-normal">
                        Ersetzt nur die Domain (Host) der URL. Der gesamte Pfad und alle Parameter bleiben exakt erhalten. Wenn eine Ziel-URL angegeben ist, wird deren Domain verwendet.<br/><br/>
                        Der Matcher kann hier auch eine Domain sein (z.B. "www.alteseite.ch"). Bei Verwendung eines Pfad-Matchers ("/news") mit diesem Typ wird nur die Domain ersetzt, während der Pfad erhalten bleibt.
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

            {/* Parameter Handling Options */}
            {(ruleForm.redirectType === 'partial' || ruleForm.redirectType === 'domain') && (
              <div className="border-t pt-4">
                <div className="flex items-start space-x-3">
                  <Switch
                    checked={ruleForm.discardQueryParams}
                    onCheckedChange={(checked) => setRuleForm(prev => ({ ...prev, discardQueryParams: checked }))}
                  />
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Alle Link-Parameter entfernen
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Wenn aktiviert, werden alle Query-Parameter (z.B. ?id=123) aus der URL entfernt. Standard ist deaktiviert (Parameter werden beibehalten).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {ruleForm.redirectType === 'wildcard' && (
              <div className="border-t pt-4">
                <div className="flex items-start space-x-3">
                  <Switch
                    checked={ruleForm.forwardQueryParams}
                    onCheckedChange={(checked) => setRuleForm(prev => ({ ...prev, forwardQueryParams: checked }))}
                  />
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Link-Parameter beibehalten
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Wenn aktiviert, werden die ursprünglichen Query-Parameter an die Ziel-URL angehängt. Standard ist deaktiviert (Parameter werden verworfen).
                    </p>
                  </div>
                </div>
              </div>
            )}

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

      {/* Clear Blocked IPs Confirmation Dialog */}
      <Dialog open={showClearBlockedIpsDialog} onOpenChange={setShowClearBlockedIpsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" />
              Blockierte IPs löschen?
            </DialogTitle>
            <DialogDescription>
              Dies löscht alle derzeit blockierten IP-Adressen. Nutzer können sich sofort wieder anmelden.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
               Diese Aktion hebt den Brute-Force-Schutz für alle aktuell gesperrten Nutzer auf.
            </div>

            <Button
                variant="outline"
                onClick={() => {
                   window.open('/api/admin/export/blocked-ips', '_blank');
                }}
                className="w-full"
            >
                <Download className="h-4 w-4 mr-2" />
                Backup herunterladen (Excel)
            </Button>

            <div className="space-y-2">
                <label className="text-sm font-medium">
                    Bestätigung erforderlich
                </label>
                <Input
                    value={clearBlockedIpsConfirmationText}
                    onChange={(e) => setClearBlockedIpsConfirmationText(e.target.value)}
                    placeholder='Tippen Sie "DELETE" zur Bestätigung'
                    className={clearBlockedIpsConfirmationText === "DELETE" ? "border-green-500 focus-visible:ring-green-500" : ""}
                />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearBlockedIpsDialog(false)}>Abbrechen</Button>
            <Button
              variant="destructive"
              onClick={() => clearBlockedIpsMutation.mutate()}
              disabled={clearBlockedIpsConfirmationText !== "DELETE" || clearBlockedIpsMutation.isPending}
            >
              {clearBlockedIpsMutation.isPending ? 'Lösche...' : 'Alles löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Blocked IPs Dialog */}
      <Dialog open={showManageBlockedIpsDialog} onOpenChange={setShowManageBlockedIpsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Blockierte IPs verwalten</DialogTitle>
            <DialogDescription>
              Hier können Sie aktuell blockierte IP-Adressen einsehen und verwalten.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="flex gap-2">
               <Input
                 placeholder="IP-Adresse (z.B. 192.168.1.1)"
                 value={newBlockedIp}
                 onChange={(e) => setNewBlockedIp(e.target.value)}
               />
               <Button
                 onClick={() => {
                    if(newBlockedIp) blockIpMutation.mutate(newBlockedIp);
                 }}
                 disabled={!newBlockedIp || blockIpMutation.isPending}
               >
                 Blockieren
               </Button>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP-Adresse</TableHead>
                    <TableHead>Fehlversuche</TableHead>
                    <TableHead>Blockiert bis</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedIpsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">Lade...</TableCell>
                    </TableRow>
                  ) : blockedIps && blockedIps.length > 0 ? (
                    blockedIps.map((entry) => (
                      <TableRow key={entry.ip}>
                        <TableCell className="font-medium">{entry.ip}</TableCell>
                        <TableCell>{entry.attempts}</TableCell>
                        <TableCell>{new Date(entry.blockedUntil).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => unblockIpMutation.mutate(entry.ip)}
                            disabled={unblockIpMutation.isPending}
                            aria-label={`IP ${entry.ip} entsperren`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Keine blockierten IP-Adressen.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
             <Button variant="outline" onClick={() => setShowManageBlockedIpsDialog(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Statistics Confirmation Dialog */}
      <Dialog open={showDeleteAllStatsDialog} onOpenChange={setShowDeleteAllStatsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Alle Statistiken löschen?
            </DialogTitle>
            <DialogDescription>
              Dies löscht alle erfassten Tracking-Daten unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
               Wir empfehlen dringend, vor dem Löschen ein Backup zu erstellen.
            </div>

            <Button
                variant="outline"
                onClick={() => handleExport('statistics', 'csv')}
                className="w-full"
            >
                <Download className="h-4 w-4 mr-2" />
                Backup herunterladen (CSV)
            </Button>

            <div className="space-y-2">
                <label className="text-sm font-medium">
                    Bestätigung erforderlich
                </label>
                <Input
                    value={deleteAllStatsConfirmationText}
                    onChange={(e) => setDeleteAllStatsConfirmationText(e.target.value)}
                    placeholder='Tippen Sie "DELETE" zur Bestätigung'
                    className={deleteAllStatsConfirmationText === "DELETE" ? "border-green-500 focus-visible:ring-green-500" : ""}
                />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAllStatsDialog(false)}>Abbrechen</Button>
            <Button
              variant="destructive"
              onClick={() => deleteAllStatsMutation.mutate()}
              disabled={deleteAllStatsConfirmationText !== "DELETE" || deleteAllStatsMutation.isPending}
            >
              {deleteAllStatsMutation.isPending ? 'Lösche...' : 'Alles löschen'}
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

      {/* Delete All Rules Confirmation Dialog */}
      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Alle Regeln löschen?
            </DialogTitle>
            <DialogDescription>
              Dies löscht alle vorhandenen Regeln unwiderruflich. Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
               Wir empfehlen dringend, vor dem Löschen ein Backup zu erstellen.
            </div>
            
            <Button 
                variant="outline" 
                onClick={() => handleExport('rules', 'json')}
                className="w-full"
            >
                <Download className="h-4 w-4 mr-2" />
                Backup herunterladen (JSON)
            </Button>

            <div className="space-y-2">
                <label className="text-sm font-medium">
                    Bestätigung erforderlich
                </label>
                <Input 
                    value={deleteAllConfirmationText}
                    onChange={(e) => setDeleteAllConfirmationText(e.target.value)}
                    placeholder='Tippen Sie "DELETE" zur Bestätigung'
                    className={deleteAllConfirmationText === "DELETE" ? "border-green-500 focus-visible:ring-green-500" : ""}
                />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAllDialog(false)}>Abbrechen</Button>
            <Button
              variant="destructive"
              onClick={() => deleteAllRulesMutation.mutate()}
              disabled={deleteAllConfirmationText !== "DELETE" || deleteAllRulesMutation.isPending}
            >
              {deleteAllRulesMutation.isPending ? 'Lösche...' : 'Alles löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
