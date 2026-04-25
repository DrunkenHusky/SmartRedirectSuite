import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function NotFound() {
    const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">{t('404_page_not_found', `404 Page Not Found`)}</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">

                                  {t('did_you_forget_to_add_the_page', `Did you forget to add the page to the router?`)}
                                </p>
        </CardContent>
      </Card>
    </div>
  );
}
