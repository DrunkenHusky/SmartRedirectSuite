import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  Settings,
  Star,
  Heart,
  Bell,
  ThumbsUp,
  ThumbsDown,
  Plus
} from "lucide-react";
import { generateNewUrl, generateUrlWithRule, extractPath, copyToClipboard } from "@/lib/url-utils";
import { useToast } from "@/hooks/use-toast";
import { PasswordModal } from "@/components/ui/password-modal";
import { QualityGauge } from "@/components/ui/quality-gauge";
import type { UrlRule } from "@shared/schema";
import { useEditMode } from "@/context/EditModeContext";
import { InlineText } from "@/components/inline/InlineText";
import { InlineIcon } from "@/components/inline/InlineIcon";
import { InlineColor } from "@/components/inline/InlineColor";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface MigrationPageProps {
  onAdminAccess: () => void;
}

// Icon mapping function
const getIconComponent = (iconName: string) => {
  const iconMap = {
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
  } as const;
  return iconMap[iconName as keyof typeof iconMap] || AlertTriangle;
};

// Background color mapping
const getBackgroundColor = (color: string) => {
  const colorMap = {
    yellow: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-800",
    red: "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800",
    orange: "bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800",
    blue: "bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800",
    gray: "bg-gray-50 border-gray-200 dark:bg-gray-950/50 dark:border-gray-800"
  };
  return colorMap[color as keyof typeof colorMap] || colorMap.yellow;
};

export default function MigrationPage({ onAdminAccess }: MigrationPageProps) {
  const { t, i18n } = useTranslation();
  const { settings, isLoading: settingsLoading, updateSetting, isEditMode, updateTranslation, getLocalizedText } = useEditMode();

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
  const currentYear = new Date().getFullYear();
  const fallbackAppName = __APP_NAME__ || "URL Migration Service";

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
          // User is already logged in, go directly to admin
          onAdminAccess();
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

  useEffect(() => {
    if (settings) {
      setShowMainDialog(settings.popupMode === 'active');
    }
  }, [settings?.popupMode]);

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
      
      if (isAdminAccess && !isEditMode) {
        // Admin access requested - trigger login process directly
        setIsLoading(false);
        handleAdminAccess();
        return;
      }
      
      // Don't auto-redirect if in Edit Mode
      if (isEditMode) {
          setNewUrl(generateNewUrl(url, settings.defaultNewDomain));
          setIsLoading(false);
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
        
        // Handle auto-redirect
        if (shouldAutoRedirect && redirectUrl && redirectUrl !== url) {
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

      } catch (error) {
        console.error("Initialization error:", error);
        // Fallback to default URL generation
        setNewUrl(generateNewUrl(url));
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, [settings, settingsLoading, isEditMode]); // Re-run when settings are loaded or edit mode changes

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

      if (settings?.enableFeedbackSurvey && !hasAskedFeedback) {
        setShowFeedbackPopup(true);
        setHasAskedFeedback(true);
      }

      setTimeout(() => {
        setCopySuccess(false);
        setIsCopied(false);
      }, 3000);
    } catch (error) {
      toast({
        title: t('migration.copy_fail_title', "Kopieren fehlgeschlagen"),
        description: t('migration.copy_fail_desc', "Bitte kopieren Sie die URL manuell."),
        variant: "destructive",
      });
    }
  };

  const handleOpenNewTab = () => {
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
    onAdminAccess();
  };

  const handleInfoItemChange = (index: number, value: string) => {
    if (!settings) return;
    const newInfoItems = [...settings.infoItems];
    newInfoItems[index] = value;
    updateSetting("infoItems", newInfoItems);
  };

  const handleInfoIconChange = (index: number, value: string) => {
    if (!settings) return;
    const newInfoIcons = [...settings.infoIcons];
    newInfoIcons[index] = value as any;
    updateSetting("infoIcons", newInfoIcons);
  };

  const addInfoItem = () => {
    if (!settings) return;
    const newInfoItems = [...(settings.infoItems || [])];
    newInfoItems.push(t('migration.new_info_item', "New Info Item"));
    const newInfoIcons = [...(settings.infoIcons || [])];
    newInfoIcons.push("Info" as const);
    updateSetting("infoItems", newInfoItems);
    updateSetting("infoIcons", newInfoIcons);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-surface shadow-sm border-b border-border transition-colors duration-200" style={{ backgroundColor: settings?.headerBackgroundColor || 'white' }}>
        <div className="max-w-4xl mx-auto px-4 py-4 relative group/header">
          {isEditMode && <div className="absolute top-2 right-2 z-10">
              <InlineColor
                  value={settings?.headerBackgroundColor || '#ffffff'}
                  onChange={(val) => updateSetting('headerBackgroundColor', val)}
              />
          </div>}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {settings?.headerLogoUrl ? (
                <img 
                  src={settings.headerLogoUrl}
                  alt={t('migration.logo_alt', "Logo")}
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    // Fallback to icon if logo fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <InlineIcon
                    value={settings?.headerIcon || "none"}
                    onChange={(val) => updateSetting('headerIcon', val as any)}
                    className="text-primary text-2xl"
                />
              )}
              <h1 className="text-xl font-semibold text-foreground">
                <InlineText
                    value={getLocalizedText('content.headerTitle', settings?.headerTitle || "URL Migration Tool")}
                    onChange={(val) => updateTranslation('content.headerTitle', val, i18n.language)}
                    className="text-xl font-semibold"
                />
              </h1>
            </div>
            <div></div>
          </div>
        </div>
      </header>

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
                    <p className="text-muted-foreground">{t('migration.analyzing', 'URL wird analysiert...')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!isLoading && (
            <div className="space-y-6">
              {(settings?.popupMode === 'inline' || isEditMode) && (
                <div className={`${getBackgroundColor(settings?.alertBackgroundColor || 'yellow')} rounded-lg p-4 flex items-start space-x-3 relative group/alert`}>
                    {isEditMode && <div className="absolute top-2 right-2 z-10">
                      <div className="flex gap-1">
                          <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs px-2 bg-background/50 hover:bg-background"
                              onClick={() => updateSetting('popupMode', settings?.popupMode === 'inline' ? 'active' : 'inline')}
                          >
                              {settings?.popupMode === 'inline' ? t('migration.switch_popup', 'Switch to Popup') : t('migration.switch_inline', 'Switch to Inline')}
                          </Button>
                      </div>
                    </div>}
                  <InlineIcon
                    value={settings?.alertIcon || 'AlertTriangle'}
                    onChange={(val) => updateSetting('alertIcon', val as any)}
                    className="h-5 w-5 mt-0.5"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">
                        <InlineText
                            value={getLocalizedText('content.mainTitle', settings?.mainTitle || "Veralteter Link erkannt")}
                            onChange={(val) => updateTranslation('content.mainTitle', val, i18n.language)}
                            className="font-semibold"
                        />
                    </h3>
                    <p className="text-sm mt-1">
                        <InlineText
                            value={getLocalizedText('content.mainDescription', settings?.mainDescription || "")}
                            onChange={(val) => updateTranslation('content.mainDescription', val, i18n.language)}
                            multiline
                            className="text-sm"
                        />
                    </p>
                  </div>
                </div>
              )}

              {/* URL Comparison Section - Shown on main page when requested */}
              {showUrlComparison && (
                <Card className="animate-fade-in border-green-200 bg-green-50 relative group/comparison" style={{ backgroundColor: settings?.urlComparisonBackgroundColor || 'white' }}>
                    {isEditMode && <div className="absolute top-2 right-2 z-10">
                        <InlineColor
                            value={settings?.urlComparisonBackgroundColor || '#ffffff'}
                            onChange={(val) => updateSetting('urlComparisonBackgroundColor', val)}
                        />
                    </div>}
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2 text-green-800">
                        <InlineIcon
                            value={settings?.urlComparisonIcon || "ArrowRightLeft"}
                            onChange={(val) => updateSetting('urlComparisonIcon', val as any)}
                            className="h-5 w-5"
                        />
                        <span>
                            <InlineText
                                value={getLocalizedText('content.urlComparisonTitle', settings?.urlComparisonTitle || "URL-Vergleich")}
                                onChange={(val) => updateTranslation('content.urlComparisonTitle', val, i18n.language)}
                                className="font-semibold"
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
                            value={getLocalizedText('content.newUrlLabel', settings?.newUrlLabel || "Neue URL (verwenden Sie diese)")}
                            onChange={(val) => updateTranslation('content.newUrlLabel', val, i18n.language)}
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
                                <p>{t('migration.copy_tooltip', 'Klicken zum Kopieren')}</p>
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
                            {isCopied ? t('migration.copied', 'Kopiert!') : (
                                <InlineText
                                    value={getLocalizedText('content.copyButtonText', settings?.copyButtonText || "URL kopieren")}
                                    onChange={(val) => updateTranslation('content.copyButtonText', val, i18n.language)}
                                    className={isEditMode ? "pointer-events-none" : ""}
                                />
                            )}
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
                                value={getLocalizedText('content.openButtonText', settings?.openButtonText || "In neuem Tab öffnen")}
                                onChange={(val) => updateTranslation('content.openButtonText', val, i18n.language)}
                            />
                        </span>
                      </Button>
                    </div>

                    {/* Success Message */}
                    {copySuccess && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          {t('migration.copy_success', 'URL erfolgreich in die Zwischenablage kopiert!')}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Special hints for this URL - always shown below buttons */}
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <InlineIcon
                            value={settings?.specialHintsIcon || "Info"}
                            onChange={(val) => updateSetting('specialHintsIcon', val as any)}
                            className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm font-bold text-blue-800">
                          <InlineText
                              value={getLocalizedText('content.specialHintsTitle', settings?.specialHintsTitle || "Spezielle Hinweise für diese URL")}
                              onChange={(val) => updateTranslation('content.specialHintsTitle', val, i18n.language)}
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
                                  value={getLocalizedText('content.specialHintsDescription', settings?.specialHintsDescription || "Hier finden Sie spezifische Informationen und Hinweise für die Migration dieser URL.")}
                                  onChange={(val) => updateTranslation('content.specialHintsDescription', val, i18n.language)}
                                  multiline
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
                            value={getLocalizedText('content.oldUrlLabel', settings?.oldUrlLabel || "Alte URL (veraltet)")}
                            onChange={(val) => updateTranslation('content.oldUrlLabel', val, i18n.language)}
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
              )}

              {/* Additional Information Card - Only show if there are info items or in edit mode */}
              {(isEditMode || (settings?.infoItems && settings.infoItems.some(item => item && item.trim()))) && (
                <Card className="animate-fade-in group/info relative">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <InlineIcon
                            value={settings?.infoTitleIcon || "Info"}
                            onChange={(val) => updateSetting('infoTitleIcon', val as any)}
                            className="h-5 w-5 text-primary"
                        />
                        <span>
                            <InlineText
                                value={getLocalizedText('content.infoTitle', settings?.infoTitle || "Wichtige Hinweise")}
                                onChange={(val) => updateTranslation('content.infoTitle', val, i18n.language)}
                            />
                        </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-muted-foreground">
                      {settings?.infoItems.map((item, index) => (
                        (isEditMode || (item && item.trim())) ? (
                          <li key={index} className="flex items-start space-x-3 group/item relative">
                            <InlineIcon
                                value={settings?.infoIcons?.[index] || 'Bookmark'}
                                onChange={(val) => handleInfoIconChange(index, val)}
                                className="h-4 w-4 text-primary mt-1 flex-shrink-0"
                            />
                            <div className="flex-1">
                                <InlineText
                                    value={getLocalizedText(`content.infoItem_${index}`, item)}
                                    onChange={(val) => updateTranslation(`content.infoItem_${index}`, val, i18n.language)}
                                    placeholder="Empty info item"
                                />
                            </div>
                            {isEditMode && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-destructive opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100"
                                    onClick={() => {
                                        const newItems = [...settings.infoItems];
                                        newItems.splice(index, 1);
                                        const newIcons = [...settings.infoIcons];
                                        newIcons.splice(index, 1);
                                        updateSetting("infoItems", newItems);
                                        updateSetting("infoIcons", newIcons);
                                    }}
                                >
                                    <XCircle className="w-4 h-4" />
                                </Button>
                            )}
                          </li>
                        ) : null
                      ))}
                      {isEditMode && (
                          <li>
                              <Button variant="outline" size="sm" onClick={addInfoItem} className="w-full border-dashed">
                                  <Plus className="w-4 h-4 mr-2" /> {t('migration.add_info', 'Add Info Item')}
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
      <footer className="fixed bottom-0 w-full z-40 bg-background border-t border-border py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <InlineText
                value={getLocalizedText('content.footerCopyright', settings?.footerCopyright || `© ${currentYear} ${fallbackAppName}. Alle Rechte vorbehalten.`)}
                onChange={(val) => updateTranslation('content.footerCopyright', val, i18n.language)}
            />
            <span className="ml-2 text-xs opacity-50">v{__APP_VERSION__}</span>
          </div>
          <div className="flex items-center space-x-2">
            <LanguageSwitcher />

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
          </div>
        </div>
      </footer>

      {/* Main Migration Dialog (Popup) */}
      {/* We only show the dialog if NOT in edit mode, OR if we are in edit mode but editing the popup specifically?
          Actually, editing the popup inline is tricky if it's a dialog.
          Let's allow editing the popup if it's open.
      */}
      {showMainDialog && (
      <Dialog open={showMainDialog} onOpenChange={setShowMainDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" style={{ backgroundColor: settings?.mainBackgroundColor || 'white' }}>
            {isEditMode && <div className="absolute top-2 right-12 z-50 flex gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2 bg-background/50 hover:bg-background"
                    onClick={() => updateSetting('popupMode', 'inline')}
                >
                    {t('migration.switch_inline', 'Switch to Inline')}
                </Button>
                <InlineColor
                    value={settings?.mainBackgroundColor || '#ffffff'}
                    onChange={(val) => updateSetting('mainBackgroundColor', val)}
                />
            </div>}
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center relative group/alert-icon ${
                settings?.alertBackgroundColor === 'red' ? 'bg-red-100 dark:bg-red-900/30' :
                settings?.alertBackgroundColor === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                settings?.alertBackgroundColor === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                settings?.alertBackgroundColor === 'gray' ? 'bg-gray-100 dark:bg-gray-900/30' :
                'bg-yellow-100 dark:bg-yellow-900/30'
              }`}>
                <InlineIcon
                    value={settings?.alertIcon || 'AlertTriangle'}
                    onChange={(val) => updateSetting('alertIcon', val as any)}
                    className={`text-lg ${
                        settings?.alertBackgroundColor === 'red' ? 'text-red-600 dark:text-red-400' :
                        settings?.alertBackgroundColor === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                        settings?.alertBackgroundColor === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                        settings?.alertBackgroundColor === 'gray' ? 'text-gray-600 dark:text-gray-400' :
                        'text-yellow-600 dark:text-yellow-400'
                    }`}
                />
                {isEditMode && (
                    <div className="absolute -bottom-6 left-0 w-full flex justify-center">
                        <select
                            className="text-[10px] border rounded bg-background"
                            value={settings?.alertBackgroundColor || 'yellow'}
                            onChange={(e) => updateSetting('alertBackgroundColor', e.target.value as any)}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <option value="yellow">Yellow</option>
                            <option value="red">Red</option>
                            <option value="orange">Orange</option>
                            <option value="blue">Blue</option>
                            <option value="gray">Gray</option>
                        </select>
                    </div>
                )}
              </div>
              <span>
                  <InlineText
                      value={getLocalizedText('content.mainTitle', settings?.mainTitle || "Veralteter Link erkannt")}
                      onChange={(val) => updateTranslation('content.mainTitle', val, i18n.language)}
                  />
              </span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
                <InlineText
                    value={getLocalizedText('content.mainDescription', settings?.mainDescription || "")}
                    onChange={(val) => updateTranslation('content.mainDescription', val, i18n.language)}
                    multiline
                />
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
                  <span>
                      <InlineText
                          value={getLocalizedText('content.showUrlButtonText', settings?.showUrlButtonText || "Zeige mir die neue URL")}
                          onChange={(val) => updateTranslation('content.showUrlButtonText', val, i18n.language)}
                      />
                  </span>
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
              <DialogTitle className="text-xl">
                  {getLocalizedText('content.feedbackSuccessMessage', settings?.feedbackSuccessMessage || "Danke für Ihr Feedback!")}
              </DialogTitle>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                    {getLocalizedText('content.feedbackSurveyTitle', settings?.feedbackSurveyTitle || "Hat die Weiterleitung funktioniert?")}
                </DialogTitle>
                <DialogDescription>
                  {getLocalizedText('content.feedbackSurveyQuestion', settings?.feedbackSurveyQuestion || "Bitte bewerten Sie die Zielseite.")}
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
                  <span>{getLocalizedText('content.feedbackButtonYes', settings?.feedbackButtonYes || "Ja, OK")}</span>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-24 h-24 rounded-xl flex flex-col gap-2 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-all duration-200"
                  onClick={() => handleFeedback('NOK')}
                >
                  <ThumbsDown className="h-8 w-8" />
                  <span>{getLocalizedText('content.feedbackButtonNo', settings?.feedbackButtonNo || "Nein")}</span>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
