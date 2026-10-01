"use client";

import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // O usuário já tem sessão ativa neste ponto.
      router.push("/protected");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Não foi possível salvar a nova senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpdatePassword} className="grid gap-5">
      <Field label="Nova senha" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          className="h-12"
          placeholder="Nova senha"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error ? <Notice>{error}</Notice> : null}
      <Button type="submit" size="lg" disabled={isLoading}>
        <KeyRound />
        {isLoading ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
