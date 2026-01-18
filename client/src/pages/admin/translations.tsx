import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Translation } from "@shared/schema";

export function TranslationsManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ key: string; lang: string; value: string } | null>(null);

  const { data: translations, isLoading } = useQuery<Translation[]>({
    queryKey: ["/api/admin/translations"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { key: string; lang: string; value: string }) => {
      const res = await fetch("/api/admin/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/translations"] });
      // Invalidate specific language cache for frontend
      queryClient.invalidateQueries({ queryKey: ["translations"] });
      toast({ title: t("common.save"), description: t('toast.settings.saved_desc', "Die allgemeinen Einstellungen wurden erfolgreich aktualisiert.") });
      setEditing(null);
    },
  });

  if (isLoading) {
    return <Loader2 className="h-8 w-8 animate-spin" />;
  }

  const groupedTranslations = (translations || []).reduce((acc, curr) => {
    if (!acc[curr.key]) {
      acc[curr.key] = { de: "", en: "", fr: "", it: "" };
    }
    acc[curr.key][curr.lang] = curr.value;
    return acc;
  }, {} as Record<string, Record<string, string>>);

  const keys = Object.keys(groupedTranslations).sort();
  const languages = ["de", "en", "fr", "it"];

  const handleSave = (key: string, lang: string, value: string) => {
    updateMutation.mutate({ key, lang, value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("nav.translations")}</CardTitle>
        <CardDescription>{t('settings.description', "Hier können Sie alle Texte der Anwendung anpassen.")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Key</TableHead>
                {languages.map((lang) => (
                  <TableHead key={lang} className="uppercase">
                    {lang}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{key}</TableCell>
                  {languages.map((lang) => (
                    <TableCell key={lang}>
                      <div className="flex items-center gap-2">
                        <Input
                          defaultValue={groupedTranslations[key][lang] || ""}
                          onBlur={(e) => {
                             if (e.target.value !== groupedTranslations[key][lang]) {
                               handleSave(key, lang, e.target.value);
                             }
                          }}
                          className="h-8"
                        />
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
