import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Plus, Save, Trash2, Globe, Search } from "lucide-react";

export function TranslationManager() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLang, setSelectedLang] = useState<string>("en");
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [originalData, setOriginalData] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Available languages can be fetched or hardcoded based on i18n
  const supportedLngs = (i18n.options.supportedLngs || []).filter((l: string) => l !== 'cimode');


  const { data: baseTranslationData } = useQuery({
    queryKey: ['/api/translations', 'en'],
    queryFn: async () => {
      const res = await fetch(`/api/translations/en`);
      if (!res.ok) throw new Error("Failed to load base translation");
      return res.json();
    }
  });

  const { data: translationData, isLoading } = useQuery({

    queryKey: ['/api/translations', selectedLang],
    queryFn: async () => {
      const res = await fetch(`/api/translations/${selectedLang}`);
      if (!res.ok) throw new Error("Failed to load translation");
      return res.json();
    }
  });


  useEffect(() => {
    if (translationData && baseTranslationData) {
      // Create a merged set of keys, prioritizing existing translations, then base keys (with empty value)
      const mergedData = { ...translationData };
      if (selectedLang !== 'en') {
        Object.keys(baseTranslationData).forEach(key => {
          if (!(key in mergedData)) {
            mergedData[key] = ""; // Auto-add empty string for missing keys
          }
        });
      }
      setEditData(mergedData);
      setOriginalData(translationData); // Original only tracks what is actually in the DB
    }
  }, [translationData, baseTranslationData, selectedLang]);


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
      toast({ title: "Erfolg", description: "Übersetzungen gespeichert." });
      queryClient.invalidateQueries({ queryKey: ['/api/translations', selectedLang] });
      // Reload i18n resources
      i18n.reloadResources([selectedLang]);
    },
    onError: () => {
      toast({ title: "Fehler", description: "Konnte Übersetzungen nicht speichern.", variant: "destructive" });
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


  const filteredKeys = Object.keys(editData).filter((key) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return key.toLowerCase().includes(query) || (editData[key] || "").toLowerCase().includes(query);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Globe className="h-5 w-5" />
          <span>{t('translations', 'Übersetzungen')}</span>
        </CardTitle>
        <CardDescription>
          Übersetzungen für die Anwendung anpassen und neue Sprachen verwalten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="w-48">
            <Select value={selectedLang} onValueChange={setSelectedLang}>
              <SelectTrigger>
                <SelectValue placeholder="Sprache auswählen" />
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
            Speichern
          </Button>
        </div>


        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('suche_nach_schl_ssel_oder_we', `Suche nach Schlüssel oder Wert...`)}
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Schlüssel (Key)</TableHead>
                <TableHead>Wert (Value)</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKeys.map((key) => {
                const val = editData[key];
                const isChanged = originalData[key] !== val;
                return (

                <TableRow key={key} className={`${isChanged ? "bg-muted/50" : ""} ${val === "" ? "border-l-4 border-l-red-500" : ""}`}>

                  <TableCell className="font-mono text-sm">
                    <div className="flex flex-col">
                      <span>{key} {isChanged && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-yellow-500" title="Unsaved changes" />}</span>
                      {selectedLang !== 'en' && baseTranslationData && baseTranslationData[key] && (
                        <span className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{baseTranslationData[key]}</span>
                      )}
                    </div>
                  </TableCell>
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
              )})}
              <TableRow>
                <TableCell>
                  <Input
                    placeholder="Neuer Schlüssel..."
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Wert..."
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
