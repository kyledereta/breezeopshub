import { useState, useEffect, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import breezeLogo from "@/assets/breeze-logo.png";

const STAFF_PASSWORD = "breeze2024";
const STORAGE_KEY = "breeze_auth";

interface PasswordGateProps {
  children: ReactNode;
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === "true") setAuthenticated(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === STAFF_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (authenticated) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <img src={breezeLogo} alt="Breeze Resort" className="h-16 w-16" />
          <div className="text-center">
            <h1 className="font-display text-3xl text-primary tracking-wide">Breeze Resort</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
              Liwliwa · Zambales
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Staff Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                placeholder="Enter password"
                className="pl-9 bg-card border-border"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs text-destructive">Incorrect password. Please try again.</p>
            )}
          </div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Sign In
          </Button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground">
          Staff access only. Contact management for credentials.
        </p>
      </div>
    </div>
  );
}
