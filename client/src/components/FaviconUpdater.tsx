import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ArrowRightLeft,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  Bookmark,
  Share2,
  Clock,
  CheckCircle,
  Star,
  Heart,
  Bell
} from "lucide-react";
import type { GeneralSettings } from "@shared/schema";

const iconMap = {
  ArrowRightLeft,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  Bookmark,
  Share2,
  Clock,
  CheckCircle,
  Star,
  Heart,
  Bell
} as const;

export function FaviconUpdater() {
  const { data: settings } = useQuery<GeneralSettings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (!settings) return;

    // Use a more specific selector to avoid matching apple-touch-icon
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }

    if (settings.headerLogoUrl) {
      link.href = settings.headerLogoUrl;
      // Determine MIME type from URL extension if possible, or default to generic
      // Browsers generally detect this automatically, but being specific helps.
      if (settings.headerLogoUrl.endsWith('.svg')) {
          link.type = 'image/svg+xml';
      } else if (settings.headerLogoUrl.endsWith('.png')) {
          link.type = 'image/png';
      } else if (settings.headerLogoUrl.endsWith('.jpg') || settings.headerLogoUrl.endsWith('.jpeg')) {
          link.type = 'image/jpeg';
      } else {
          // Fallback or keep existing if known
          // link.type = 'image/x-icon'; // Standard for .ico, acceptable fallback
      }
    } else if (settings.headerIcon && settings.headerIcon !== "none") {
      const IconComponent = iconMap[settings.headerIcon as keyof typeof iconMap];
      if (IconComponent) {
        // Use primary color (blue) for the icon favicon.
        // This ensures good visibility on both light and dark tabs in most browsers.
        const iconSvg = renderToStaticMarkup(<IconComponent color="#2563EB" />);

        // Properly encode the SVG
        const encodedSvg = encodeURIComponent(iconSvg);
        link.href = `data:image/svg+xml,${encodedSvg}`;
        link.type = "image/svg+xml";
      }
    }
  }, [settings]);

  return null;
}
