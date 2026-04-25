import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PasswordModal({ isOpen, onClose, onSuccess }: PasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setPassword("");
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || "Falsches Passwort. Bitte versuchen Sie es erneut.");
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("Login error:", error);

      if (error.name === 'AbortError') {
         setError("Zeitüberschreitung bei der Anfrage. Bitte versuchen Sie es erneut.");
      } else {
         setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return; // Prevent closing while loading
    setPassword("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Administrator-Anmeldung
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Bitte geben Sie das Administrator-Passwort ein:
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Passwort eingeben"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoFocus
          />
          
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="flex space-x-3">
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? "Anmelden..." : "Anmelden"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={handleClose}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
