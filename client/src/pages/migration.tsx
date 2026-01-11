import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  ArrowRightLeft, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle,
  Check,
  XCircle, 
  Copy, 
  ExternalLink,
  Info,
  Bookmark,
  Share2,
  Clock,
  BarChart3,
  Settings,
  Star,
  Heart,
  Bell,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Trash
} from "lucide-react";
import { generateNewUrl, generateUrlWithRule, extractPath, copyToClipboard } from "@/lib/url-utils";
import { useToast } from "@/hooks/use-toast";
import { PasswordModal } from "@/components/ui/password-modal";
import { QualityGauge } from "@/components/ui/quality-gauge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UrlRule, GeneralSettings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Inline Editing Imports
import { EditModeProvider, useEditMode } from "@/components/inline/EditModeContext";
import { InlineText } from "@/components/inline/InlineText";
import { InlineImage } from "@/components/inline/InlineImage";
import { InlineColorWrapper } from "@/components/inline/InlineColorWrapper";
import { InlineSemanticColorPicker } from "@/components/inline/InlineSemanticColorPicker";
import { InlineIconPicker } from "@/components/inline/InlineIconPicker";
import { AdminToolbar } from "@/components/inline/AdminToolbar";
import { ICON_OPTIONS } from "@shared/schema";

interface MigrationPageProps {
  onAdminAccess: () => void;
}

// Icon mapping function
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    ArrowRightLeft,
    AlertTriangle,
    AlertCircle,
    XCircle,
    Info,
    Bookmark,
    Share2,
    Clock,
    CheckCircle,
    Star,
    Heart,
    Bell
  };
  return iconMap[iconName] || AlertTriangle;
};

// Background color mapping
const getBackgroundColor = (color: string) => {
  const colorMap: Record<string, string> = {
    yellow: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-800",
    red: "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800",
    orange: "bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800",
    blue: "bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800",
    gray: "bg-gray-50 border-gray-200 dark:bg-gray-950/50 dark:border-gray-800"
  };
  return colorMap[color] || colorMap.yellow;
};

function MigrationPageContent({ onAdminAccess }: MigrationPageProps) {
  const { isEditMode, isAdmin, setIsAdmin, toggleEditMode } = useEditMode();
  const [currentUrl, setCurrentUrl] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [matchingRule, setMatchingRule] = useState<UrlRule | null>(null);
  const [matchQuality, setMatchQuality] = useState(0);
  const [matchLevel, setMatchLevel] = useState<'red' | 'yellow' | 'green'>('red');
  const [matchExplanation, setMatchExplanation] = useState("");
  const [infoText, setInfoText] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMainDialog, setShowMainDialog] = useState(false);
  const [showUrlComparison, setShowUrlComparison] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [hasAskedFeedback, setHasAskedFeedback] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const fallbackAppName = __APP_NAME__ || "URL Migration Service";

  // Dialog state specifically for admin modal
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);

  // Fetch general settings for customizable texts
  const { data: settings, isLoading: settingsLoading } = useQuery<GeneralSettings>({
    queryKey: ["/api/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: GeneralSettings) =>
      apiRequest("PUT", "/api/admin/settings", newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Gespeichert",
        description: "Einstellungen wurden erfolgreich aktualisiert.",
      });
    },
    onError: (error) => {
      console.error("Failed to update settings", error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  });

  const handleUpdateSetting = async (updates: Partial<GeneralSettings>) => {
    if (!settings) return;
    const newSettings = { ...settings, ...updates };
    await updateSettingsMutation.mutateAsync(newSettings);
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
        const response = await fetch("/api/admin/logout", {
            method: "POST",
            credentials: "include"
        });
        if (!response.ok) throw new Error("Logout failed");
    },
    onSuccess: () => {
        setIsAdmin(false);
        // Also refresh the page or queries to reflect logged out state if needed
        toast({ title: "Abgemeldet", description: "Sie wurden erfolgreich abgemeldet." });
    }
  });

  useEffect(() => {
    if (settings) {
      // Only set showMainDialog if not in edit mode (to avoid popping up while editing)
      if (!isEditMode) {
          setShowMainDialog(settings.popupMode === 'active');
      }
    }
  }, [settings, isEditMode]);

  // Auth check on mount
  useEffect(() => {
    const checkAuth = async () => {
        try {
            const res = await fetch("/api/admin/status");
            if (res.ok) {
                const data = await res.json();
                setIsAdmin(data.isAuthenticated);
            }
        } catch (e) {
            console.error("Auth check failed", e);
        }
    };
    checkAuth();
  }, [setIsAdmin]);

  useEffect(() => {
    const initializePage = async () => {
      setIsLoading(true);
      const url = window.location.href;
      const path = extractPath(url);
      setCurrentUrl(url);

      // Wait for settings to be loaded before checking auto-redirect
      if (settingsLoading || !settings) {
        setIsLoading(false);
        return;
      }

      // Check if admin access is requested via URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const isAdminAccess = urlParams.get('admin') === 'true';
      
      if (isAdminAccess) {
        // Admin access requested - trigger login process directly
        setIsLoading(false);
        handleAdminAccess();
        return;
      }
      
      // Normal flow - check for auto-redirect and generate URL
      try {
        // Check for matching URL rules first
        const ruleResponse = await fetch("/api/check-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Explicitly pass full URL to ensure domain matching works correctly
          body: JSON.stringify({ path, url: window.location.href }),
        });
        
        let shouldAutoRedirect = false;
        let redirectUrl = "";
        let foundRule: UrlRule | null = null;
        let foundRules: UrlRule[] = [];
        let generatedNewUrl = "";
        let currentMatchQuality = 0;
        
        if (ruleResponse.ok) {
          const { rule, hasMatch, matchQuality: quality, matchLevel: level, matchingRules } = await ruleResponse.json();
          
          if (hasMatch && rule) {
            foundRule = rule;
            foundRules = matchingRules || [rule];
            currentMatchQuality = quality || 0;
            setMatchQuality(currentMatchQuality);
            setMatchLevel(level || 'red');
            // Determine explanation
            if (quality >= 90) {
              setMatchExplanation(settings.matchHighExplanation || "Die neue URL entspricht exakt der angeforderten Seite oder ist die Startseite. Höchste Qualität.");
            } else if (quality >= 60) {
              setMatchExplanation(settings.matchMediumExplanation || "Die URL wurde erkannt, weicht aber leicht ab (z.B. zusätzliche Parameter).");
            } else {
              setMatchExplanation(settings.matchLowExplanation || "Es wurde nur ein Teil der URL erkannt und ersetzt (Partial Match).");
            }

            // Check rule-specific auto-redirect first, then fall back to global setting
            shouldAutoRedirect = rule.autoRedirect || settings.autoRedirect || false;
            redirectUrl = generateUrlWithRule(url, rule, settings.defaultNewDomain);
            generatedNewUrl = redirectUrl;
          } else {
            // No match
            if (path === "/" || path === "") {
                // Root URL case - 100% match equivalent
                currentMatchQuality = 100;
                setMatchQuality(currentMatchQuality);
                setMatchLevel('green');
                setMatchExplanation(settings.matchRootExplanation || "Startseite erkannt. Direkte Weiterleitung auf die neue Domain.");

                if (settings.autoRedirect) {
                    shouldAutoRedirect = true;
                    redirectUrl = generateNewUrl(url, settings.defaultNewDomain);
                    generatedNewUrl = redirectUrl;
                } else {
                    generatedNewUrl = generateNewUrl(url, settings.defaultNewDomain);
                }
            } else {
                // Not root, and no match check Fallback Strategy
                if (settings.defaultRedirectMode === 'search') {
                    // Smart Search Logic
                    currentMatchQuality = 0;
                    setMatchQuality(currentMatchQuality);
                    setMatchLevel('yellow'); // Indicates fallback is active but not exact match

                    const message = settings.defaultSearchMessage || "Keine direkte Übereinstimmung gefunden. Sie werden zur Suche weitergeleitet.";
                    setMatchExplanation(message);
                    setInfoText(message);

                    // Extract last segment
                    try {
                        const urlObj = new URL(url);
                        const pathname = urlObj.pathname;
                        const segments = pathname.split('/').filter(s => s && s.trim().length > 0);
                        const lastSegment = segments.length > 0 ? segments[segments.length - 1] : "";

                        if (lastSegment && settings.defaultSearchUrl) {
                            generatedNewUrl = settings.defaultSearchUrl + encodeURIComponent(lastSegment);
                            redirectUrl = generatedNewUrl;

                            if (settings.autoRedirect) {
                                shouldAutoRedirect = true;
                            }
                        } else {
                            // Fallback if extraction fails or no search URL
                             setMatchLevel('red');
                             setMatchExplanation(settings.matchNoneExplanation || "Die URL konnte nicht spezifisch zugeordnet werden. Es wird auf die Standard-Seite weitergeleitet.");
                             generatedNewUrl = generateNewUrl(url, settings.defaultNewDomain);
                             if (settings.autoRedirect) {
                                shouldAutoRedirect = true;
                                redirectUrl = generatedNewUrl;
                             }
                        }
                    } catch (e) {
                        // Fallback on error
                        console.error("Smart search extraction failed", e);
                        generatedNewUrl = generateNewUrl(url, settings.defaultNewDomain);
                    }
                } else {
                    // Standard Domain Replacement
                    currentMatchQuality = 0;
                    setMatchQuality(currentMatchQuality);
                    setMatchLevel('red');
                    setMatchExplanation(settings.matchNoneExplanation || "Die URL konnte nicht spezifisch zugeordnet werden. Es wird auf die Standard-Seite weitergeleitet.");

                    if (settings.autoRedirect) {
                       // No matching rule, but global auto-redirect is enabled
                       shouldAutoRedirect = true;
                       redirectUrl = generateNewUrl(url, settings.defaultNewDomain);
                       generatedNewUrl = redirectUrl;
                    } else {
                       // No auto-redirect, generate URL for display
                       generatedNewUrl = generateNewUrl(url, settings.defaultNewDomain);
                    }
                }
            }
          }
        } else if (settings.autoRedirect) {
          // Fallback to global auto-redirect if rule check fails
          shouldAutoRedirect = true;
          redirectUrl = generateNewUrl(url, settings.defaultNewDomain);
          generatedNewUrl = redirectUrl;
        } else {
          // No auto-redirect, generate URL for display
          generatedNewUrl = generateNewUrl(url, settings.defaultNewDomain);
        }
        
        // Handle auto-redirect - but ONLY if not in edit mode or admin access
        // We don't want to redirect admins trying to edit
        if (shouldAutoRedirect && redirectUrl && redirectUrl !== url && !isAdmin && !isEditMode) {
          // Track the redirect before redirecting
          const safeUserAgent = (navigator.userAgent || '').substring(0, 2000);
          const safeOldUrl = url.substring(0, 8000);
          const safeRedirectUrl = redirectUrl.substring(0, 8000);
          const safePath = path.substring(0, 8000);

          await fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              oldUrl: safeOldUrl,
              newUrl: safeRedirectUrl,
              path: safePath,
              timestamp: new Date().toISOString(),
              userAgent: safeUserAgent,
              referrer: settings.enableReferrerTracking ? (document.referrer || '').substring(0, 2000) : undefined,
              ruleId: (foundRule?.id && typeof foundRule.id === 'string' && foundRule.id.length > 0) ? foundRule.id : undefined,
              matchQuality: currentMatchQuality,
            }),
          });
          
          // Perform auto-redirect
          window.location.href = redirectUrl;
          return;
        }

        // Set up UI state for migration page display
        if (foundRule) {
          setMatchingRule(foundRule);
          setInfoText(foundRule.infoText || "");
        }
        setNewUrl(generatedNewUrl);

        // Track URL access - only track once per page load
        // Truncate values to match schema limits
        const safeUserAgent = (navigator.userAgent || '').substring(0, 2000);
        const safeOldUrl = url.substring(0, 8000);
        const safeNewUrl = generatedNewUrl.substring(0, 8000);
        const safePath = path.substring(0, 8000);

        // Only track if not admin
        if (!isAdmin) {
            const trackResponse = await fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                oldUrl: safeOldUrl,
                newUrl: safeNewUrl,
                path: safePath,
                timestamp: new Date().toISOString(),
                userAgent: safeUserAgent,
                referrer: settings.enableReferrerTracking ? (document.referrer || '').substring(0, 2000) : undefined,
                ruleId: (foundRule?.id && typeof foundRule.id === 'string' && foundRule.id.length > 0) ? foundRule.id : undefined,
                ruleIds: foundRules.map(r => r.id).filter(id => typeof id === 'string' && id.length > 0),
                matchQuality: currentMatchQuality,
            }),
            });

            if (trackResponse.ok) {
                const trackData = await trackResponse.json();
                if (trackData.id) {
                    setTrackingId(trackData.id);
                }
            }
        }

      } catch (error) {
        console.error("Initialization error:", error);
        // Fallback to default URL generation
        setNewUrl(generateNewUrl(url));
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, [settings, settingsLoading, isAdmin, isEditMode]); // Re-run when settings are loaded or admin status changes

  // Check if user is already authenticated before showing password prompt
  const handleAdminAccess = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Prevent multiple clicks
    if (isCheckingAuth) return;

    // Explicitly reset any lingering modal state
    setShowPasswordModal(false);
    // Also ensure main dialog is closed if we are logging in
    setShowMainDialog(false);

    setIsCheckingAuth(true);
    try {
      const response = await fetch("/api/admin/status", {
        method: "GET",
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isAuthenticated) {
          // User is already logged in, update context
          setIsAdmin(true);
          // Don't call onAdminAccess(), stay on page in admin mode
          return;
        }
      }

      // User is not logged in, show password prompt
      setShowPasswordModal(true);
    } catch (error) {
      console.error("Auth check failed:", error);
      // On error, show password prompt as fallback
      setShowPasswordModal(true);
    } finally {
      setIsCheckingAuth(false);
    }
  };


  // Update URLs when settings are loaded (but not when matchingRule changes to avoid loops)
  useEffect(() => {
    if (settings && currentUrl && !isLoading) {
      if (matchingRule) {
        setNewUrl(generateUrlWithRule(currentUrl, matchingRule, settings.defaultNewDomain));
      } else {
        setNewUrl(generateNewUrl(currentUrl, settings.defaultNewDomain));
      }
    }
  }, [settings, currentUrl]); // Removed matchingRule from dependencies

  const handleCopy = async () => {
    try {
      await copyToClipboard(newUrl);
      setCopySuccess(true);
      setIsCopied(true);

      if (settings?.enableFeedbackSurvey && !hasAskedFeedback && !isEditMode) {
        setShowFeedbackPopup(true);
        setHasAskedFeedback(true);
      }

      setTimeout(() => {
        setCopySuccess(false);
        setIsCopied(false);
      }, 3000);
    } catch (error) {
      toast({
        title: "Kopieren fehlgeschlagen",
        description: "Bitte kopieren Sie die URL manuell.",
        variant: "destructive",
      });
    }
  };

  const handleOpenNewTab = () => {
    if (isEditMode) return;
    window.open(newUrl, '_blank');
    if (settings?.enableFeedbackSurvey && !hasAskedFeedback) {
      setShowFeedbackPopup(true);
      setHasAskedFeedback(true);
    }
  };

  const handleFeedback = async (feedback: 'OK' | 'NOK') => {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId: matchingRule?.id,
          trackingId: trackingId || undefined,
          feedback,
          url: currentUrl
        }),
      });
      setFeedbackSuccess(true);
      setTimeout(() => {
        setShowFeedbackPopup(false);
        setFeedbackSuccess(false); // Reset for next time
      }, 2000);
    } catch (error) {
      console.error("Feedback error:", error);
      setShowFeedbackPopup(false);
    }
  };

  const handleAdminSuccess = () => {
    setIsAdmin(true);
  };

  const handleInfoItemUpdate = async (index: number, value: string) => {
      if (!settings) return;
      const newItems = [...(settings.infoItems || [])];
      newItems[index] = value;
      await handleUpdateSetting({ infoItems: newItems });
  };

  const handleAddInfoItem = async () => {
      if (!settings) return;
      const newItems = [...(settings.infoItems || []), "Neuer Info-Punkt"];
      const newIcons = [...(settings.infoIcons || []), "Bookmark" as const];
      await handleUpdateSetting({ infoItems: newItems, infoIcons: newIcons });
  };

  const handleRemoveInfoItem = async (index: number) => {
      if (!settings) return;
      const newItems = settings.infoItems.filter((_, i) => i !== index);
      const newIcons = settings.infoIcons.filter((_, i) => i !== index);
      await handleUpdateSetting({ infoItems: newItems, infoIcons: newIcons });
  };

  const handleInfoIconUpdate = async (index: number, icon: string) => {
      if (!settings) return;
      const newIcons = [...(settings.infoIcons || [])];
      newIcons[index] = icon as any;
      await handleUpdateSetting({ infoIcons: newIcons });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AdminToolbar
        onLogout={() => logoutMutation.mutate()}
        onOpenAdmin={() => onAdminAccess()} // This now acts as "Settings" button
      />

      {/* Header */}
      <InlineColorWrapper
        color={settings?.headerBackgroundColor || "#ffffff"}
        onSave={(color) => handleUpdateSetting({ headerBackgroundColor: color })}
        className="w-full"
      >
      <header className="bg-surface shadow-sm border-b border-border" style={{ backgroundColor: settings?.headerBackgroundColor || 'white' }}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <InlineImage
                src={settings?.headerLogoUrl || undefined}
                className="h-8 w-auto object-contain"
                placeholder={
                    !settings?.headerLogoUrl && !settings?.headerIcon ?
                    <div className="h-8 w-8 bg-gray-100 flex items-center justify-center rounded text-xs text-gray-500">Logo</div> : null
                }
                onSave={(url) => handleUpdateSetting({ headerLogoUrl: url })}
                onDelete={async () => {
                    await apiRequest("DELETE", "/api/admin/logo");
                    queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                }}
              />

              {!settings?.headerLogoUrl && (
                  <InlineIconPicker
                    iconName={settings?.headerIcon || "ArrowRightLeft"}
                    onSave={(icon) => handleUpdateSetting({ headerIcon: icon as any })}
                  >
                    {(() => {
                        const IconComponent = getIconComponent(settings?.headerIcon || "ArrowRightLeft");
                        return settings?.headerIcon !== "none" ? <IconComponent className="text-primary text-2xl" /> : null;
                    })()}
                  </InlineIconPicker>
              )}

              <h1 className="text-xl font-semibold text-foreground">
                <InlineText
                    value={settings?.headerTitle || "URL Migration Tool"}
                    onSave={(val) => handleUpdateSetting({ headerTitle: val })}
                    label="Header Titel"
                />
              </h1>
            </div>
            <div></div>
          </div>
        </div>
      </header>
      </InlineColorWrapper>

      {/* Main Content */}
      <main className="flex-1 py-8 px-4 pb-20">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Loading State */}
          {isLoading && (
            <Card className="animate-fade-in">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">URL wird analysiert...</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!isLoading && (
            <div className="space-y-6">
              {/* Inline PopUp Mode Display (if configured as Inline or if we are editing) */}
              {(settings?.popupMode === 'inline' || isEditMode) && (
                <div className="relative group">
                    {/* Visual indicator that this is the "Popup Content" being edited inline */}
                    {isEditMode && <div className="absolute -top-3 left-0 bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full border border-blue-200 z-10">Popup / Main Content</div>}

                    <InlineSemanticColorPicker
                        color={settings?.alertBackgroundColor || "yellow"}
                        onSave={(color) => handleUpdateSetting({ alertBackgroundColor: color as any })}
                    >
                    <div className={`${getBackgroundColor(settings?.alertBackgroundColor || 'yellow')} rounded-lg p-4 flex items-start space-x-3 transition-colors`}>
                        <InlineIconPicker
                            iconName={settings?.alertIcon || "AlertTriangle"}
                            onSave={(icon) => handleUpdateSetting({ alertIcon: icon as any })}
                        >
                        {(() => {
                            const IconComponent = getIconComponent(settings?.alertIcon || 'AlertTriangle');
                            return <IconComponent className="h-5 w-5 mt-0.5" />;
                        })()}
                        </InlineIconPicker>
                    <div>
                        <h3 className="font-semibold">
                            <InlineText
                                value={settings?.mainTitle || "Veralteter Link erkannt"}
                                onSave={(val) => handleUpdateSetting({ mainTitle: val })}
                                label="Haupttitel"
                            />
                        </h3>
                        <div className="text-sm mt-1">
                            <InlineText
                                value={settings?.mainDescription || ""}
                                onSave={(val) => handleUpdateSetting({ mainDescription: val })}
                                multiline
                                label="Hauptbeschreibung"
                            />
                        </div>
                    </div>
                    </div>
                    </InlineSemanticColorPicker>
                </div>
              )}

              {/* URL Comparison Section - Shown on main page when requested */}
              {showUrlComparison && (
                <InlineColorWrapper
                    color={settings?.urlComparisonBackgroundColor || "#ffffff"}
                    onSave={(color) => handleUpdateSetting({ urlComparisonBackgroundColor: color })}
                >
                <Card className="animate-fade-in border-green-200 bg-green-50 transition-colors" style={{ backgroundColor: settings?.urlComparisonBackgroundColor || 'white' }}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2 text-green-800">
                        <InlineIconPicker
                            iconName={settings?.urlComparisonIcon || "ArrowRightLeft"}
                            onSave={(icon) => handleUpdateSetting({ urlComparisonIcon: icon as any })}
                        >
                        {settings?.urlComparisonIcon && settings.urlComparisonIcon !== "none" ? (
                          (() => {
                            const IconComponent = getIconComponent(settings.urlComparisonIcon);
                            return <IconComponent className="h-5 w-5" />;
                          })()
                        ) : (
                          <ArrowRightLeft className="h-5 w-5" />
                        )}
                        </InlineIconPicker>
                        <span>
                            <InlineText
                                value={settings?.urlComparisonTitle || "URL-Vergleich"}
                                onSave={(val) => handleUpdateSetting({ urlComparisonTitle: val })}
                                label="Vergleichstitel"
                            />
                        </span>
                      </CardTitle>

                      {/* Quality Gauge in Top Right */}
                      {settings?.showLinkQualityGauge && (
                        <QualityGauge score={matchQuality} level={matchLevel} explanation={matchExplanation} />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* New URL */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        <CheckCircle className="inline text-green-500 mr-2" />
                        <InlineText
                            value={settings?.newUrlLabel || "Neue URL"}
                            onSave={(val) => handleUpdateSetting({ newUrlLabel: val })}
                            className="inline-block"
                            label="Label Neue URL"
                        />
                      </label>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <div
                                  className="bg-green-50 border border-green-200 rounded-md p-3 hover:bg-green-100 transition-colors cursor-pointer h-full flex items-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 outline-none"
                                  onClick={handleCopy}
                                  role="button"
                                  tabIndex={0}
                                  aria-label="Neue URL in die Zwischenablage kopieren"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      handleCopy();
                                    }
                                  }}
                                >
                                    <code className="text-sm text-green-800 break-all">
                                    {newUrl}
                                    </code>
                                </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                <p>Klicken zum Kopieren</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={handleCopy}
                        className="flex items-center space-x-2 transition-all duration-200"
                        aria-label={isCopied ? "URL kopiert" : "Neue URL in Zwischenablage kopieren"}
                        variant={isCopied ? "outline" : "default"}
                        disabled={isEditMode}
                      >
                        {isCopied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        <span>
                            <InlineText
                                value={isCopied ? "Kopiert!" : (settings?.copyButtonText || "URL kopieren")}
                                onSave={(val) => handleUpdateSetting({ copyButtonText: val })}
                                label="Button Kopieren"
                            />
                        </span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleOpenNewTab}
                        className="flex items-center space-x-2"
                        aria-label="Neue URL in neuem Tab öffnen"
                        disabled={isEditMode}
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>
                            <InlineText
                                value={settings?.openButtonText || "In neuem Tab öffnen"}
                                onSave={(val) => handleUpdateSetting({ openButtonText: val })}
                                label="Button Öffnen"
                            />
                        </span>
                      </Button>
                    </div>

                    {/* Success Message */}
                    {copySuccess && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          URL erfolgreich in die Zwischenablage kopiert!
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Special hints for this URL - always shown below buttons */}
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <InlineIconPicker
                            iconName={settings?.specialHintsIcon || "Info"}
                            onSave={(icon) => handleUpdateSetting({ specialHintsIcon: icon as any })}
                        >
                        {settings?.specialHintsIcon && settings.specialHintsIcon !== "none" ? (
                          (() => {
                            const IconComponent = getIconComponent(settings.specialHintsIcon);
                            return <IconComponent className="h-4 w-4 text-blue-600" />;
                          })()
                        ) : (
                          <Info className="h-4 w-4 text-blue-600" />
                        )}
                        </InlineIconPicker>
                        <span className="text-sm font-bold text-blue-800">
                          <InlineText
                            value={settings?.specialHintsTitle || "Spezielle Hinweise"}
                            onSave={(val) => handleUpdateSetting({ specialHintsTitle: val })}
                            label="Hinweis Titel"
                          />
                        </span>
                      </div>
                      <div className="text-sm text-blue-700 space-y-2">
                        {infoText ? (
                          infoText.split('\\n').map((line, index) => (
                            <p key={index}>{line}</p>
                          ))
                        ) : (
                          <p>
                              <InlineText
                                value={settings?.specialHintsDescription || "Standard Hinweis Text"}
                                onSave={(val) => handleUpdateSetting({ specialHintsDescription: val })}
                                multiline
                                label="Hinweis Text"
                              />
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Old URL */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        <XCircle className="inline text-red-500 mr-2" />
                        <InlineText
                            value={settings?.oldUrlLabel || "Alte URL"}
                            onSave={(val) => handleUpdateSetting({ oldUrlLabel: val })}
                            className="inline-block"
                            label="Label Alte URL"
                        />
                      </label>
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <code className="text-sm text-red-800 break-all">
                          {currentUrl}
                        </code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </InlineColorWrapper>
              )}

              {/* Additional Information Card - Only show if there are info items OR if in edit mode */}
              {(isEditMode || (settings?.infoItems && settings.infoItems.some(item => item && item.trim()))) && (
                <Card className="animate-fade-in relative">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <InlineIconPicker
                        iconName={settings?.infoTitleIcon || "Info"}
                        onSave={(icon) => handleUpdateSetting({ infoTitleIcon: icon as any })}
                      >
                      {settings?.infoTitleIcon && settings.infoTitleIcon !== "none" ? (
                        (() => {
                          const IconComponent = getIconComponent(settings.infoTitleIcon);
                          return <IconComponent className="h-5 w-5 text-primary" />;
                        })()
                      ) : (
                        <Info className="h-5 w-5 text-primary" />
                      )}
                      </InlineIconPicker>
                      <span>
                          <InlineText
                            value={settings?.infoTitle || "Wichtige Hinweise"}
                            onSave={(val) => handleUpdateSetting({ infoTitle: val })}
                            label="Info Titel"
                          />
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-muted-foreground">
                      {settings?.infoItems?.map((item, index) => (
                        (isEditMode || (item && item.trim())) ? (
                          <li key={index} className="flex items-start space-x-3 group">
                            <InlineIconPicker
                                iconName={settings?.infoIcons?.[index] || 'Bookmark'}
                                onSave={(icon) => handleInfoIconUpdate(index, icon)}
                            >
                            {(() => {
                              const iconName = settings?.infoIcons?.[index] || 'Bookmark';
                              const IconComponent = getIconComponent(iconName);
                              return <IconComponent className="h-4 w-4 text-primary mt-1 flex-shrink-0" />;
                            })()}
                            </InlineIconPicker>
                            <span className="flex-1">
                                <InlineText
                                    value={item}
                                    onSave={(val) => handleInfoItemUpdate(index, val)}
                                    placeholder="Info Punkt Text"
                                    label={`Info Punkt ${index + 1}`}
                                />
                            </span>
                            {isEditMode && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-500"
                                    onClick={() => handleRemoveInfoItem(index)}
                                >
                                    <Trash className="h-4 w-4" />
                                </Button>
                            )}
                          </li>
                        ) : null
                      ))}

                      {isEditMode && (
                          <li className="pt-2">
                              <Button variant="outline" size="sm" onClick={handleAddInfoItem} className="w-full border-dashed">
                                  <Plus className="h-4 w-4 mr-2" /> Punkt hinzufügen
                              </Button>
                          </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full z-50 bg-background border-t border-border py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
             <InlineText
                value={settings?.footerCopyright || ""}
                onSave={(val) => handleUpdateSetting({ footerCopyright: val })}
                label="Footer Copyright"
                placeholder={`© ${currentYear} ${fallbackAppName}. Alle Rechte vorbehalten.`}
             />
             <span className="ml-2 text-xs opacity-50">v{__APP_VERSION__}</span>
          </div>
          <div className="flex items-center space-x-2">
            {!isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleAdminAccess(e)}
              disabled={isCheckingAuth}
              className="text-muted-foreground hover:text-primary"
              title="Administrator-Bereich"
              aria-label="Administrator-Bereich öffnen"
            >
              <Settings className="h-4 w-4" />
            </Button>
            )}
          </div>
        </div>
      </footer>

      {/* Main Migration Dialog (Popup) */}
      {(settings?.popupMode === 'active' && !isEditMode) && (
      <Dialog open={showMainDialog} onOpenChange={setShowMainDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" style={{ backgroundColor: settings?.mainBackgroundColor || 'white' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                settings?.alertBackgroundColor === 'red' ? 'bg-red-100 dark:bg-red-900/30' :
                settings?.alertBackgroundColor === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                settings?.alertBackgroundColor === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                settings?.alertBackgroundColor === 'gray' ? 'bg-gray-100 dark:bg-gray-900/30' :
                'bg-yellow-100 dark:bg-yellow-900/30'
              }`}>
                {(() => {
                  const IconComponent = getIconComponent(settings?.alertIcon || 'AlertTriangle');
                  const iconColor = 
                    settings?.alertBackgroundColor === 'red' ? 'text-red-600 dark:text-red-400' :
                    settings?.alertBackgroundColor === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                    settings?.alertBackgroundColor === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                    settings?.alertBackgroundColor === 'gray' ? 'text-gray-600 dark:text-gray-400' :
                    'text-yellow-600 dark:text-yellow-400';
                  return <IconComponent className={`text-lg ${iconColor}`} />;
                })()}
              </div>
              <span>{settings?.mainTitle || "Veralteter Link erkannt"}</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {settings?.mainDescription || "Sie verwenden einen veralteten Link unserer Web-App. Bitte aktualisieren Sie Ihre Lesezeichen und verwenden Sie die neue URL unten."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Simple popup content */}
            <div className="text-center space-y-4">
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => {
                    setShowMainDialog(false);
                  }}
                  className="flex items-center space-x-2"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>{settings?.showUrlButtonText || "Zeige mir die neue URL"}</span>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      )}

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={handleAdminSuccess}
      />

      {/* Feedback Survey Dialog */}
      <Dialog open={showFeedbackPopup} onOpenChange={setShowFeedbackPopup}>
        <DialogContent className="sm:max-w-md">
          {feedbackSuccess ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-fade-in">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <DialogTitle className="text-xl">{settings?.feedbackSuccessMessage || "Danke für Ihr Feedback!"}</DialogTitle>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{settings?.feedbackSurveyTitle || "Hat die Weiterleitung funktioniert?"}</DialogTitle>
                <DialogDescription>
                  {settings?.feedbackSurveyQuestion || "Bitte bewerten Sie die Zielseite."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center gap-6 py-6">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-24 h-24 rounded-xl flex flex-col gap-2 hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-all duration-200"
                  onClick={() => handleFeedback('OK')}
                >
                  <ThumbsUp className="h-8 w-8" />
                  <span>{settings?.feedbackButtonYes || "Ja, OK"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-24 h-24 rounded-xl flex flex-col gap-2 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-all duration-200"
                  onClick={() => handleFeedback('NOK')}
                >
                  <ThumbsDown className="h-8 w-8" />
                  <span>{settings?.feedbackButtonNo || "Nein"}</span>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MigrationPage(props: MigrationPageProps) {
  return (
    <EditModeProvider>
      <MigrationPageContent {...props} />
    </EditModeProvider>
  );
}
