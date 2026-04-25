import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Plus, Save, Trash2, Globe } from "lucide-react";

export function TranslationManager() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLang, setSelectedLang] = useState<string>("en");
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  // Available languages can be fetched or hardcoded based on i18n
  const supportedLngs = (i18n.options.supportedLngs || []).filter((l: string) => l !== 'cimode');

  const { data: translationData, isLoading } = useQuery({
    queryKey: ['/api/translations', selectedLang],
    queryFn: async () => {
      const res = await fetch(`/api/translations/${selectedLang}`);
      if (!res.ok) throw new Error("Failed to load translation");
      return res.json();
    }
  });

  useEffect(() => {
    if (translationData) {
      setEditData(translationData);
    }
  }, [translationData, selectedLang]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await fetch(`/api/admin/translations/${selectedLang}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update translations");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('erfolg', `Erfolg`), description: t('bersetzungen_gespeichert', `Übersetzungen gespeichert.`) });
      queryClient.invalidateQueries({ queryKey: ['/api/translations', selectedLang] });
      // Reload i18n resources
      i18n.reloadResources([selectedLang]);
    },
    onError: () => {
      toast({ title: t('fehler', `Fehler`), description: t('konnte_bersetzungen_nicht_spei', `Konnte Übersetzungen nicht speichern.`), variant: "destructive" });
    }
  });

  const handleSave = () => {
    updateMutation.mutate(editData);
  };

  const handleChange = (key: string, value: string) => {
    setEditData(prev => ({ ...prev, [key]: value }));
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    setEditData(prev => ({ ...prev, [newKey.trim()]: newVal }));
    setNewKey("");
    setNewVal("");
  };

  const handleDelete = (key: string) => {
    setEditData(prev => {
      const newData = { ...prev };
      delete newData[key];
      return newData;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Globe className="h-5 w-5" />
          <span>{t('translations', 'Übersetzungen')}</span>
        </CardTitle>
        <CardDescription>

                            {t('bersetzungen_fr_die_anwendung_', `Übersetzungen für die Anwendung anpassen und neue Sprachen verwalten.`)}
                          </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="w-48">
            <Select value={selectedLang} onValueChange={setSelectedLang}>
              <SelectTrigger>
                <SelectValue placeholder={t('sprache_auswhlen', `Sprache auswählen`)} />
              </SelectTrigger>
              <SelectContent>
                {supportedLngs.map((lng: string) => (
                  <SelectItem key={lng} value={lng}>
                    {lng.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />

                                  {t('speichern', `Speichern`)}
                                </Button>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('schlssel_key', `Schlüssel (Key)`)}</TableHead>
                <TableHead>{t('wert_value', `Wert (Value)`)}</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(editData).map(([key, val]) => (
                <TableRow key={key}>
                  <TableCell className="font-mono text-sm">{key}</TableCell>
                  <TableCell>
                    <Input
                      value={val}
                      onChange={(e) => handleChange(key, e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(key)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>
                  <Input
                    placeholder={t('neuer_schlssel', `Neuer Schlüssel...`)}
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder={t('wert', `Wert...`)}
                    value={newVal}
                    onChange={e => setNewVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAdd();
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={handleAdd}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
