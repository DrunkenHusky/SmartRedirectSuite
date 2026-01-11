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
  Share2,
  LayoutTemplate
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
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
  const [rulesPerPage] = useState(50);
  const rulesSearchInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [deleteAllConfirmationText, setDeleteAllConfirmationText] = useState("");

  const [showDeleteAllStatsDialog, setShowDeleteAllStatsDialog] = useState(false);
  const [deleteAllStatsConfirmationText, setDeleteAllStatsConfirmationText] = useState("");

  const [showClearBlockedIpsDialog, setShowClearBlockedIpsDialog] = useState(false);
  const [clearBlockedIpsConfirmationText, setClearBlockedIpsConfirmationText] = useState("");

  const [showManageBlockedIpsDialog, setShowManageBlockedIpsDialog] = useState(false);
  const [newBlockedIp, setNewBlockedIp] = useState("");

  const [statsPage, setStatsPage] = useState(1);
  const [statsPerPage] = useState(50);
  const [statsSearchQuery, setStatsSearchQuery] = useState("");
  const [debouncedStatsSearchQuery, setDebouncedStatsSearchQuery] = useState("");
  const [statsRuleFilter, setStatsRuleFilter] = useState<'all' | 'with_rule' | 'no_rule'>('all');
  const [statsQualityFilter, setStatsQualityFilter] = useState<string>("all");
  const [statsFeedbackFilter, setStatsFeedbackFilter] = useState<'all' | 'OK' | 'NOK' | 'empty'>('all');
  const statsSearchInputRef = useRef<HTMLInputElement>(null);

  const [isLargeScreen, setIsLargeScreen] = useState(false);
  useEffect(() => {
    const checkScreen = () => setIsLargeScreen(window.matchMedia("(min-width: 1024px)").matches);
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<ImportPreviewData | null>(null);
  const [previewLimit, setPreviewLimit] = useState(50);
  const [showAllPreview, setShowAllPreview] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);

  const [previewSortBy, setPreviewSortBy] = useState<'status' | 'matcher' | 'targetUrl'>('status');
  const [previewSortOrder, setPreviewSortOrder] = useState<'asc' | 'desc'>('asc');
  const [previewStatusFilter, setPreviewStatusFilter] = useState<'all' | 'new' | 'update' | 'invalid'>('all');

  const filteredPreviewData = useMemo(() => {
    if (!importPreviewData) return [];
    const sourceData = importPreviewData.all || importPreviewData.preview || [];
    let filtered = [...sourceData];
    if (previewStatusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === previewStatusFilter);
    }
    filtered.sort((a, b) => {
      let valA = '', valB = '';
      if (previewSortBy === 'status') { valA = a.status; valB = b.status; }
      else if (previewSortBy === 'matcher') { valA = a.rule.matcher || ''; valB = b.rule.matcher || ''; }
      else if (previewSortBy === 'targetUrl') { valA = a.rule.targetUrl || ''; valB = b.rule.targetUrl || ''; }
      if (valA < valB) return previewSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return previewSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [importPreviewData, previewStatusFilter, previewSortBy, previewSortOrder]);

  const [generalSettings, setGeneralSettings] = useState({
    headerTitle: "URL Migration Tool",
    headerIcon: "ArrowRightLeft" as const,
    headerLogoUrl: "" as string | undefined,
    headerBackgroundColor: "#ffffff",
    popupMode: "active" as const,
    mainTitle: "Veralteter Link erkannt",
    mainDescription: "",
    mainBackgroundColor: "#ffffff",
    alertIcon: "AlertTriangle" as const,
    alertBackgroundColor: "yellow" as const,
    urlComparisonTitle: "URL-Vergleich",
    urlComparisonIcon: "ArrowRightLeft" as const,
    urlComparisonBackgroundColor: "#ffffff",
    oldUrlLabel: "Alte URL",
    newUrlLabel: "Neue URL",
    defaultNewDomain: "",
    copyButtonText: "Kopieren",
    openButtonText: "Öffnen",
    showUrlButtonText: "Anzeigen",
    popupButtonText: "Anzeigen",
    specialHintsTitle: "Hinweis",
    specialHintsDescription: "",
    specialHintsIcon: "Info" as const,
    infoTitle: "",
    infoTitleIcon: "Info" as const,
    infoItems: [] as string[],
    infoIcons: [] as any[],
    footerCopyright: "",
    caseSensitiveLinkDetection: false,
    encodeImportedUrls: true,
    autoRedirect: false,
    showLinkQualityGauge: true,
    matchHighExplanation: "",
    matchMediumExplanation: "",
    matchLowExplanation: "",
    matchRootExplanation: "",
    matchNoneExplanation: "",
    enableTrackingCache: true,
    maxStatsEntries: 0,
    enableReferrerTracking: true,
    defaultRedirectMode: "domain" as const,
    defaultSearchUrl: "",
    defaultSearchMessage: "",
    enableFeedbackSurvey: false,
    feedbackSurveyTitle: "",
    feedbackSurveyQuestion: "",
    feedbackSuccessMessage: "",
    feedbackButtonYes: "",
    feedbackButtonNo: "",
  });

  const [statsFilter, setStatsFilter] = useState('all' as '24h' | '7d' | 'all');
  const [statsView, setStatsView] = useState<'top100' | 'browser'>(() => {
    const showAdmin = localStorage.getItem('showAdminView') === 'true';
    return showAdmin ? ((localStorage.getItem('adminStatsView') as 'top100' | 'browser') || 'top100') : 'top100';
  });
  const [activeTab, setActiveTab] = useState(() => {
    const showAdmin = localStorage.getItem('showAdminView') === 'true';
    return showAdmin ? (localStorage.getItem('adminActiveTab') || 'general') : 'general';
  });

  const [showAutoRedirectDialog, setShowAutoRedirectDialog] = useState(false);
  const [pendingAutoRedirectValue, setPendingAutoRedirectValue] = useState(false);
  
  const getCurrentBaseUrl = () => `${window.location.protocol}//${window.location.host}`;
  const { toast } = useToast();

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    localStorage.setItem('adminActiveTab', newTab);
  };

  const handleStatsViewChange = (newView: 'top100' | 'browser') => {
    setStatsView(newView);
    localStorage.setItem('adminStatsView', newView);
  };

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch("/api/admin/status", { method: "GET", credentials: "include", cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(data.isAuthenticated);
          setIsCheckingAuth(false);
        } else {
          setIsAuthenticated(false);
          setIsCheckingAuth(false);
        }
      } catch (error) {
        setIsAuthenticated(false);
        setIsCheckingAuth(false);
      }
    };
    checkAuthStatus();
    const handleVisibilityChange = () => { if (!document.hidden) checkAuthStatus(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = setInterval(checkAuthStatus, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
      if (debouncedRulesSearchQuery.trim()) params.append('search', debouncedRulesSearchQuery);
      const response = await fetch(`/api/admin/rules/paginated?${params}`, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) { setIsAuthenticated(false); throw new Error('Authentication required'); }
      if (!response.ok) throw new Error('Failed to fetch rules');
      return response.json();
    },
  });

  const rules = paginatedRulesData?.rules || [];
  const totalRules = paginatedRulesData?.total || 0;
  const totalPagesFromAPI = paginatedRulesData?.totalPages || 1;

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats/all", statsFilter],
    enabled: isAuthenticated,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statsFilter !== 'all') params.append('timeRange', statsFilter);
      const url = `/api/admin/stats/all${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) { setIsAuthenticated(false); throw new Error('Authentication required'); }
      if (!response.ok) throw new Error('Failed to fetch statistics');
      return response.json();
    },
  });

  const { data: topUrlsData, isLoading: top100Loading } = useQuery({
    queryKey: ["/api/admin/stats/top100", statsFilter],
    enabled: isAuthenticated && statsView === 'top100',
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statsFilter !== 'all') params.append('timeRange', statsFilter);
      const url = `/api/admin/stats/top100${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) { setIsAuthenticated(false); throw new Error('Authentication required'); }
      if (!response.ok) throw new Error('Failed to fetch top 100');
      return response.json() as Promise<Array<{ path: string; count: number }>>;
    },
  });

  const { data: topReferrersData, isLoading: topReferrersLoading } = useQuery({
    queryKey: ["/api/admin/stats/top-referrers", statsFilter],
    enabled: isAuthenticated && statsView === 'top100',
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statsFilter !== 'all') params.append('timeRange', statsFilter);
      const url = `/api/admin/stats/top-referrers${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) { setIsAuthenticated(false); throw new Error('Authentication required'); }
      if (!response.ok) throw new Error('Failed to fetch top referrers');
      return response.json() as Promise<Array<{ domain: string; count: number }>>;
    },
  });

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
      if (statsQualityFilter !== "all") {
        if (statsQualityFilter === "100") params.append("minQuality", "100");
        else if (statsQualityFilter === "75") { params.append("minQuality", "75"); params.append("maxQuality", "75"); }
        else if (statsQualityFilter === "50") { params.append("minQuality", "50"); params.append("maxQuality", "50"); }
        else if (statsQualityFilter === "0") params.append("maxQuality", "0");
      }
      if (debouncedStatsSearchQuery.trim()) params.append('search', debouncedStatsSearchQuery);
      const response = await fetch(`/api/admin/stats/entries/paginated?${params}`, { credentials: 'include' });
      if (response.status === 401 || response.status === 403) { setIsAuthenticated(false); throw new Error('Authentication required'); }
      if (!response.ok) throw new Error('Failed to fetch tracking entries');
      return response.json();
    },
  });

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/settings"],
    enabled: true,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch("/api/settings", { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json() as Promise<GeneralSettings>;
    },
  });

  useEffect(() => {
    if (settingsData) {
      setGeneralSettings(prev => ({ ...prev, ...settingsData }));
    }
  }, [settingsData]);

  // Mutations
  const createRuleMutation = useMutation({
    mutationFn: (rule: typeof ruleForm) => apiRequest("POST", "/api/admin/rules", rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/entries/paginated"] });
      setIsRuleDialogOpen(false);
      setValidationError(null);
      setShowValidationDialog(false);
      resetRuleForm();
      toast({ title: "Regel erstellt", description: "Erfolgreich erstellt." });
    },
    onError: (error: any) => {
        if (error?.status === 403 || error?.status === 401) { window.location.reload(); return; }
        if (error?.error || error?.message) { setValidationError(error.error || error.message); setShowValidationDialog(true); }
        else toast({ title: "Fehler", description: "Fehler beim Erstellen.", variant: "destructive" });
    }
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: typeof ruleForm }) => apiRequest("PUT", `/api/admin/rules/${id}`, rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      setIsRuleDialogOpen(false);
      setValidationError(null);
      setShowValidationDialog(false);
      resetRuleForm();
      toast({ title: "Regel aktualisiert", description: "Erfolgreich aktualisiert." });
    },
    onError: (error: any) => {
        if (error?.status === 403 || error?.status === 401) { window.location.reload(); return; }
        if (error?.error || error?.message) { setValidationError(error.error || error.message); setShowValidationDialog(true); }
        else toast({ title: "Fehler", description: "Update fehlgeschlagen.", variant: "destructive" });
    }
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      toast({ title: "Gelöscht", description: "Regel gelöscht." });
    }
  });

  const deleteAllStatsMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("DELETE", "/api/admin/all-stats"); return r.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/entries/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/top100"] });
      setShowDeleteAllStatsDialog(false);
      toast({ title: "Statistiken gelöscht", description: "Erfolgreich." });
    }
  });

  const clearBlockedIpsMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("DELETE", "/api/admin/blocked-ips"); return r.json(); },
    onSuccess: () => { setShowClearBlockedIpsDialog(false); toast({ title: "IPs gelöscht", description: "Erfolgreich." }); }
  });

  const { data: blockedIps, isLoading: blockedIpsLoading, refetch: refetchBlockedIps } = useQuery({
    queryKey: ["/api/admin/blocked-ips"],
    enabled: isAuthenticated && showManageBlockedIpsDialog,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/admin/blocked-ips", { credentials: "include" });
      if (!response.ok) throw new Error("Failed");
      return response.json() as Promise<Array<{ ip: string; attempts: number; blockedUntil: number }>>;
    },
  });

  const blockIpMutation = useMutation({
    mutationFn: async (ip: string) => apiRequest("POST", "/api/admin/blocked-ips", { ip }),
    onSuccess: () => { setNewBlockedIp(""); refetchBlockedIps(); toast({ title: "IP blockiert", description: "Erfolgreich." }); }
  });

  const unblockIpMutation = useMutation({
    mutationFn: async (ip: string) => apiRequest("DELETE", `/api/admin/blocked-ips/${ip}`),
    onSuccess: () => { refetchBlockedIps(); toast({ title: "IP entsperrt", description: "Erfolgreich." }); }
  });

  const bulkDeleteRulesMutation = useMutation({
    mutationFn: async (ruleIds: string[]) => {
      const currentPageRuleIds = paginatedRules.map(rule => rule.id);
      const validRuleIds = ruleIds.filter(id => currentPageRuleIds.includes(id));
      if (validRuleIds.length === 0) throw new Error('No valid rules');
      const r = await apiRequest("DELETE", "/api/admin/bulk-delete-rules", { ruleIds: validRuleIds });
      return r.json();
    },
    onSuccess: () => {
      setSelectedRuleIds([]);
      setShowBulkDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      toast({ title: "Regeln gelöscht", description: "Erfolgreich." });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: typeof generalSettings) => apiRequest("PUT", "/api/admin/settings", settings),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "Gespeichert", description: "Einstellungen aktualisiert." }); },
    onError: (e: any) => toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" })
  });

  const importSettingsMutation = useMutation({
    mutationFn: (settings: any) => apiRequest("POST", "/api/admin/import/settings", { settings }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "Importiert", description: "Einstellungen importiert." }); }
  });

  const resetRuleForm = () => {
    setRuleForm({ matcher: "", targetUrl: "", infoText: "", redirectType: "partial", autoRedirect: false, discardQueryParams: false, forwardQueryParams: false });
    setEditingRule(null);
    setValidationError(null);
    setShowValidationDialog(false);
  };

  const forceCreateRuleMutation = useMutation({
    mutationFn: (rule: typeof ruleForm) => apiRequest("POST", "/api/admin/rules", { ...rule, forceCreate: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      setIsRuleDialogOpen(false);
      setShowValidationDialog(false);
      resetRuleForm();
      toast({ title: "Erstellt", description: "Regel trotz Warnung erstellt." });
    }
  });

  const forceUpdateRuleMutation = useMutation({
    mutationFn: ({ id, rule }: { id: string; rule: typeof ruleForm }) => apiRequest("PUT", `/api/admin/rules/${id}`, { ...rule, forceUpdate: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] });
      setIsRuleDialogOpen(false);
      setShowValidationDialog(false);
      resetRuleForm();
      toast({ title: "Aktualisiert", description: "Regel trotz Warnung aktualisiert." });
    }
  });

  const handleForceSave = () => {
    if (editingRule) forceUpdateRuleMutation.mutate({ id: editingRule.id, rule: ruleForm });
    else forceCreateRuleMutation.mutate(ruleForm);
  };

  // Pagination vars
  const totalFilteredRules = totalRules;
  const totalPages = totalPagesFromAPI;
  const startIndex = (rulesPage - 1) * rulesPerPage;
  const endIndex = startIndex + rules.length;
  const paginatedRules = rules;

  const trackingEntries = paginatedEntriesData?.entries || [];
  const totalStatsEntries = paginatedEntriesData?.total || 0;
  const totalAllStatsEntries = paginatedEntriesData?.totalAllEntries || 0;
  const totalStatsPages = paginatedEntriesData?.totalPages || 1;
  const statsStartIndex = (statsPage - 1) * statsPerPage;
  const statsEndIndex = statsStartIndex + trackingEntries.length;
  const totalTopUrls = topUrlsData?.length || 0;
  const totalTopUrlsPages = 1;

  useEffect(() => { const t = setTimeout(() => setDebouncedRulesSearchQuery(rulesSearchQuery), 500); return () => clearTimeout(t); }, [rulesSearchQuery]);
  useEffect(() => { setRulesPage(1); setSelectedRuleIds([]); }, [debouncedRulesSearchQuery]);
  useEffect(() => setSelectedRuleIds([]), [rulesPage]);
  useEffect(() => { const t = setTimeout(() => setDebouncedStatsSearchQuery(statsSearchQuery), 500); return () => clearTimeout(t); }, [statsSearchQuery]);
  useEffect(() => setStatsPage(1), [debouncedStatsSearchQuery]);

  const handleRulesSort = useCallback((column: 'matcher' | 'targetUrl' | 'createdAt') => {
    if (rulesSortBy === column) setRulesSortOrder(rulesSortOrder === 'asc' ? 'desc' : 'asc');
    else { setRulesSortBy(column); setRulesSortOrder('asc'); }
  }, [rulesSortBy, rulesSortOrder]);

  const handleSubmitRule = (e: React.FormEvent) => { e.preventDefault(); if (editingRule) updateRuleMutation.mutate({ id: editingRule.id, rule: ruleForm }); else createRuleMutation.mutate(ruleForm); };

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

  const handleDeleteRule = useCallback((ruleId: string) => deleteRuleMutation.mutate(ruleId), [deleteRuleMutation]);

  const handleSelectRule = useCallback((ruleId: string) => setSelectedRuleIds(prev => prev.includes(ruleId) ? prev.filter(id => id !== ruleId) : [...prev, ruleId]), []);
  const handleSelectAllRules = useCallback((checked: boolean) => {
    if (checked) {
      const pageIds = paginatedRules.map(r => r.id);
      setSelectedRuleIds(prev => [...new Set([...prev, ...pageIds])]);
    } else {
      const pageIds = paginatedRules.map(r => r.id);
      setSelectedRuleIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  }, [paginatedRules]);

  const handleBulkDelete = () => { if (selectedRuleIds.length > 0) setShowBulkDeleteDialog(true); };

  const handleExport = async (type: string, format: string = 'json') => {
    try {
      const res = await fetch("/api/admin/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, format }), credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${type}.${format === 'csv' ? 'csv' : (format === 'xlsx' ? 'xlsx' : 'json')}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        toast({ title: "Export erfolgreich", description: "Heruntergeladen." });
      } else throw new Error("Failed");
    } catch { toast({ title: "Fehler", description: "Export fehlgeschlagen.", variant: "destructive" }); }
  };

  const handleSettingsSubmit = (e: React.FormEvent) => { e.preventDefault(); updateSettingsMutation.mutate(generalSettings); };

  const logoutMutation = useMutation({
    mutationFn: async () => { await fetch("/api/admin/logout", { method: "POST", credentials: "include" }); },
    onSuccess: () => { setIsAuthenticated(false); localStorage.removeItem('adminActiveTab'); localStorage.removeItem('adminStatsView'); onClose(); }
  });
  const handleLogout = () => logoutMutation.mutate();

  const previewMutation = useMutation({
    mutationFn: async ({ file, all }: { file: File, all?: boolean }) => {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`/api/admin/import/preview?all=${all}`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => { setImportPreviewData(data); setShowPreviewDialog(true); setShowAllPreview(false); setPreviewLimit(50); }
  });

  const importMutation = useMutation({
    mutationFn: async (rules: any[]) => { const r = await apiRequest("POST", "/api/admin/import/rules", { rules }); return r.json(); },
    onSuccess: (d) => { queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] }); setShowPreviewDialog(false); toast({ title: "Import erfolgreich", description: `${d.imported} importiert.` }); }
  });

  const rebuildCacheMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/admin/force-cache-rebuild"); },
    onSuccess: () => toast({ title: "Cache neu aufgebaut", description: "Erfolgreich." })
  });

  const deleteAllRulesMutation = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", "/api/admin/all-rules"); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/rules/paginated"] }); setShowDeleteAllDialog(false); toast({ title: "Alles gelöscht", description: "Erfolgreich." }); }
  });

  const handlePreview = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { setSelectedImportFile(f); previewMutation.mutate({ file: f }); e.target.value = ''; } };
  const handlePreviewSort = (c: any) => { if (previewSortBy === c) setPreviewSortOrder(previewSortOrder === 'asc' ? 'desc' : 'asc'); else { setPreviewSortBy(c); setPreviewSortOrder('asc'); } };
  const handleExecuteImport = () => { if (importPreviewData?.all || importPreviewData?.preview) importMutation.mutate((importPreviewData.all || importPreviewData.preview).filter(r => r.isValid).map(r => r.rule)); };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!window.confirm("Experten-Import: Bestehende überschreiben?")) return;
    try { importMutation.mutate(JSON.parse(await f.text())); } catch { toast({ title: "Fehler", variant: "destructive" }); }
    e.target.value = '';
  };

  const handleImportSettingsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); const { id, updatedAt, ...s } = d; importSettingsMutation.mutate(s); } catch { toast({ title: "Fehler", variant: "destructive" }); }
    e.target.value = '';
  };

  const handleSort = (col: string) => { if (sortBy === col) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortOrder('desc'); } };
  const formatTimestamp = (ts: string) => new Date(ts).toLocaleString('de-DE');
  const getUIFieldName = (n: string) => n; // Simplified

  if (isCheckingAuth) return <div className="flex h-screen items-center justify-center">Lade...</div>;
  if (!isAuthenticated) return <><AdminAuthForm onAuthenticated={() => setIsAuthenticated(true)} onClose={onClose} /><Toaster /></>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface shadow-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3"><Shield className="text-primary text-xl" /><h1 className="text-xl font-semibold">Administrator-Bereich</h1></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Abmelden</Button>
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general"><Settings className="h-4 w-4 mr-2" />System</TabsTrigger>
              <TabsTrigger value="rules"><LayoutTemplate className="h-4 w-4 mr-2" />Regeln</TabsTrigger>
              <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-2" />Statistiken</TabsTrigger>
              <TabsTrigger value="export"><Database className="h-4 w-4 mr-2" />Daten</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Systemeinstellungen</CardTitle>
                  <p className="text-sm text-muted-foreground">Technische Konfiguration. Visuelle Einstellungen bitte inline bearbeiten.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSettingsSubmit} className="space-y-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium border-b pb-2">Routing & Fallback</h3>
                        <div className="grid gap-4">
                            <div><label className="text-sm font-medium">Ziel-Domain</label><DebouncedInput value={generalSettings.defaultNewDomain} onChange={v => setGeneralSettings({...generalSettings, defaultNewDomain: v as string})} /></div>
                            <div>
                                <label className="text-sm font-medium">Fallback-Modus</label>
                                <Select value={generalSettings.defaultRedirectMode} onValueChange={v => setGeneralSettings({...generalSettings, defaultRedirectMode: v as any})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="domain">Domain-Austausch</SelectItem><SelectItem value="search">Such-Weiterleitung</SelectItem></SelectContent>
                                </Select>
                            </div>
                            {generalSettings.defaultRedirectMode === 'search' && <div><label className="text-sm font-medium">Such-URL</label><DebouncedInput value={generalSettings.defaultSearchUrl || ''} onChange={v => setGeneralSettings({...generalSettings, defaultSearchUrl: v as string})} /></div>}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium border-b pb-2">Verhalten</h3>
                        <div className="flex items-center justify-between border p-3 rounded"><span>Popup-Modus</span><Select value={generalSettings.popupMode} onValueChange={v => setGeneralSettings({...generalSettings, popupMode: v as any})}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Aktiv</SelectItem><SelectItem value="inline">Inline</SelectItem><SelectItem value="disabled">Aus</SelectItem></SelectContent></Select></div>
                        <div className="flex items-center justify-between border p-3 rounded"><span>Qualitäts-Tacho</span><Switch checked={generalSettings.showLinkQualityGauge} onCheckedChange={c => setGeneralSettings({...generalSettings, showLinkQualityGauge: c})} /></div>
                        <div className="flex items-center justify-between border p-3 rounded"><span>Auto-Redirect</span><Switch checked={generalSettings.autoRedirect} onCheckedChange={c => { if(c) { setPendingAutoRedirectValue(true); setShowAutoRedirectDialog(true); } else setGeneralSettings({...generalSettings, autoRedirect: false}); }} /></div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium border-b pb-2">System</h3>
                        <div className="flex items-center justify-between border p-3 rounded"><span>Case-Sensitive</span><Switch checked={generalSettings.caseSensitiveLinkDetection} onCheckedChange={c => setGeneralSettings({...generalSettings, caseSensitiveLinkDetection: c})} /></div>
                        <div className="flex items-center justify-between border p-3 rounded"><span>Referrer Tracking</span><Switch checked={generalSettings.enableReferrerTracking} onCheckedChange={c => setGeneralSettings({...generalSettings, enableReferrerTracking: c})} /></div>
                        <div className="flex items-center justify-between border p-3 rounded"><span>Tracking Cache</span><Switch checked={generalSettings.enableTrackingCache} onCheckedChange={c => setGeneralSettings({...generalSettings, enableTrackingCache: c})} /></div>
                        <div className="flex items-center justify-between border p-3 rounded"><span>Max Stats (0=Unbegrenzt)</span><Input type="number" className="w-24" value={generalSettings.maxStatsEntries} onChange={e => setGeneralSettings({...generalSettings, maxStatsEntries: parseInt(e.target.value)||0})} /></div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-medium border-b pb-2">Feedback</h3>
                        <div className="flex items-center justify-between border p-3 rounded"><span>Umfrage aktivieren</span><Switch checked={generalSettings.enableFeedbackSurvey} onCheckedChange={c => setGeneralSettings({...generalSettings, enableFeedbackSurvey: c})} /></div>
                        {generalSettings.enableFeedbackSurvey && (
                            <div className="grid gap-4 p-4 border rounded bg-muted/20">
                                <div><label className="text-sm">Titel</label><DebouncedInput value={generalSettings.feedbackSurveyTitle} onChange={v => setGeneralSettings({...generalSettings, feedbackSurveyTitle: v as string})} /></div>
                                <div><label className="text-sm">Frage</label><DebouncedInput value={generalSettings.feedbackSurveyQuestion} onChange={v => setGeneralSettings({...generalSettings, feedbackSurveyQuestion: v as string})} /></div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end"><Button type="submit" size="lg" disabled={updateSettingsMutation.isPending}>Speichern</Button></div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rules">
              <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Regeln</CardTitle>
                        <div className="flex gap-2">
                            {selectedRuleIds.length > 0 && <Button variant="destructive" size="sm" onClick={handleBulkDelete}>Löschen ({selectedRuleIds.length})</Button>}
                            <Button size="sm" onClick={() => { resetRuleForm(); setIsRuleDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Neu</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Suchen..." value={rulesSearchQuery} onChange={e => setRulesSearchQuery(e.target.value)} className="pl-10" />
                    </div>
                    {rulesLoading ? <div className="text-center py-8">Lade...</div> : (
                        <>
                        {isLargeScreen ?
                            <RulesTable rules={paginatedRules} selectedRuleIds={selectedRuleIds} sortConfig={{by: rulesSortBy, order: rulesSortOrder}} onSort={handleRulesSort} onSelectRule={handleSelectRule} onSelectAll={handleSelectAllRules} onEditRule={handleEditRule} onDeleteRule={handleDeleteRule} />
                            : <RulesCardList rules={paginatedRules} sortConfig={{by: rulesSortBy, order: rulesSortOrder}} onSort={handleRulesSort} onEditRule={handleEditRule} onDeleteRule={handleDeleteRule} />
                        }
                        {totalPages > 1 && (
                            <div className="flex justify-between mt-4">
                                <Button variant="outline" size="sm" disabled={rulesPage===1} onClick={() => setRulesPage(p => p-1)}>Zurück</Button>
                                <span className="text-sm py-2">Seite {rulesPage} von {totalPages}</span>
                                <Button variant="outline" size="sm" disabled={rulesPage===totalPages} onClick={() => setRulesPage(p => p+1)}>Weiter</Button>
                            </div>
                        )}
                        </>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
               <div className="flex justify-between items-center mb-4">
                   <div className="flex gap-2">
                       <Button variant={statsView==='top100'?'default':'outline'} onClick={() => handleStatsViewChange('top100')}>Top 100</Button>
                       <Button variant={statsView==='browser'?'default':'outline'} onClick={() => handleStatsViewChange('browser')}>Log</Button>
                   </div>
                   {statsView==='top100' && <Select value={statsFilter} onValueChange={v => setStatsFilter(v as any)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="24h">24h</SelectItem><SelectItem value="7d">7 Tage</SelectItem><SelectItem value="all">Alle</SelectItem></SelectContent></Select>}
               </div>

               {statsView === 'top100' && (
                   <div className="grid md:grid-cols-2 gap-6">
                       <Card>
                           <CardHeader><CardTitle>Top URLs</CardTitle></CardHeader>
                           <CardContent>
                               {top100Loading ? <div>Lade...</div> : (
                                   <div className="overflow-auto max-h-[500px]">
                                       <table className="w-full text-sm">
                                           <thead><tr className="border-b text-left"><th>#</th><th>Pfad</th><th className="text-right">Hits</th></tr></thead>
                                           <tbody>{topUrlsData?.map((u, i) => <tr key={i} className="border-b"><td>{i+1}</td><td className="truncate max-w-[200px]">{u.path}</td><td className="text-right">{u.count}</td></tr>)}</tbody>
                                       </table>
                                   </div>
                               )}
                           </CardContent>
                       </Card>
                       <Card>
                           <CardHeader><CardTitle>Referrer</CardTitle></CardHeader>
                           <CardContent>
                               {topReferrersLoading ? <div>Lade...</div> : (
                                   <div className="overflow-auto max-h-[500px]">
                                       <table className="w-full text-sm">
                                           <thead><tr className="border-b text-left"><th>#</th><th>Domain</th><th className="text-right">Hits</th></tr></thead>
                                           <tbody>{topReferrersData?.map((r, i) => <tr key={i} className="border-b"><td>{i+1}</td><td>{r.domain}</td><td className="text-right">{r.count}</td></tr>)}</tbody>
                                       </table>
                                   </div>
                               )}
                           </CardContent>
                       </Card>
                   </div>
               )}

               {statsView === 'browser' && (
                   <Card>
                       <CardHeader><CardTitle>Tracking Log</CardTitle></CardHeader>
                       <CardContent>
                           <div className="flex gap-2 mb-4">
                               <Input placeholder="Suchen..." value={statsSearchQuery} onChange={e => setStatsSearchQuery(e.target.value)} />
                               <Select value={statsQualityFilter} onValueChange={setStatsQualityFilter}><SelectTrigger className="w-32"><SelectValue placeholder="Qualität" /></SelectTrigger><SelectContent><SelectItem value="all">Alle</SelectItem><SelectItem value="100">100%</SelectItem><SelectItem value="75">75%</SelectItem><SelectItem value="50">50%</SelectItem><SelectItem value="0">0%</SelectItem></SelectContent></Select>
                           </div>
                           {entriesLoading ? <div>Lade...</div> : (
                               <>
                               <StatsTable entries={trackingEntries} sortConfig={{by: sortBy, order: sortOrder}} onSort={handleSort} onEditRule={handleEditRule} formatTimestamp={formatTimestamp} showReferrer={generalSettings.enableReferrerTracking} />
                               {totalStatsPages > 1 && (
                                   <div className="flex justify-between mt-4">
                                       <Button variant="outline" size="sm" disabled={statsPage===1} onClick={() => setStatsPage(p => p-1)}>Zurück</Button>
                                       <span>Seite {statsPage}</span>
                                       <Button variant="outline" size="sm" disabled={statsPage===totalStatsPages} onClick={() => setStatsPage(p => p+1)}>Weiter</Button>
                                   </div>
                               )}
                               </>
                           )}
                       </CardContent>
                   </Card>
               )}
            </TabsContent>

            <TabsContent value="export">
                <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>Regeln (Excel/CSV)</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="border p-4 rounded bg-muted/10">
                                <h4 className="font-medium mb-2">Import</h4>
                                <Input type="file" accept=".xlsx,.csv" onChange={handlePreview} disabled={previewMutation.isPending} />
                                <div className="flex justify-between mt-2 text-sm"><span>Auto Encode</span><Switch checked={generalSettings.encodeImportedUrls} onCheckedChange={c => { setGeneralSettings({...generalSettings, encodeImportedUrls: c}); updateSettingsMutation.mutate({...generalSettings, encodeImportedUrls: c}); }} /></div>
                            </div>
                            <div className="flex gap-2">
                                <Button className="flex-1" variant="outline" onClick={() => handleExport('rules', 'xlsx')}><Download className="mr-2 h-4 w-4"/> Excel Export</Button>
                                <Button className="flex-1" variant="outline" onClick={() => handleExport('rules', 'csv')}><Download className="mr-2 h-4 w-4"/> CSV Export</Button>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>System & Daten</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2"><Button className="flex-1" variant="outline" onClick={() => handleExport('settings', 'json')}>Settings Export</Button><Button className="flex-1" variant="outline" onClick={() => handleExport('statistics', 'csv')}>Stats Export</Button></div>
                            <div className="border-t pt-4">
                                <h4 className="font-medium text-red-600 mb-2">Gefahrenzone</h4>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="destructive" size="sm" onClick={() => { setDeleteAllConfirmationText(""); setShowDeleteAllDialog(true); }}>Alle Regeln löschen</Button>
                                    <Button variant="destructive" size="sm" onClick={() => { setDeleteAllStatsConfirmationText(""); setShowDeleteAllStatsDialog(true); }}>Stats löschen</Button>
                                    <Button variant="outline" size="sm" onClick={() => rebuildCacheMutation.mutate()}>Cache Rebuild</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Dialogs */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Import Vorschau</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-auto">
                {importPreviewData && <ImportPreviewTable data={filteredPreviewData} sortConfig={{by: previewSortBy, order: previewSortOrder}} onSort={handlePreviewSort} limit={previewLimit} />}
                {showAllPreview && <Button variant="ghost" onClick={() => setPreviewLimit(l => l + 50)}>Mehr laden</Button>}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Abbrechen</Button>
                <Button onClick={handleExecuteImport} disabled={importMutation.isPending}>Importieren</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>{editingRule ? "Bearbeiten" : "Erstellen"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmitRule} className="space-y-4">
                <Input placeholder="Matcher (/pfad)" value={ruleForm.matcher} onChange={e => setRuleForm({...ruleForm, matcher: e.target.value})} />
                <Input placeholder="Ziel URL" value={ruleForm.targetUrl} onChange={e => setRuleForm({...ruleForm, targetUrl: e.target.value})} />
                <Select value={ruleForm.redirectType} onValueChange={v => setRuleForm({...ruleForm, redirectType: v as any})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="partial">Partial</SelectItem><SelectItem value="wildcard">Wildcard</SelectItem><SelectItem value="domain">Domain</SelectItem></SelectContent></Select>
                <DialogFooter><Button type="submit">Speichern</Button></DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent>
            <DialogHeader><DialogTitle>Wirklich alles löschen?</DialogTitle></DialogHeader>
            <Input placeholder="DELETE" value={deleteAllConfirmationText} onChange={e => setDeleteAllConfirmationText(e.target.value)} />
            <DialogFooter><Button variant="destructive" disabled={deleteAllConfirmationText !== "DELETE"} onClick={() => deleteAllRulesMutation.mutate()}>Löschen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteAllStatsDialog} onOpenChange={setShowDeleteAllStatsDialog}>
        <DialogContent>
            <DialogHeader><DialogTitle>Stats löschen?</DialogTitle></DialogHeader>
            <Input placeholder="DELETE" value={deleteAllStatsConfirmationText} onChange={e => setDeleteAllStatsConfirmationText(e.target.value)} />
            <DialogFooter><Button variant="destructive" disabled={deleteAllStatsConfirmationText !== "DELETE"} onClick={() => deleteAllStatsMutation.mutate()}>Löschen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAutoRedirectDialog} onOpenChange={setShowAutoRedirectDialog}>
        <DialogContent>
            <DialogHeader><DialogTitle>Warnung</DialogTitle></DialogHeader>
            <p>Admin Zugriff nur noch über ?admin=true möglich.</p>
            <DialogFooter><Button onClick={() => { setGeneralSettings({...generalSettings, autoRedirect: true}); setShowAutoRedirectDialog(false); }}>OK</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
