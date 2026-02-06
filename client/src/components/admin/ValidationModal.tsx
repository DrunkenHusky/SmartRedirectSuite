import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, AlertTriangle, Play, RefreshCw, Download, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { findMatchingRule } from "@shared/ruleMatching";
import { traceUrlGeneration, UrlTraceResult } from "@/lib/url-trace";
import { RULE_MATCHING_CONFIG } from "@shared/constants";

interface ValidationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onEditRule: (ruleId: number) => void;
    rules?: any[];
    settings?: any;
    reloadTrigger?: number;
    isLoadingRules?: boolean;
}

function ResultRow({ result, onEditRule }: { result: any, onEditRule: (id: number) => void }) {
    const [expanded, setExpanded] = useState(false);

    // Quality indicator color
    const getQualityColor = (quality: number) => {
        if (quality >= 100) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        if (quality >= 75) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        if (quality >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    };

    return (
        <>
            <tr className="border-b hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setExpanded(!expanded)}>
                <td className="p-3 w-10 text-center">
                    {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </td>
                <td className="p-3 font-mono text-sm max-w-[250px] truncate" title={result.url}>
                    {result.url}
                </td>
                <td className="p-3 font-mono text-sm max-w-[250px] truncate" title={result.traceResult.finalUrl}>
                    {result.traceResult.finalUrl}
                </td>
                <td className="p-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getQualityColor(result.matchDetails?.quality || 0)}`}>
                        {result.matchDetails?.quality || 0}%
                    </span>
                </td>
                <td className="p-3 text-sm text-right">
                     {result.rule ? (
                         <div
                             className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 cursor-pointer hover:bg-blue-200"
                             onClick={(e) => {
                                 e.stopPropagation();
                                 onEditRule(result.rule.id);
                             }}
                             title="Regel bearbeiten"
                         >
                             {result.rule.infoText || result.rule.matcher || `Rule #${result.rule.id}`}
                         </div>
                     ) : (
                         <span className="text-muted-foreground">-</span>
                     )}
                </td>
            </tr>
            {expanded && (
                <tr className="bg-muted/30 dark:bg-muted/10">
                    <td colSpan={5} className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Rule Config */}
                            <div className="border rounded-md p-4 bg-background shadow-sm">
                                <h4 className="font-semibold text-sm mb-3 flex justify-between items-center border-b pb-2">
                                    Angewandte Regel
                                    {result.rule && (
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onEditRule(result.rule.id); }}>
                                            <ExternalLink className="h-3 w-3 mr-1" /> Bearbeiten
                                        </Button>
                                    )}
                                </h4>
                                {result.rule ? (
                                    <dl className="text-sm space-y-2">
                                        <div className="grid grid-cols-[80px_1fr]"><dt className="text-muted-foreground">Name:</dt> <dd className="font-medium truncate" title={result.rule.matcher}>{result.rule.matcher}</dd></div>
                                        <div className="grid grid-cols-[80px_1fr]"><dt className="text-muted-foreground">Type:</dt> <dd>{result.rule.redirectType}</dd></div>
                                        <div className="grid grid-cols-[80px_1fr]"><dt className="text-muted-foreground">Target:</dt> <dd className="font-mono truncate" title={result.rule.targetUrl}>{result.rule.targetUrl || '-'}</dd></div>
                                        <div className="grid grid-cols-[80px_1fr]"><dt className="text-muted-foreground">Match:</dt>
                                            <dd>
                                                {result.matchDetails?.quality}%
                                                <span className="text-xs text-muted-foreground ml-2">({result.matchDetails?.level})</span>
                                            </dd>
                                        </div>
                                    </dl>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground py-2">Keine Regel gefunden.</p>
                                        {result.traceResult.searchFallback && (
                                            <div className="bg-blue-50 p-2 rounded text-sm border border-blue-100">
                                                <span className="font-medium text-blue-800">Smart Search Fallback:</span>
                                                <div className="mt-1 font-mono text-xs break-all text-blue-600">{result.traceResult.searchFallback}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Global Config */}
                            <div className="border rounded-md p-4 bg-background shadow-sm">
                                <h4 className="font-semibold text-sm mb-3 border-b pb-2">Globale Einstellungen</h4>
                                {result.traceResult.appliedGlobalRules.length > 0 ? (
                                    <ul className="text-sm space-y-2 max-h-[120px] overflow-y-auto">
                                        {result.traceResult.appliedGlobalRules.map((g: any, i: number) => (
                                            <li key={i} className="flex gap-2 items-start">
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                                                    g.type === 'search' ? 'bg-orange-100 text-orange-800' :
                                                    g.type === 'static' ? 'bg-purple-100 text-purple-800' :
                                                    'bg-green-100 text-green-800'
                                                }`}>{g.type}</span>
                                                <span className="break-words text-xs">{g.description}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground py-2">Keine globalen Regeln angewendet.</p>
                                )}
                            </div>
                        </div>

                        {/* Trace View */}
                        <div className="border rounded-md p-4 bg-background shadow-sm">
                             <h4 className="font-semibold text-sm mb-3 border-b pb-2">Änderungsverfolgung</h4>
                             <div className="space-y-2">
                                 {result.traceResult.steps.map((step: any, i: number) => (
                                     <div key={i} className={`text-sm p-3 rounded border-l-4 ${
                                         step.type === 'rule' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' :
                                         step.type === 'global' ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10' :
                                         'border-gray-300 bg-gray-50/50 dark:bg-gray-800/10'
                                     }`}>
                                         <div className="font-medium flex justify-between items-center mb-1">
                                             <span>{step.description}</span>
                                             <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{step.type}</span>
                                         </div>
                                         <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center mt-2 text-xs font-mono bg-white/50 dark:bg-black/20 p-2 rounded">
                                             <div className="truncate text-red-600/70 line-through decoration-red-400/50" title={step.urlBefore}>{step.urlBefore}</div>
                                             <div className="text-muted-foreground">→</div>
                                             <div className="truncate text-green-600 font-medium" title={step.urlAfter}>{step.urlAfter}</div>
                                         </div>
                                     </div>
                                 ))}
                             </div>

                             <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                                 <div className="flex items-center gap-1">
                                     <div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Regel
                                 </div>
                                 <div className="flex items-center gap-1">
                                     <div className="w-3 h-3 bg-orange-500 rounded-sm"></div> Global
                                 </div>
                             </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                             <Button variant="outline" size="sm" asChild>
                                 <a href={result.traceResult.finalUrl} target="_blank" rel="noopener noreferrer">
                                     <ExternalLink className="h-3 w-3 mr-2" />
                                     Öffnen
                                 </a>
                             </Button>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export function ValidationModal({ open, onOpenChange, onEditRule, rules = [], settings, reloadTrigger, isLoadingRules = false }: ValidationModalProps) {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('paste');
    const [pastedText, setPastedText] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    const [urlsToProcess, setUrlsToProcess] = useState<string[]>([]);
    const [results, setResults] = useState<any[] | null>(null);

    const [lastProcessedUrls, setLastProcessedUrls] = useState<string[]>([]);

    useEffect(() => {
        if (!open) {
            // Optional cleanup
        }
    }, [open]);

    const processUrls = async (urls: string[]) => {
        if (!Array.isArray(rules)) {
            console.error("ValidationModal: rules prop is not an array", rules);
            setProcessing(false);
            setError("Interner Fehler: Regeln konnten nicht geladen werden.");
            return;
        }
        setProcessing(true);
        setProgress(0);
        const batchSize = 20;
        const processedResults: any[] = [];

        const config = {
             ...RULE_MATCHING_CONFIG, // Merge default config
             CASE_SENSITIVITY_PATH: settings?.caseSensitiveLinkDetection ?? false,
             // Ensure weights are preserved if not in constants (although they are)
             WEIGHT_PATH_SEGMENT: 100,
             WEIGHT_QUERY_PAIR: 50,
             PENALTY_WILDCARD: -10,
             BONUS_EXACT_MATCH: 200,
             DEBUG: false
        };

        let currentIndex = 0;

        const processBatch = () => {
             const batch = urls.slice(currentIndex, Math.min(currentIndex + batchSize, urls.length));

             for (const url of batch) {
                 try {
                     // 1. Find Match
                     const matchDetails = findMatchingRule(url, rules, config as any);
                     const rule = matchDetails?.rule;

                     // 2. Trace Generation
                     let traceResult: UrlTraceResult;
                     if (rule) {
                         traceResult = traceUrlGeneration(url, rule, settings?.defaultNewDomain, settings);
                     } else {
                         // Use traceUrlGeneration with a dummy rule to trigger fallback logic (Smart Search / Domain Fallback)
                         traceResult = traceUrlGeneration(url, {
                             id: '',
                             matcher: '',
                             targetUrl: '',
                             redirectType: 'partial', // Default to partial to allow fallback logic to run
                             order: 0,
                             autoRedirect: false,
                             createdAt: new Date().toISOString()
                         }, settings?.defaultNewDomain, settings);
                     }
                     processedResults.push({ url, rule, traceResult, matchDetails });
                 } catch (e) {
                     console.error("Error processing URL:", url, e);
                     processedResults.push({
                        url,
                        error: true,
                        traceResult: {
                            originalUrl: url,
                            finalUrl: url,
                            steps: [{ description: "Fehler bei der Verarbeitung", urlBefore: url, urlAfter: url, changed: false, type: 'rule' }],
                            appliedGlobalRules: []
                        }
                     });
                 }
             }

             currentIndex += batch.length;
             setProgress(Math.round((currentIndex / urls.length) * 100));

             if (currentIndex < urls.length) {
                 setTimeout(processBatch, 10);
             } else {
                 setResults(processedResults);
                 setProcessing(false);
                 setUrlsToProcess([]);
             }
        };

        setTimeout(processBatch, 10);
    };

    const handleStart = async () => {
        setExtracting(true);
        setError(null);
        setWarning(null);
        setResults(null);
        let urls: string[] = [];

        try {
            if (activeTab === 'paste') {
                if (!pastedText.trim()) {
                    throw new Error("Bitte geben Sie URLs ein.");
                }
                urls = pastedText
                    .split(/[\n,;]+/)
                    .map(u => u.trim())
                    .filter(u => u.length > 0);
            } else {
                if (!selectedFile) {
                    throw new Error("Bitte wählen Sie eine Datei aus.");
                }
                const formData = new FormData();
                formData.append('file', selectedFile);

                const response = await fetch('/api/admin/tools/extract-urls', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Fehler beim Upload");
                }

                const result = await response.json();
                urls = result.urls;

                if (result.truncated) {
                   setWarning(`Hinweis: Die Datei enthielt mehr als 1000 URLs. Nur die ersten ${result.urls.length} wurden importiert.`);
                }
            }

            if (urls.length === 0) {
                throw new Error("Keine gültigen URLs gefunden.");
            }

            if (urls.length > 1000) {
                 urls = urls.slice(0, 1000);
                 setWarning("Limit: Nur die ersten 1000 URLs werden verarbeitet.");
            }

            console.log("URLs extracted:", urls.length);
            setUrlsToProcess(urls);
            processUrls(urls);

        } catch (e: any) {
            setError(e.message);
        } finally {
            setExtracting(false);
        }
    };

    const handleExport = () => {
        if (!results) return;

        const headers = ["Original URL", "New URL", "Changed", "Applied Rule", "Rule Match Quality", "Applied Global Rules", "Trace"];
        const rows = results.map(r => {
            const globalRules = r.traceResult.appliedGlobalRules.map((g: any) => g.description).join("; ");
            const trace = r.traceResult.steps.map((s: any) => `[${s.type}] ${s.description}`).join("; ");

            return [
                JSON.stringify(r.url),
                JSON.stringify(r.traceResult.finalUrl),
                JSON.stringify(r.url !== r.traceResult.finalUrl),
                JSON.stringify(r.rule ? r.rule.matcher : "No Match"),
                JSON.stringify(r.matchDetails ? r.matchDetails.quality + '%' : "0%"),
                JSON.stringify(globalRules),
                JSON.stringify(trace)
            ].join(",");
        });

        const csvContent = headers.join(",") + "\n" + rows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "validation_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleReload = () => {
        if (results) {
            const urls = results.map(r => r.url);
            processUrls(urls);
        } else if (lastProcessedUrls.length > 0) {
             processUrls(lastProcessedUrls);
        } else if (urlsToProcess.length > 0) {
             processUrls(urlsToProcess);
        } else if (pastedText && activeTab === 'paste') {
             handleStart();
        } else {
             toast({ title: "Keine Daten zum Aktualisieren", description: "Bitte starten Sie den Prozess neu." });
        }
    };

    useEffect(() => {
        if (results && results.length > 0) {
            setLastProcessedUrls(results.map(r => r.url));
        }
    }, [results]);

    useEffect(() => {
        if (open && reloadTrigger && reloadTrigger > 0) {
             handleReload();
        }
    }, [reloadTrigger]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[1200px] w-[95vw] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5" />
                        Konfigurationsvalidierung
                    </DialogTitle>
                    <DialogDescription>
                        Testen Sie Ihre Regeln mit einer Liste von URLs. Importieren Sie eine CSV/Excel-Datei oder fügen Sie URLs ein.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 px-1">
                    {!results && !processing && (
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="paste">Text einfügen</TabsTrigger>
                                <TabsTrigger value="upload">Datei hochladen</TabsTrigger>
                            </TabsList>

                            <TabsContent value="paste" className="space-y-4 mt-4">
                                <div className="space-y-2">
                                    <Label>URLs einfügen (durch Komma, Semikolon oder neue Zeile getrennt)</Label>
                                    <Textarea
                                        placeholder="https://example.com/a&#10;https://example.com/b"
                                        className="min-h-[200px] font-mono text-sm"
                                        value={pastedText}
                                        onChange={(e) => setPastedText(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Leerzeichen nach Trennzeichen werden automatisch entfernt.
                                    </p>
                                </div>
                            </TabsContent>

                            <TabsContent value="upload" className="space-y-4 mt-4">
                                <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (e.dataTransfer.files?.[0]) setSelectedFile(e.dataTransfer.files[0]);
                                    }}
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                >
                                    <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                                    <p className="text-sm font-medium mb-1">
                                        {selectedFile ? selectedFile.name : "Datei hierher ziehen oder klicken"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mb-4">
                                        Unterstützt CSV, XLSX, XLS (nur erste Spalte wird verwendet)
                                    </p>
                                    <Input
                                        id="file-upload"
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                                        }}
                                    />
                                    {selectedFile && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                                            <FileText className="h-4 w-4" />
                                            Ausgewählt
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}

                    {error && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Fehler</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {warning && (
                        <Alert className="mt-4 bg-yellow-50 text-yellow-800 border-yellow-200">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertTitle>Hinweis</AlertTitle>
                            <AlertDescription>{warning}</AlertDescription>
                        </Alert>
                    )}

                    {processing && (
                        <div className="py-10 space-y-4">
                            <Label>Verarbeite URLs... {progress}%</Label>
                            <Progress value={progress} className="w-full" />
                        </div>
                    )}

                    {results && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <div className="text-sm text-muted-foreground">
                                    {results.length} Ergebnisse
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={handleReload} disabled={processing}>
                                        <RefreshCw className="h-3 w-3 mr-2" /> Neu berechnen
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleExport}>
                                        <Download className="h-3 w-3 mr-2" /> CSV Export
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setResults(null)}>
                                        Neue Suche
                                    </Button>
                                </div>
                            </div>

                            <div className="border rounded-md overflow-hidden">
                                <div className="overflow-auto max-h-[600px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-muted sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 text-xs font-medium text-muted-foreground w-10"></th>
                                                <th className="p-3 text-xs font-medium text-muted-foreground">Original URL</th>
                                                <th className="p-3 text-xs font-medium text-muted-foreground">New URL</th>
                                                <th className="p-3 text-xs font-medium text-muted-foreground">Match Quality</th>
                                                <th className="p-3 text-xs font-medium text-muted-foreground text-right">Rule Tag</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map((result, i) => (
                                                <ResultRow key={i} result={result} onEditRule={onEditRule} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
                    {!results && !processing && (
                        <Button onClick={handleStart} disabled={extracting || processing || isLoadingRules} className="gap-2">
                            {isLoadingRules ? "Lade Regeln..." : (extracting ? "Lade..." : <><Play className="h-4 w-4" /> Validierung starten</>)}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
