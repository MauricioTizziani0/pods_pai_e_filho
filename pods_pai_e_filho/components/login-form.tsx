"use client";

import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("E-mail ou senha incorretos.");
      setIsLoading(false);
      return;
    }

    router.push("/inicio");
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="grid gap-5">
      <Field label="E-mail" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="h-12"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <div className="grid gap-1.5">
        <div className="flex min-w-0 items-center justify-between">
          <label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Senha
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            Esqueci a senha
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-12"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? <Notice>{error}</Notice> : null}
      <Button type="submit" size="lg" disabled={isLoading}>
        <LogIn />
        {isLoading ? "Entrando..." : "Entrar"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem acesso?{" "}
        <Link href="/auth/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
