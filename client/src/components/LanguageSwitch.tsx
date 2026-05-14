import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { BUILT_IN_LANGUAGES, DEFAULT_LANGUAGE, type LanguageOption } from '@shared/i18n';

const fallbackLanguageOptions: LanguageOption[] = BUILT_IN_LANGUAGES.map((language) => ({
  ...language,
  isBuiltIn: true,
}));

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const { data } = useQuery<{ languages: LanguageOption[] }>({
    queryKey: ['/api/translations/languages'],
    queryFn: async () => {
      const response = await fetch('/api/translations/languages');
      if (!response.ok) {
        throw new Error('Failed to load available languages');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const languageOptions = data?.languages?.length ? data.languages : fallbackLanguageOptions;
  const currentLanguage = i18n.resolvedLanguage || i18n.language || DEFAULT_LANGUAGE;
  const baseLanguage = currentLanguage.split('-')[0];
  const selectedLanguage = languageOptions.some((language) => language.code === currentLanguage)
    ? currentLanguage
    : languageOptions.some((language) => language.code === baseLanguage)
      ? baseLanguage
      : DEFAULT_LANGUAGE;

  return (
    <div className="flex items-center space-x-2">
      <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <Select value={selectedLanguage} onValueChange={(languageCode) => i18n.changeLanguage(languageCode)}>
        <SelectTrigger
          aria-label={t('select_language', 'Select language')}
          className="w-[112px] h-8 text-xs bg-transparent border-0 ring-offset-0 focus:ring-0 shadow-none hover:bg-accent/50 transition-colors"
        >
          <SelectValue placeholder={t('language', 'Language')} />
        </SelectTrigger>
        <SelectContent align="end">
          {languageOptions.map((language) => (
            <SelectItem key={language.code} value={language.code} className="text-xs">
              <span className="font-medium">{language.code.toUpperCase()}</span>
              <span className="ml-2 text-muted-foreground">{language.nativeName}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
