import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Plus, Trash2, Globe, RefreshCw } from "lucide-react";
import type { GeneralSettings, GlobalSearchAndReplace, GlobalStaticQueryParam, GlobalKeptQueryParam } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface GlobalRulesSettingsProps {
  settings: GeneralSettings;
  onUpdate: (settings: Partial<GeneralSettings>) => void;
  onSave: () => void;
  isSaving: boolean;
  onOpenValidation?: () => void;
}

export function GlobalRulesSettings({ settings, onUpdate, onSave, isSaving, onOpenValidation }: GlobalRulesSettingsProps) {
    const { t } = useTranslation();
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
                    <CardTitle>{t('globale_regeln', `Globale Regeln`)}</CardTitle>
                    </div>
                    {onOpenValidation && (
                        <Button variant="outline" size="sm" onClick={onOpenValidation} className="gap-2">
                            <RefreshCw className="h-4 w-4" />

                                                          {t('konfigurationsvalidierung', `Konfigurationsvalidierung`)}
                                                      </Button>
                    )}
                </div>
                <CardDescription>

                                          {t('diese_regeln_werden_auf_alle_w', `Diese Regeln werden auf alle Weiterleitungen angewendet (Partial, Domain).
                    Spezifische Regeln überschreiben diese globalen Einstellungen.`)}
                                      </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Search & Replace Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="font-medium">{t('globales_suchen_ersetzen', `Globales Suchen & Ersetzen`)}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">

                                                  {t('ersetzen_sie_text_in_der_zielu', `Ersetzen Sie Text in der Ziel-URL. Wird vor Query-Parametern angewendet.`)}
                                                  <br/>
                        <span className="text-xs">{t('reihenfolge_global_hier_rarr_r', `Reihenfolge: Global (hier) &rarr; Regel-spezifisch. Wenn eine Regel denselben Suchbegriff definiert, gewinnt die Regel.`)}</span>
                    </p>

                    <div className="space-y-3">
                        {(settings.globalSearchAndReplace || []).map((item, index) => (
                            <div key={item.id} className="flex flex-col gap-2 p-3 bg-muted/30 rounded border">
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">{t('suchen', `Suchen`)}</label>
                                        <Input
                                            value={item.search}
                                            onChange={(e) => handleUpdateSearchReplace(index, { search: e.target.value })}
                                            placeholder={t('altepfade', `/alte-pfade`)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">{t('ersetzen', `Ersetzen`)}</label>
                                        <Input
                                            value={item.replace || ''}
                                            onChange={(e) => handleUpdateSearchReplace(index, { replace: e.target.value })}
                                            placeholder={t('neuepfade', `/neue-pfade`)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex items-center h-8 pb-1">
                                        <div className="flex items-center space-x-2" title={t('grokleinschreibung_beachten', `Groß-/Kleinschreibung beachten`)}>
                                            <Switch
                                                checked={item.caseSensitive}
                                                onCheckedChange={(checked) => handleUpdateSearchReplace(index, { caseSensitive: checked })}
                                                className="scale-75"
                                            />
                                            <span className="text-xs">{t('aa', `Aa`)}</span>
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
                            <Plus className="h-3 w-3" />  {t('hinzufgen', `Hinzufügen`)}
                                                      </Button>
                    </div>
                </div>

                {/* Static Params Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="font-medium">{t('globale_statische_parameter', `Globale Statische Parameter`)}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">

                                                  {t('parameter_die_immer_angehngt_w', `Parameter, die immer angehängt werden (z.B. ?source=migration).`)}
                                                  <br/>
                        <span className="text-xs">{t('wenn_eine_regel_denselben_para', `Wenn eine Regel denselben Parameter-Key definiert, gewinnt der Wert aus der Regel.`)}</span>
                    </p>
                     <div className="space-y-3">
                        {(settings.globalStaticQueryParams || []).map((item, index) => (
                            <div key={item.id} className="flex flex-col gap-2 p-3 bg-muted/30 rounded border">
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">{t('key', `Key`)}</label>
                                        <Input
                                            value={item.key}
                                            onChange={(e) => handleUpdateStaticParam(index, { key: e.target.value })}
                                            placeholder={t('utm_source', `utm_source`)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">{t('value', `Value`)}</label>
                                        <Input
                                            value={item.value || ''}
                                            onChange={(e) => handleUpdateStaticParam(index, { value: e.target.value })}
                                            placeholder={t('migration_tool', `migration_tool`)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 items-center justify-end pb-1">
                                        <div className="flex items-center space-x-1" title={t('nicht_kodieren_raw', `Nicht kodieren (Raw)`)}>
                                            <Switch
                                                checked={item.skipEncoding}
                                                onCheckedChange={(checked) => handleUpdateStaticParam(index, { skipEncoding: checked })}
                                                className="scale-75"
                                            />
                                            <span className="text-[10px] text-gray-500">{t('raw', `Raw`)}</span>
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
                            <Plus className="h-3 w-3" />  {t('hinzufgen', `Hinzufügen`)}
                                                      </Button>
                    </div>
                </div>

                {/* Kept Params Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="font-medium">{t('globale_parameterbernahme_whit', `Globale Parameter-Übernahme (Whitelist)`)}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">

                                                  {t('parameter_die_bei_aktivierter_', `Parameter, die bei aktivierter "Parameter entfernen" Option (in einer Regel) trotzdem behalten werden.`)}
                                                  <br/>
                        <span className="text-xs">{t('wird_zustzlich_zu_den_regelspe', `Wird zusätzlich zu den Regel-spezifischen Ausnahmen angewendet.`)}</span>
                    </p>
                    <div className="space-y-3">
                        {(settings.globalKeptQueryParams || []).map((item, index) => (
                            <div key={item.id} className="flex flex-col gap-2 p-3 bg-muted/30 rounded border">
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">{t('key_pattern_regex', `Key Pattern (Regex)`)}</label>
                                        <Input
                                            value={item.keyPattern}
                                            onChange={(e) => handleUpdateKeptParam(index, { keyPattern: e.target.value })}
                                            placeholder={t('idlang', `id|lang`)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">{t('value_pattern_opt', `Value Pattern (Opt.)`)}</label>
                                        <Input
                                            value={item.valuePattern || ''}
                                            onChange={(e) => handleUpdateKeptParam(index, { valuePattern: e.target.value })}
                                            placeholder=".*"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <label className="text-xs font-medium block">{t('neuer_name_opt', `Neuer Name (Opt.)`)}</label>
                                        <Input
                                            value={item.targetKey || ''}
                                            onChange={(e) => handleUpdateKeptParam(index, { targetKey: e.target.value })}
                                            placeholder={t('new_id', `new_id`)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 items-center justify-end pb-1">
                                        <div className="flex items-center space-x-1" title={t('nicht_kodieren_raw', `Nicht kodieren (Raw)`)}>
                                            <Switch
                                                checked={item.skipEncoding}
                                                onCheckedChange={(checked) => handleUpdateKeptParam(index, { skipEncoding: checked })}
                                                className="scale-75"
                                            />
                                            <span className="text-[10px] text-gray-500">{t('raw', `Raw`)}</span>
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
                                <Plus className="h-3 w-3" />  {t('hinzufgen', `Hinzufügen`)}
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

                                                                  {t('beispiel_file', `Beispiel (file)`)}
                                                              </Button>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="sticky bottom-0 z-40 bg-card border-t pt-4 pb-4 mt-8 px-4 sm:px-6 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 rounded-b-xl shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">

                                                          {t('speichern_sie_ihre_nderungen_u', `Speichern Sie Ihre Änderungen um sie auf der Website anzuwenden.`)}
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
