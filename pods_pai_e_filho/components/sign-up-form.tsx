"use client";

import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/feedback/notice";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("As senhas não conferem.");
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Use uma senha com pelo menos 6 caracteres.");
      setIsLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/inicio`,
        data: { full_name: fullName.trim() },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    router.push("/auth/sign-up-success");
  };

  return (
    <form onSubmit={handleSignUp} className="grid gap-5">
      <Field label="Nome" htmlFor="name">
        <Input
          id="name"
          autoComplete="name"
          className="h-12"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </Field>
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
      <Field label="Senha" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          className="h-12"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>
      <Field label="Repetir senha" htmlFor="repeat-password">
        <Input
          id="repeat-password"
          type="password"
          autoComplete="new-password"
          className="h-12"
          required
          value={repeatPassword}
          onChange={(event) => setRepeatPassword(event.target.value)}
        />
      </Field>
      {error ? <Notice>{error}</Notice> : null}
      <Button type="submit" size="lg" disabled={isLoading}>
        <UserPlus />
        {isLoading ? "Criando..." : "Criar conta"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
