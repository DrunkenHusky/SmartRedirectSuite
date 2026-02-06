import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Plus, Trash2, Globe, RefreshCw } from "lucide-react";
import type { GeneralSettings, GlobalSearchAndReplace, GlobalStaticQueryParam, GlobalKeptQueryParam } from "@shared/schema";

interface GlobalRulesSettingsProps {
  settings: GeneralSettings;
  onUpdate: (settings: Partial<GeneralSettings>) => void;
  onSave: () => void;
  isSaving: boolean;
  onOpenValidation?: () => void;
}

export function GlobalRulesSettings({ settings, onUpdate, onSave, isSaving, onOpenValidation }: GlobalRulesSettingsProps) {
  // Helper to generate UUID
  const uuid = () => crypto.randomUUID();

  // Handlers for Search & Replace
  const handleAddSearchReplace = () => {
    const newItem: GlobalSearchAndReplace = {
      id: uuid(),
      search: "",
      replace: "",
      caseSensitive: false,
      order: (settings.globalSearchAndReplace?.length || 0)
    };
    onUpdate({
      globalSearchAndReplace: [...(settings.globalSearchAndReplace || []), newItem]
    });
  };

  const handleUpdateSearchReplace = (index: number, updates: Partial<GlobalSearchAndReplace>) => {
    const newItems = [...(settings.globalSearchAndReplace || [])];
    newItems[index] = { ...newItems[index], ...updates };
    onUpdate({ globalSearchAndReplace: newItems });
  };

  const handleRemoveSearchReplace = (index: number) => {
    const newItems = (settings.globalSearchAndReplace || []).filter((_, i) => i !== index);
    onUpdate({ globalSearchAndReplace: newItems });
  };

  const handleMoveSearchReplace = (index: number, direction: 'up' | 'down') => {
    const newItems = [...(settings.globalSearchAndReplace || [])];
    if (direction === 'up' && index > 0) {
        [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
    } else if (direction === 'down' && index < newItems.length - 1) {
        [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    }
    // Update order field if we were using it, but array order is enough
    onUpdate({ globalSearchAndReplace: newItems });
  };

  // Handlers for Static Params
  const handleAddStaticParam = () => {
    const newItem: GlobalStaticQueryParam = {
      id: uuid(),
      key: "",
      value: "",
      skipEncoding: false
    };
    onUpdate({
      globalStaticQueryParams: [...(settings.globalStaticQueryParams || []), newItem]
    });
  };

  const handleUpdateStaticParam = (index: number, updates: Partial<GlobalStaticQueryParam>) => {
    const newItems = [...(settings.globalStaticQueryParams || [])];
    newItems[index] = { ...newItems[index], ...updates };
    onUpdate({ globalStaticQueryParams: newItems });
  };

  const handleRemoveStaticParam = (index: number) => {
    const newItems = (settings.globalStaticQueryParams || []).filter((_, i) => i !== index);
    onUpdate({ globalStaticQueryParams: newItems });
  };

  const handleMoveStaticParam = (index: number, direction: 'up' | 'down') => {
    const newItems = [...(settings.globalStaticQueryParams || [])];
    if (direction === 'up' && index > 0) {
        [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
    } else if (direction === 'down' && index < newItems.length - 1) {
        [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    }
    onUpdate({ globalStaticQueryParams: newItems });
  };

  // Handlers for Kept Params
  const handleAddKeptParam = () => {
    const newItem: GlobalKeptQueryParam = {
      id: uuid(),
      keyPattern: "",
      valuePattern: "",
      targetKey: "",
      skipEncoding: false
    };
    onUpdate({
      globalKeptQueryParams: [...(settings.globalKeptQueryParams || []), newItem]
    });
  };

  const handleUpdateKeptParam = (index: number, updates: Partial<GlobalKeptQueryParam>) => {
    const newItems = [...(settings.globalKeptQueryParams || [])];
    newItems[index] = { ...newItems[index], ...updates };
    onUpdate({ globalKeptQueryParams: newItems });
  };

  const handleRemoveKeptParam = (index: number) => {
    const newItems = (settings.globalKeptQueryParams || []).filter((_, i) => i !== index);
    onUpdate({ globalKeptQueryParams: newItems });
  };

  // UI Render...
  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-600" />
                    <CardTitle>Globale Regeln</CardTitle>
                    </div>
                    {onOpenValidation && (
                        <Button variant="outline" size="sm" onClick={onOpenValidation} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Konfigurationsvalidierung
                        </Button>
                    )}
                </div>
                <CardDescription>
                    Diese Regeln werden auf alle Weiterleitungen angewendet (Partial, Domain).
                    Spezifische Regeln überschreiben diese globalen Einstellungen.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Search & Replace Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="font-medium">Globales Suchen & Ersetzen</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Ersetzen Sie Text in der Ziel-URL. Wird vor Query-Parametern angewendet.
                        <br/>
                        <span className="text-xs">Reihenfolge: Global (hier) &rarr; Regel-spezifisch. Wenn eine Regel denselben Suchbegriff definiert, gewinnt die Regel.</span>
                    </p>

                    <div className="space-y-3">
                        {(settings.globalSearchAndReplace || []).map((item, index) => (
                            <div key={item.id} className="flex flex-col gap-2 p-3 bg-muted/30 rounded border">
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">Suchen</label>
                                        <Input
                                            value={item.search}
                                            onChange={(e) => handleUpdateSearchReplace(index, { search: e.target.value })}
                                            placeholder="/alte-pfade"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">Ersetzen</label>
                                        <Input
                                            value={item.replace || ''}
                                            onChange={(e) => handleUpdateSearchReplace(index, { replace: e.target.value })}
                                            placeholder="/neue-pfade"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex items-center h-8 pb-1">
                                        <div className="flex items-center space-x-2" title="Groß-/Kleinschreibung beachten">
                                            <Switch
                                                checked={item.caseSensitive}
                                                onCheckedChange={(checked) => handleUpdateSearchReplace(index, { caseSensitive: checked })}
                                                className="scale-75"
                                            />
                                            <span className="text-xs">Aa</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                                            onClick={() => handleMoveSearchReplace(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                                            onClick={() => handleMoveSearchReplace(index, 'down')} disabled={index === (settings.globalSearchAndReplace?.length || 0) - 1}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleRemoveSearchReplace(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={handleAddSearchReplace} className="gap-2">
                            <Plus className="h-3 w-3" /> Hinzufügen
                        </Button>
                    </div>
                </div>

                {/* Static Params Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="font-medium">Globale Statische Parameter</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Parameter, die immer angehängt werden (z.B. ?source=migration).
                        <br/>
                        <span className="text-xs">Wenn eine Regel denselben Parameter-Key definiert, gewinnt der Wert aus der Regel.</span>
                    </p>
                     <div className="space-y-3">
                        {(settings.globalStaticQueryParams || []).map((item, index) => (
                            <div key={item.id} className="flex flex-col gap-2 p-3 bg-muted/30 rounded border">
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">Key</label>
                                        <Input
                                            value={item.key}
                                            onChange={(e) => handleUpdateStaticParam(index, { key: e.target.value })}
                                            placeholder="utm_source"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">Value</label>
                                        <Input
                                            value={item.value || ''}
                                            onChange={(e) => handleUpdateStaticParam(index, { value: e.target.value })}
                                            placeholder="migration_tool"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 items-center justify-end pb-1">
                                        <div className="flex items-center space-x-1" title="Nicht kodieren (Raw)">
                                            <Switch
                                                checked={item.skipEncoding}
                                                onCheckedChange={(checked) => handleUpdateStaticParam(index, { skipEncoding: checked })}
                                                className="scale-75"
                                            />
                                            <span className="text-[10px] text-gray-500">Raw</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                                            onClick={() => handleMoveStaticParam(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                                            onClick={() => handleMoveStaticParam(index, 'down')} disabled={index === (settings.globalStaticQueryParams?.length || 0) - 1}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleRemoveStaticParam(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={handleAddStaticParam} className="gap-2">
                            <Plus className="h-3 w-3" /> Hinzufügen
                        </Button>
                    </div>
                </div>

                {/* Kept Params Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="font-medium">Globale Parameter-Übernahme (Whitelist)</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Parameter, die bei aktivierter "Parameter entfernen" Option (in einer Regel) trotzdem behalten werden.
                        <br/>
                        <span className="text-xs">Wird zusätzlich zu den Regel-spezifischen Ausnahmen angewendet.</span>
                    </p>
                    <div className="space-y-3">
                        {(settings.globalKeptQueryParams || []).map((item, index) => (
                            <div key={item.id} className="flex flex-col gap-2 p-3 bg-muted/30 rounded border">
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">Key Pattern (Regex)</label>
                                        <Input
                                            value={item.keyPattern}
                                            onChange={(e) => handleUpdateKeptParam(index, { keyPattern: e.target.value })}
                                            placeholder="id|lang"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">Value Pattern (Opt.)</label>
                                        <Input
                                            value={item.valuePattern || ''}
                                            onChange={(e) => handleUpdateKeptParam(index, { valuePattern: e.target.value })}
                                            placeholder=".*"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">Neuer Name (Opt.)</label>
                                        <Input
                                            value={item.targetKey || ''}
                                            onChange={(e) => handleUpdateKeptParam(index, { targetKey: e.target.value })}
                                            placeholder="new_id"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 items-center justify-end pb-1">
                                        <div className="flex items-center space-x-1" title="Nicht kodieren (Raw)">
                                            <Switch
                                                checked={item.skipEncoding}
                                                onCheckedChange={(checked) => handleUpdateKeptParam(index, { skipEncoding: checked })}
                                                className="scale-75"
                                            />
                                            <span className="text-[10px] text-gray-500">Raw</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleRemoveKeptParam(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleAddKeptParam} className="gap-2">
                                <Plus className="h-3 w-3" /> Hinzufügen
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => {
                                const newItem: GlobalKeptQueryParam = {
                                    id: uuid(),
                                    keyPattern: "file",
                                    valuePattern: "",
                                    targetKey: "",
                                    skipEncoding: false
                                };
                                onUpdate({
                                    globalKeptQueryParams: [...(settings.globalKeptQueryParams || []), newItem]
                                });
                            }}>
                                Beispiel (file)
                            </Button>
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
                      onClick={onSave}
                      size="lg"
                      className="min-w-48 px-6"
                      disabled={isSaving}
                    >
                      {isSaving ? "Speichere..." : "Einstellungen speichern"}
                    </Button>
                  </div>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
