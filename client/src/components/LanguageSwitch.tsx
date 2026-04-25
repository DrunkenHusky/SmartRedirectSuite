import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";

export function LanguageSwitch() {
  const { i18n } = useTranslation();

  // Exclude cimode which is used for testing
  const supportedLngs = (i18n.options.supportedLngs || []).filter((l: string) => l !== 'cimode');

  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';

  return (
    <div className="flex items-center space-x-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={currentLang} onValueChange={(val) => i18n.changeLanguage(val)}>
        <SelectTrigger className="w-[80px] h-8 text-xs bg-transparent border-0 ring-offset-0 focus:ring-0 shadow-none hover:bg-accent/50 transition-colors">
          <SelectValue placeholder="Lang" />
        </SelectTrigger>
        <SelectContent align="end">
          {supportedLngs.map((lng: string) => (
            <SelectItem key={lng} value={lng} className="text-xs">
              {lng.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
