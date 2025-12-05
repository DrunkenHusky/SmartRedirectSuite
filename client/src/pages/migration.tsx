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
  Bell
} from "lucide-react";
import { generateNewUrl, generateUrlWithRule, extractPath, copyToClipboard } from "@/lib/url-utils";
import { useToast } from "@/hooks/use-toast";
import { PasswordModal } from "@/components/ui/password-modal";
import { QualityGauge } from "@/components/ui/quality-gauge";
import { useQuery } from "@tanstack/react-query";
import type { UrlRule, GeneralSettings } from "@shared/schema";

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
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const fallbackAppName = __APP_NAME__ || "URL Migration Service";

  // Check if user is already authenticated before showing password prompt
  const handleAdminAccess = async () => {
    setIsCheckingAuth(true);
    try {
      const response = await fetch("/api/admin/status", {
        method: "GET",
        credentials: "include"
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
      // On error, show password prompt as fallback
      setShowPasswordModal(true);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Fetch general settings for customizable texts
  const { data: settings, isLoading: settingsLoading } = useQuery<GeneralSettings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      setShowMainDialog(settings.popupMode === 'active');
    }
  }, [settings]);

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
        
        if (ruleResponse.ok) {
          const { rule, hasMatch, matchQuality: quality, matchLevel: level, matchingRules } = await ruleResponse.json();
          
          if (hasMatch && rule) {
            foundRule = rule;
            foundRules = matchingRules || [rule];
            setMatchQuality(quality || 0);
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
                setMatchQuality(100);
                setMatchLevel('green');
                setMatchExplanation(settings.matchRootExplanation || "Startseite erkannt. Direkte Weiterleitung auf die neue Domain.");
            } else {
                setMatchQuality(0);
                setMatchLevel('red');
                setMatchExplanation(settings.matchNoneExplanation || "Die URL konnte nicht spezifisch zugeordnet werden. Es wird auf die Standard-Seite weitergeleitet.");
            }

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
              ruleId: (foundRule?.id && typeof foundRule.id === 'string' && foundRule.id.length > 0) ? foundRule.id : undefined,
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

        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oldUrl: safeOldUrl,
            newUrl: safeNewUrl,
            path: safePath,
            timestamp: new Date().toISOString(),
            userAgent: safeUserAgent,
            ruleId: (foundRule?.id && typeof foundRule.id === 'string' && foundRule.id.length > 0) ? foundRule.id : undefined,
            ruleIds: foundRules.map(r => r.id).filter(id => typeof id === 'string' && id.length > 0),
          }),
        });

      } catch (error) {
        console.error("Initialization error:", error);
        // Fallback to default URL generation
        setNewUrl(generateNewUrl(url));
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, [settings, settingsLoading]); // Re-run when settings are loaded

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
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (error) {
      toast({
        title: "Kopieren fehlgeschlagen",
        description: "Bitte kopieren Sie die URL manuell.",
        variant: "destructive",
      });
    }
  };

  const handleOpenNewTab = () => {
    window.open(newUrl, '_blank');
  };

  const handleAdminSuccess = () => {
    onAdminAccess();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-surface shadow-sm border-b border-border" style={{ backgroundColor: settings?.headerBackgroundColor || 'white' }}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {settings?.headerLogoUrl ? (
                <img 
                  src={settings.headerLogoUrl.startsWith('/objects/') ? settings.headerLogoUrl : settings.headerLogoUrl} 
                  alt="Logo" 
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    // Fallback to icon if logo fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : settings?.headerIcon && settings.headerIcon !== "none" ? (
                (() => {
                  const IconComponent = getIconComponent(settings.headerIcon);
                  return <IconComponent className="text-primary text-2xl" />;
                })()
              ) : null}
              <h1 className="text-xl font-semibold text-foreground">
                {settings?.headerTitle || "URL Migration Tool"}
              </h1>
            </div>
            <div></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-8 px-4">
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
              {settings?.popupMode === 'inline' && (
                <div className={`${getBackgroundColor(settings?.alertBackgroundColor || 'yellow')} rounded-lg p-4 flex items-start space-x-3`}>
                  {(() => {
                    const IconComponent = getIconComponent(settings?.alertIcon || 'AlertTriangle');
                    return <IconComponent className="h-5 w-5 mt-0.5" />;
                  })()}
                  <div>
                    <h3 className="font-semibold">{settings?.mainTitle || "Veralteter Link erkannt"}</h3>
                    <p className="text-sm mt-1">{settings?.mainDescription || "Sie verwenden einen veralteten Link unserer Web-App. Bitte aktualisieren Sie Ihre Lesezeichen und verwenden Sie die neue URL unten."}</p>
                  </div>
                </div>
              )}

              {/* URL Comparison Section - Shown on main page when requested */}
              {showUrlComparison && (
                <Card className="animate-fade-in border-green-200 bg-green-50" style={{ backgroundColor: settings?.urlComparisonBackgroundColor || 'white' }}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2 text-green-800">
                        {settings?.urlComparisonIcon && settings.urlComparisonIcon !== "none" ? (
                          (() => {
                            const IconComponent = getIconComponent(settings.urlComparisonIcon);
                            return <IconComponent className="h-5 w-5" />;
                          })()
                        ) : (
                          <ArrowRightLeft className="h-5 w-5" />
                        )}
                        <span>{settings?.urlComparisonTitle || "URL-Vergleich"}</span>
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
                        {settings?.newUrlLabel || "Neue URL (verwenden Sie diese)"}
                      </label>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <div className="bg-green-50 border border-green-200 rounded-md p-3 hover:bg-green-100 transition-colors cursor-help h-full flex items-center">
                                    <code className="text-sm text-green-800 break-all">
                                    {newUrl}
                                    </code>
                                </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                <p>So sieht die neue Ziel-URL aus</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                      </div>
                    </div>



                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={handleCopy}
                        className="flex items-center space-x-2"
                        aria-label="Neue URL in Zwischenablage kopieren"
                      >
                        <Copy className="h-4 w-4" />
                        <span>{settings?.copyButtonText || "URL kopieren"}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleOpenNewTab}
                        className="flex items-center space-x-2"
                        aria-label="Neue URL in neuem Tab öffnen"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>{settings?.openButtonText || "In neuem Tab öffnen"}</span>
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
                        {settings?.specialHintsIcon && settings.specialHintsIcon !== "none" ? (
                          (() => {
                            const IconComponent = getIconComponent(settings.specialHintsIcon);
                            return <IconComponent className="h-4 w-4 text-blue-600" />;
                          })()
                        ) : (
                          <Info className="h-4 w-4 text-blue-600" />
                        )}
                        <span className="text-sm font-bold text-blue-800">
                          {settings?.specialHintsTitle || "Spezielle Hinweise für diese URL"}
                        </span>
                      </div>
                      <div className="text-sm text-blue-700 space-y-2">
                        {infoText ? (
                          infoText.split('\\n').map((line, index) => (
                            <p key={index}>{line}</p>
                          ))
                        ) : (
                          <p>{settings?.specialHintsDescription || "Hier finden Sie spezifische Informationen und Hinweise für die Migration dieser URL."}</p>
                        )}
                      </div>
                    </div>

                    {/* Old URL */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        <XCircle className="inline text-red-500 mr-2" />
                        {settings?.oldUrlLabel || "Alte URL (veraltet)"}
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

              {/* Additional Information Card - Only show if there are info items */}
              {settings?.infoItems && settings.infoItems.some(item => item && item.trim()) && (
                <Card className="animate-fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      {settings?.infoTitleIcon && settings.infoTitleIcon !== "none" ? (
                        (() => {
                          const IconComponent = getIconComponent(settings.infoTitleIcon);
                          return <IconComponent className="h-5 w-5 text-primary" />;
                        })()
                      ) : (
                        <Info className="h-5 w-5 text-primary" />
                      )}
                      <span>{settings?.infoTitle || "Wichtige Hinweise"}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-muted-foreground">
                      {settings.infoItems.map((item, index) => (
                        item && item.trim() ? (
                          <li key={index} className="flex items-start space-x-3">
                            {(() => {
                              const iconName = settings?.infoIcons?.[index] || 'Bookmark';
                              const IconComponent = getIconComponent(iconName);
                              return <IconComponent className="h-4 w-4 text-primary mt-1 flex-shrink-0" />;
                            })()}
                            <span>{item}</span>
                          </li>
                        ) : null
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-border py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {settings?.footerCopyright || `© ${currentYear} ${fallbackAppName}. Alle Rechte vorbehalten.`}
            <span className="ml-2 text-xs opacity-50">v{__APP_VERSION__}</span>
          </div>
          <div className="flex items-center space-x-2">

            <Button
              variant="ghost"
              size="sm"
              onClick={handleAdminAccess}
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
      {settings?.popupMode === 'active' && (
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
    </div>
  );
}
