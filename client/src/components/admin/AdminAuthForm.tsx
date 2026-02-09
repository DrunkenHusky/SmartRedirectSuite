import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdminAuthFormProps {
  onAuthenticated: () => void;
  onClose: () => void;
}

export function AdminAuthForm({ onAuthenticated, onClose }: AdminAuthFormProps) {
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const authMutation = useMutation({
    mutationFn: async (password: string) => {
      return await apiRequest("POST", "/api/admin/login", { password });
    },
    onSuccess: async () => {
      toast({
        title: "Erfolgreich angemeldet",
        description: "Willkommen im Administrator-Bereich.",
      });

      // Immediately call onAuthenticated to update parent state
      onAuthenticated();

      // Then invalidate queries after state is updated
      await queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
    },
    onError: (error: any) => {
      toast({
        title: "Anmeldung fehlgeschlagen",
        description: error.message || "Falsches Passwort",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      authMutation.mutate(password);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="text-primary text-4xl" />
          </div>
          <CardTitle className="text-2xl">Administrator-Anmeldung</CardTitle>
          <p className="text-sm text-muted-foreground">
            Bitte geben Sie das Administrator-Passwort ein.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Passwort
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Administrator-Passwort eingeben"
                required
                disabled={authMutation.isPending}
              />
            </div>
            <div className="flex space-x-2">
              <Button
                type="submit"
                className="flex-1"
                disabled={authMutation.isPending}
              >
                {authMutation.isPending ? "Anmelden..." : "Anmelden"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={authMutation.isPending}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
