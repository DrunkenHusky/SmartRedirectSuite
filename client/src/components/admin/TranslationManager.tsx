import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Globe, Plus, Save, Search, Trash2 } from 'lucide-react';
import { DEFAULT_LANGUAGE, type LanguageOption, assertValidLanguageCode } from '@shared/i18n';

type TranslationResponse = Record<string, string>;

type LanguageListResponse = {
  languages: LanguageOption[];
};

function countMissingBaseKeys(baseTranslations: TranslationResponse, translations: TranslationResponse) {
  return Object.keys(baseTranslations).filter((key) => !translations[key]?.trim()).length;
}

export function TranslationManager() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLanguage, setSelectedLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [editData, setEditData] = useState<TranslationResponse>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newLanguageCode, setNewLanguageCode] = useState('');
  const [originalData, setOriginalData] = useState<TranslationResponse>({});
  const [searchQuery, setSearchQuery] = useState('');

  const { data: languageListData } = useQuery<LanguageListResponse>({
    queryKey: ['/api/translations/languages'],
    queryFn: async () => {
      const response = await fetch('/api/translations/languages');
      if (!response.ok) throw new Error('Failed to load available languages');
      return response.json();
    },
  });

  const languageOptions = languageListData?.languages ?? [];

  const { data: baseTranslationData = {} } = useQuery<TranslationResponse>({
    queryKey: ['/api/translations', DEFAULT_LANGUAGE],
    queryFn: async () => {
      const response = await fetch(`/api/translations/${DEFAULT_LANGUAGE}`);
      if (!response.ok) throw new Error('Failed to load base translations');
      return response.json();
    },
  });

  const { data: translationData = {}, isLoading } = useQuery<TranslationResponse>({
    queryKey: ['/api/translations', selectedLanguage],
    queryFn: async () => {
      const response = await fetch(`/api/translations/${selectedLanguage}`);
      if (!response.ok) throw new Error('Failed to load translations');
      return response.json();
    },
  });

  useEffect(() => {
    const mergedTranslations = { ...translationData };

    if (selectedLanguage !== DEFAULT_LANGUAGE) {
      Object.keys(baseTranslationData).forEach((key) => {
        if (!(key in mergedTranslations)) {
          mergedTranslations[key] = '';
        }
      });
    }

    setEditData(mergedTranslations);
    setOriginalData(translationData);
  }, [baseTranslationData, selectedLanguage, translationData]);

  const updateMutation = useMutation({
    mutationFn: async (data: TranslationResponse) => {
      const response = await fetch(`/api/admin/translations/${selectedLanguage}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to update translations');
      }

      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: t('translation_save_success_title', 'Translations saved'),
        description: t('translation_save_success_description', 'The selected language was updated successfully.'),
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/translations'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/translations/languages'] });
      await i18n.reloadResources([selectedLanguage]);
    },
    onError: (error) => {
      toast({
        title: t('translation_save_error_title', 'Could not save translations'),
        description: error instanceof Error ? error.message : t('translation_save_error_description', 'Please review the language code and values.'),
        variant: 'destructive',
      });
    },
  });

  const addLanguageMutation = useMutation({
    mutationFn: async (languageCode: string) => {
      const normalizedLanguageCode = assertValidLanguageCode(languageCode);
      const response = await fetch(`/api/admin/translations/${normalizedLanguageCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to add language');
      }

      return normalizedLanguageCode;
    },
    onSuccess: async (languageCode) => {
      setNewLanguageCode('');
      setSelectedLanguage(languageCode);
      await queryClient.invalidateQueries({ queryKey: ['/api/translations/languages'] });
      toast({
        title: t('translation_language_added_title', 'Language added'),
        description: t('translation_language_added_description', 'The language is ready for manual translations.'),
      });
    },
    onError: (error) => {
      toast({
        title: t('translation_language_error_title', 'Could not add language'),
        description: error instanceof Error ? error.message : t('translation_language_error_description', 'Use a valid language code such as pt-br.'),
        variant: 'destructive',
      });
    },
  });

  const filteredKeys = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const keys = Object.keys(editData).sort((leftKey, rightKey) => leftKey.localeCompare(rightKey));

    if (!normalizedQuery) return keys;

    return keys.filter((key) => {
      const translatedValue = editData[key] || '';
      const baseValue = baseTranslationData[key] || '';
      return [key, translatedValue, baseValue].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [baseTranslationData, editData, searchQuery]);

  const changedCount = Object.keys(editData).filter((key) => originalData[key] !== editData[key]).length;
  const missingCount = selectedLanguage === DEFAULT_LANGUAGE ? 0 : countMissingBaseKeys(baseTranslationData, editData);

  const handleSave = () => updateMutation.mutate(editData);

  const handleAddKey = () => {
    const trimmedKey = newKey.trim();
    if (!trimmedKey) return;

    setEditData((currentData) => ({ ...currentData, [trimmedKey]: newValue }));
    setNewKey('');
    setNewValue('');
  };

  const handleDeleteKey = (key: string) => {
    setEditData((currentData) => {
      const nextData = { ...currentData };
      delete nextData[key];
      return nextData;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Globe className="h-5 w-5" aria-hidden="true" />
          <span>{t('translations', 'Translations')}</span>
        </CardTitle>
        <CardDescription>
          {t('translation_manager_description', 'Manage UI copy for built-in languages and add custom languages for international rollouts.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,320px)_1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="translation-language-select">
              {t('language', 'Language')}
            </label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger id="translation-language-select">
                <SelectValue placeholder={t('select_language', 'Select language')} />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((language) => (
                  <SelectItem key={language.code} value={language.code}>
                    {language.code.toUpperCase()} · {language.nativeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedLanguage === DEFAULT_LANGUAGE
                ? t('translation_default_language_hint', 'English is the default and fallback language.')
                : t('translation_non_default_language_hint', 'Missing values fall back to English until you provide a translation.')}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
              <Input
                aria-label={t('new_language_code', 'New language code')}
                placeholder={t('language_code_placeholder', 'e.g. pt-br')}
                value={newLanguageCode}
                onChange={(event) => setNewLanguageCode(event.target.value)}
              />
              <p className="self-center text-sm text-muted-foreground">
                {t('add_language_help_text', 'Add any BCP 47 style language code. New languages start with English fallback values.')}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => addLanguageMutation.mutate(newLanguageCode)}
                disabled={!newLanguageCode.trim() || addLanguageMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('add_language', 'Add language')}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{t('translation_key_count', '{{count}} keys', { count: Object.keys(editData).length })}</span>
            <span>·</span>
            <span>{t('translation_changed_count', '{{count}} changed', { count: changedCount })}</span>
            {selectedLanguage !== DEFAULT_LANGUAGE && (
              <>
                <span>·</span>
                <span className={missingCount > 0 ? 'text-amber-600' : 'text-green-600'}>
                  {t('translation_missing_count', '{{count}} missing', { count: missingCount })}
                </span>
              </>
            )}
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending || isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {t('save', 'Save')}
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder={t('translation_search_placeholder', 'Search by key, translation, or English fallback...')}
            className="pl-8"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('translation_key_header', 'Key')}</TableHead>
                <TableHead>{t('translation_value_header', 'Value')}</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKeys.map((key) => {
                const value = editData[key] ?? '';
                const isChanged = originalData[key] !== value;

                return (
                  <TableRow key={key} className={`${isChanged ? 'bg-muted/50' : ''} ${value === '' ? 'border-l-4 border-l-amber-500' : ''}`}>
                    <TableCell className="font-mono text-sm align-top">
                      <div className="flex flex-col gap-1">
                        <span>
                          {key}
                          {isChanged && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-yellow-500" title={t('unsaved_changes', 'Unsaved changes')} />}
                        </span>
                        {selectedLanguage !== DEFAULT_LANGUAGE && baseTranslationData[key] && (
                          <span className="text-xs text-muted-foreground whitespace-pre-wrap">{baseTranslationData[key]}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input value={value} onChange={(event) => setEditData((currentData) => ({ ...currentData, [key]: event.target.value }))} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteKey(key)} aria-label={t('delete_translation_key', 'Delete translation key')}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell>
                  <Input placeholder={t('new_key_placeholder', 'New key...')} value={newKey} onChange={(event) => setNewKey(event.target.value)} />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder={t('value_placeholder', 'Value...')}
                    value={newValue}
                    onChange={(event) => setNewValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleAddKey();
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={handleAddKey} aria-label={t('add_translation_key', 'Add translation key')}>
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
