import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, AlertTriangle, Play, RefreshCw, Download, ChevronDown, ChevronRight, ExternalLink, ChevronsDown, ChevronsUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ValidationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onEditRule: (ruleId: number) => void;
    rules?: any[];
    settings?: any;
    reloadTrigger?: number;
    isLoadingRules?: boolean;
}

function ResultRow({ result, index, isExpanded, onToggle, onEditRule }: { result: any, index: number, isExpanded: boolean, onToggle: () => void, onEditRule: (id: number) => void }) {
    // Helper to get rule from matchDetails
    const rule = result.matchDetails?.rule;

    // Quality indicator color
    const getQualityColor = (quality: number) => {
        if (quality >= 100) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        if (quality >= 75) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        if (quality >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    };

    return (
        <>
            <tr className="border-b hover:bg-muted/50 cursor-pointer transition-colors" onClick={onToggle}>
                <td className="p-3 w-10 text-center">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </td>
                <td className="p-3 text-sm max-w-[400px]">
                    <div className="flex flex-col gap-1">
                         <div className="font-mono text-xs text-muted-foreground truncate flex items-center gap-2" title={result.url}>
                            <span className="select-none opacity-50 w-6">Old:</span>
                            <span className="truncate">{result.url}</span>
                         </div>
                         <div className="font-mono text-sm truncate flex items-center gap-2" title={result.traceResult.finalUrl}>
                             <span className="select-none opacity-50 w-6">New:</span>
                             <span className="truncate">{result.traceResult.finalUrl}</span>
                         </div>
                    </div>
                </td>
                <td className="p-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getQualityColor(result.matchDetails?.quality || 0)}`}>
                        {result.matchDetails?.quality || 0}%
                    </span>
                </td>
                <td className="p-3 text-sm text-right">
                     {rule ? (
                         <div
                             className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 cursor-pointer hover:bg-blue-200"
                             onClick={(e) => {
                                 e.stopPropagation();
                                 onEditRule(rule.id);
                             }}
                             title="Regel bearbeiten"
                         >
                             {rule.infoText ? rule.infoText : (rule.matcher || `Rule #${rule.id}`)}
                         </div>
                     ) : (
                         <span className="text-muted-foreground">-</span>
                     )}
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-muted/30 dark:bg-muted/10">
                    <td colSpan={4} className="p-4 space-y-4">
                        {/* Result Analysis - Full Width */}
                        <div className="border rounded-md p-4 bg-background shadow-sm">
                            <h4 className="font-semibold text-sm mb-3 border-b pb-2">Ergebnis-Analyse</h4>
                            <div className="space-y-2 text-sm">
                                <div className="grid grid-cols-3 gap-1">
                                    <span className="text-muted-foreground">Original:</span>
                                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="col-span-2 font-mono break-all text-blue-600 hover:underline flex items-center gap-1">
                                        {result.url} <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                    <span className="text-muted-foreground">Neu:</span>
                                    <a href={result.traceResult.finalUrl} target="_blank" rel="noopener noreferrer" className="col-span-2 font-mono break-all text-green-600 hover:underline flex items-center gap-1">
                                        {result.traceResult.finalUrl} <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>

                                {result.traceResult.searchFallback && (
                                    <div className="mt-2 p-2 bg-blue-50 text-blue-800 rounded text-xs">
                                        <strong>Smart Search Fallback:</strong> Weiterleitung zur Suche, da keine Regel passte.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Rule Config */}
                            <div className="border rounded-md p-4 bg-background shadow-sm">
                                <h4 className="font-semibold text-sm mb-3 flex justify-between items-center border-b pb-2">
                                    Angewandte Regel
                                    {rule && (
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onEditRule(rule.id); }}>
                                            <ExternalLink className="h-3 w-3 mr-1" /> Bearbeiten
                                        </Button>
                                    )}
                                </h4>
                                {rule ? (
                                    <div className="space-y-2 text-sm">
                                        <div className="grid grid-cols-3 gap-1">
                                            <span className="text-muted-foreground">ID:</span>
                                            <span className="col-span-2 font-mono">{rule.id}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1">
                                            <span className="text-muted-foreground">Matcher:</span>
                                            <span className="col-span-2 font-mono break-all bg-muted/50 p-1 rounded">{rule.matcher}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1">
                                            <span className="text-muted-foreground">Ziel:</span>
                                            <span className="col-span-2 font-mono break-all bg-muted/50 p-1 rounded">{rule.targetUrl || '-'}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1">
                                            <span className="text-muted-foreground">Typ:</span>
                                            <span className="col-span-2">{rule.redirectType}</span>
                                        </div>
                                        {rule.discardQueryParams && (
                                             <div className="grid grid-cols-3 gap-1 text-orange-600">
                                                 <span className="col-span-3 text-xs italic">Parameter werden verworfen</span>
                                             </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">Keine spezifische Regel gefunden (Fallback).</p>
                                )}
                            </div>

                            {/* Global Rules */}
                            <div className="border rounded-md p-4 bg-background shadow-sm flex flex-col">
                                <h4 className="font-semibold text-sm mb-3 border-b pb-2">Angewandte Globale Regeln</h4>
                                {result.traceResult.appliedGlobalRules && result.traceResult.appliedGlobalRules.length > 0 ? (
                                    <div className="bg-blue-50/50 rounded-md p-2 flex-1">
                                        <div className="space-y-2">
                                            {result.traceResult.appliedGlobalRules.map((rule: any, idx: number) => (
                                                <div key={idx} className="flex items-start gap-2 text-sm text-blue-700">
                                                    <span className="mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                                                    <span>{rule.description}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic">
                                        Keine globalen Regeln angewendet
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Trace Steps */}
                        {result.traceResult.steps && result.traceResult.steps.length > 0 && (
                            <div className="border rounded-md overflow-hidden">
                                <div className="bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Verarbeitungsschritte
                                </div>
                                <div className="divide-y">
                                    {result.traceResult.steps.map((step: any, idx: number) => (
                                        <div key={idx} className="p-3 text-sm grid grid-cols-[auto_1fr] gap-4 items-start bg-background">
                                            <div className="flex flex-col items-center pt-1">
                                                <div className={`w-2 h-2 rounded-full ${step.changed ? 'bg-orange-500' : 'bg-gray-300'}`} />
                                                {idx < result.traceResult.steps.length - 1 && <div className="w-px h-full bg-border my-1" />}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="font-medium">{step.description}</div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-muted-foreground">
                                                    <div className="break-all bg-muted/30 p-1 rounded">{step.urlBefore}</div>
                                                    <div className="break-all bg-muted/30 p-1 rounded flex items-center">
                                                        <span className="mr-2">➔</span> {step.urlAfter}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

export function ValidationModal({ open, onOpenChange, onEditRule, rules = [], settings, reloadTrigger, isLoadingRules = false }: ValidationModalProps) {
    const [pastedText, setPastedText] = useState("");
    const [activeTab, setActiveTab] = useState("paste");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [results, setResults] = useState<any[] | null>(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [extracting, setExtracting] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Logic for reload handling
    const [lastProcessedUrls, setLastProcessedUrls] = useState<string[]>([]);
    const [urlsToProcess, setUrlsToProcess] = useState<string[]>([]);
    const { toast } = useToast();

    const toggleRow = (index: number) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setExpandedRows(newSet);
    };

    const expandAll = () => {
        if (results) {
            setExpandedRows(new Set(results.map((_, i) => i)));
        }
    };

    const collapseAll = () => {
        setExpandedRows(new Set());
    };

    const handleExport = () => {
        if (!results) return;

        const headers = ["Original URL", "Final URL", "Changed", "Rule Matcher", "Match Quality"];
        const csvContent = [
            headers.join(","),
            ...results.map(r => {
                const row = [
                    `"${r.url}"`,
                    `"${r.traceResult.finalUrl}"`,
                    r.traceResult.originalUrl !== r.traceResult.finalUrl,
                    `"${r.matchDetails?.rule?.matcher || ''}"`,
                    r.matchDetails?.quality || 0
                ];
                return row.join(",");
            })
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "validation_results.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const processUrls = async (urls: string[]) => {
        setProcessing(true);
        setError(null);
        setProgress(0);
        setExpandedRows(new Set());

        try {
            const batchSize = 50;
            const results: any[] = [];

            for (let i = 0; i < urls.length; i += batchSize) {
                const batch = urls.slice(i, i + batchSize);

                const res = await fetch("/api/admin/validate-urls", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ urls: batch })
                });

                if (!res.ok) throw new Error("Validation failed");

                const batchResults = await res.json();
                results.push(...batchResults);
                setProgress(Math.round(((i + batch.length) / urls.length) * 100));
            }

            setResults(results);
        } catch (e) {
            setError("Fehler bei der Validierung: " + (e instanceof Error ? e.message : String(e)));
        } finally {
            setProcessing(false);
        }
    };

    const handleStart = async () => {
        setError(null);
        setWarning(null);
        setResults(null);
        setUrlsToProcess([]);

        if (activeTab === 'paste') {
            if (!pastedText.trim()) {
                setError("Bitte geben Sie mindestens eine URL ein.");
                return;
            }

            const urls = pastedText.split(/[\n,;]+/)
                .map(u => u.trim())
                .filter(u => u.length > 0);

            if (urls.length === 0) {
                setError("Keine gültigen URLs gefunden.");
                return;
            }

            setUrlsToProcess(urls);
            processUrls(urls);
        } else {
            if (!selectedFile) {
                setError("Bitte wählen Sie eine Datei aus.");
                return;
            }

            setExtracting(true);
            const formData = new FormData();
            formData.append('file', selectedFile);

            try {
                const response = await fetch('/api/admin/tools/extract-urls', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(await response.text());
                }

                const data = await response.json();

                if (data.urls && data.urls.length > 0) {
                    if (data.totalFound > data.urls.length) {
                        setWarning(`Es wurden ${data.totalFound} URLs gefunden, aber nur die ersten ${data.urls.length} werden verarbeitet.`);
                    }
                    setUrlsToProcess(data.urls);
                    processUrls(data.urls);
                } else {
                    setError("Keine URLs in der Datei gefunden.");
                }
            } catch (err) {
                setError("Fehler beim Verarbeiten der Datei: " + (err instanceof Error ? err.message : String(err)));
            } finally {
                setExtracting(false);
            }
        }
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
                                    <Button variant="ghost" size="sm" onClick={expandAll} disabled={processing} title="Alle ausklappen">
                                        <ChevronsDown className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={collapseAll} disabled={processing} title="Alle einklappen">
                                        <ChevronsUp className="h-4 w-4" />
                                    </Button>
                                    <div className="w-px h-6 bg-border mx-1" />
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
                                                <th className="p-3 text-xs font-medium text-muted-foreground">URL Transformation</th>
                                                <th className="p-3 text-xs font-medium text-muted-foreground">Match Quality</th>
                                                <th className="p-3 text-xs font-medium text-muted-foreground text-right">Rule Tag</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map((result, i) => (
                                                <ResultRow
                                                    key={i}
                                                    result={result}
                                                    index={i}
                                                    isExpanded={expandedRows.has(i)}
                                                    onToggle={() => toggleRow(i)}
                                                    onEditRule={onEditRule}
                                                />
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
