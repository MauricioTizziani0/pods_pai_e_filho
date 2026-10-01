"use client";

import { MailCheck, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // A URL precisa estar nas Redirect URLs do projeto no Supabase (Auth > URL Configuration).
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Não foi possível enviar o e-mail.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="animate-enter grid gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-success/35 bg-success/10 px-3 py-3 text-sm">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="leading-relaxed">
            Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.
          </p>
        </div>
        <Link href="/auth/login" className="text-center text-sm text-primary underline-offset-4 hover:underline">
          Voltar para entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleForgotPassword} className="grid gap-5">
      <Field label="E-mail" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="h-12"
          placeholder="seu@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      {error ? <Notice>{error}</Notice> : null}
      <Button type="submit" size="lg" disabled={isLoading}>
        <Send />
        {isLoading ? "Enviando..." : "Enviar link de redefinição"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Lembrou a senha?{" "}
        <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
